-- ==========================================
-- HAZR COMMUNITY VALIDATION & REPUTATION SYSTEM
-- Run this in the Supabase SQL Editor
-- ==========================================

-- 1. Extend profiles table with reputation
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS reputation INTEGER NOT NULL DEFAULT 100;

-- 2. Extend hazards table with community statistics
ALTER TABLE public.hazards 
ADD COLUMN IF NOT EXISTS upvotes_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS downvotes_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS verifications_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS fixed_votes_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS trust_score INTEGER NOT NULL DEFAULT 50;

-- 3. Create hazard_validations table to track individual user actions per hazard
CREATE TABLE IF NOT EXISTS public.hazard_validations (
  hazard_id TEXT REFERENCES public.hazards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote INTEGER CHECK (vote IN (-1, 0, 1)) DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  marked_fixed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (hazard_id, user_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.hazard_validations ENABLE ROW LEVEL SECURITY;

-- 4. Create Security Policies
CREATE POLICY "Hazard validations are viewable by everyone" 
  ON public.hazard_validations FOR SELECT 
  USING (true);

CREATE POLICY "Users can create their own validations" 
  ON public.hazard_validations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own validations" 
  ON public.hazard_validations FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own validations" 
  ON public.hazard_validations FOR DELETE 
  USING (auth.uid() = user_id);

-- 5. Trigger Function to Dynamically Calculate Stats and Reputation
-- Includes SPAM prevention: ignores actions from users with reputation < 30.
CREATE OR REPLACE FUNCTION public.update_hazard_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_upvotes INTEGER := 0;
  v_downvotes INTEGER := 0;
  v_verifications INTEGER := 0;
  v_fixed INTEGER := 0;
  v_trust INTEGER := 50;
  v_total_weight NUMERIC := 0;
  v_pos_weight NUMERIC := 0;
  v_neg_weight NUMERIC := 0;
  v_hazard_id TEXT;
  v_reporter_id UUID;
  v_rep_diff INTEGER := 0;
BEGIN
  -- Determine the target hazard ID
  IF TG_OP = 'DELETE' THEN
    v_hazard_id := OLD.hazard_id;
  ELSE
    v_hazard_id := NEW.hazard_id;
  END IF;

  -- Get validation aggregates, ignoring votes from low reputation users (Spam Prevention)
  SELECT 
    COALESCE(count(CASE WHEN v.vote = 1 THEN 1 END), 0),
    COALESCE(count(CASE WHEN v.vote = -1 THEN 1 END), 0),
    COALESCE(count(CASE WHEN v.verified = TRUE THEN 1 END), 0),
    COALESCE(count(CASE WHEN v.marked_fixed = TRUE THEN 1 END), 0)
  INTO v_upvotes, v_downvotes, v_verifications, v_fixed
  FROM public.hazard_validations v
  JOIN public.profiles p ON v.user_id = p.id
  WHERE v.hazard_id = v_hazard_id AND p.reputation >= 30;

  -- Calculate Trust Score (range 0 to 100)
  -- Upvotes and Verifications increase trust. Downvotes decrease trust.
  v_pos_weight := (v_upvotes * 10) + (v_verifications * 20);
  v_neg_weight := (v_downvotes * 25); -- Downvotes have higher weight to quickly flag issues
  v_total_weight := v_pos_weight + v_neg_weight;

  IF v_total_weight > 0 THEN
    v_trust := ROUND((v_pos_weight / v_total_weight) * 100);
  ELSE
    v_trust := 50; -- Neutral default score
  END IF;

  -- Update statistics directly in the hazards table
  UPDATE public.hazards
  SET 
    upvotes_count = v_upvotes,
    downvotes_count = v_downvotes,
    verifications_count = v_verifications,
    fixed_votes_count = v_fixed,
    trust_score = v_trust
  WHERE id = v_hazard_id;

  -- --- REPUTATION CALCULATION FOR REPORTER ---
  -- Locate reporter UUID from profiles by checking email or id match
  SELECT id INTO v_reporter_id 
  FROM public.profiles 
  WHERE id::text = (SELECT reported_by FROM public.hazards WHERE id = v_hazard_id)
     OR email = (SELECT reported_by FROM public.hazards WHERE id = v_hazard_id)
  LIMIT 1;

  IF v_reporter_id IS NOT NULL THEN
    -- Calculate difference in reputation based on operation type
    IF TG_OP = 'INSERT' THEN
      IF NEW.vote = 1 THEN v_rep_diff := v_rep_diff + 5; END IF;
      IF NEW.vote = -1 THEN v_rep_diff := v_rep_diff - 10; END IF;
      IF NEW.verified = TRUE THEN v_rep_diff := v_rep_diff + 15; END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Handle vote changes
      IF OLD.vote = 1 AND NEW.vote <> 1 THEN v_rep_diff := v_rep_diff - 5; END IF;
      IF OLD.vote <> 1 AND NEW.vote = 1 THEN v_rep_diff := v_rep_diff + 5; END IF;
      IF OLD.vote = -1 AND NEW.vote <> -1 THEN v_rep_diff := v_rep_diff + 10; END IF;
      IF OLD.vote <> -1 AND NEW.vote = -1 THEN v_rep_diff := v_rep_diff - 10; END IF;
      
      -- Handle verification changes
      IF OLD.verified = FALSE AND NEW.verified = TRUE THEN v_rep_diff := v_rep_diff + 15; END IF;
      IF OLD.verified = TRUE AND NEW.verified = FALSE THEN v_rep_diff := v_rep_diff - 15; END IF;
    ELSIF TG_OP = 'DELETE' THEN
      IF OLD.vote = 1 THEN v_rep_diff := v_rep_diff - 5; END IF;
      IF OLD.vote = -1 THEN v_rep_diff := v_rep_diff - 10; END IF;
      IF OLD.verified = TRUE THEN v_rep_diff := v_rep_diff - 15; END IF;
    END IF;

    -- Update reporter's reputation (ensure it stays positive)
    IF v_rep_diff <> 0 THEN
      UPDATE public.profiles
      SET reputation = GREATEST(0, reputation + v_rep_diff)
      WHERE id = v_reporter_id;
    END IF;
  END IF;

  -- --- AUTO-RESOLUTION ---
  -- If a hazard is active and has 3+ trusted fixed votes, set it to resolved.
  IF TG_OP <> 'DELETE' THEN
    IF v_fixed >= 3 AND (SELECT status FROM public.hazards WHERE id = v_hazard_id) = 'active' THEN
      UPDATE public.hazards
      SET status = 'resolved', resolved_at = timezone('utc'::text, now())
      WHERE id = v_hazard_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to updates on hazard_validations
CREATE OR REPLACE TRIGGER on_hazard_validation_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.hazard_validations
  FOR EACH ROW EXECUTE PROCEDURE public.update_hazard_stats();
