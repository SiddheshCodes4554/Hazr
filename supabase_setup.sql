-- ==========================================
-- HAZR SUPABASE DATABASE CONFIGURATION SCRIPT
-- Run this in the Supabase SQL Editor
-- ==========================================

-- ------------------------------------------
-- 1. PROFILES TABLE (Role-Based Access Control)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('citizen', 'moderator', 'municipality')) DEFAULT 'citizen',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------
-- 2. HAZARDS TABLE (Incident Reports)
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.hazards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fire', 'flood', 'accident', 'roadblock', 'weather', 'other')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  reported_by TEXT NOT NULL, -- Stored as user email or uuid
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'resolved')) DEFAULT 'active',
  resolved_at TIMESTAMPTZ
);

-- Enable RLS for Hazards
ALTER TABLE public.hazards ENABLE ROW LEVEL SECURITY;

-- Hazards Policies
CREATE POLICY "Hazards are viewable by everyone" 
  ON public.hazards FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can insert hazards" 
  ON public.hazards FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Moderators and Municipalities can update hazards" 
  ON public.hazards FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('moderator', 'municipality')
    )
  );

-- ------------------------------------------
-- 3. TRIGGERS FOR PROFILE AUTO-CREATION
-- ------------------------------------------

-- Create user profile automatically when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'citizen')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  new.updated_at = timezone('utc'::text, now());
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- ------------------------------------------
-- 4. STORAGE BUCKET CONFIGURATION (Hazard Photos)
-- ------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hazard-photos', 'hazard-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop policies if they exist first to avoid SQL conflicts
DROP POLICY IF EXISTS "Public Access to Hazard Photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users can upload photos" ON storage.objects;

-- Create policies
CREATE POLICY "Public Access to Hazard Photos" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'hazard-photos');

CREATE POLICY "Authenticated Users can upload photos" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'hazard-photos' AND auth.role() = 'authenticated');

