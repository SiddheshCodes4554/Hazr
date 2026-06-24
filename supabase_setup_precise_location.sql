-- ========================================================
-- HAZR SUPABASE DATABASE CONFIGURATION - PRECISE LOCATION
-- Run this in the Supabase SQL Editor to add precise location support
-- ========================================================

ALTER TABLE public.hazards 
ADD COLUMN IF NOT EXISTS reporter_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS reporter_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS reporter_address TEXT,
ADD COLUMN IF NOT EXISTS hazard_address TEXT;
