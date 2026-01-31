-- Migration: Workout Analytics & Training Load
-- Adds: workout_analytics, training_load tables for comprehensive metrics tracking

-- 1. Workout analytics — derived metrics from stream data
CREATE TABLE IF NOT EXISTS public.workout_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Zone distribution (percentage of time in each zone)
  hr_zones JSONB DEFAULT '{}',      -- {z1: 30, z2: 45, z3: 15, z4: 8, z5: 2}
  pace_zones JSONB DEFAULT '{}',
  power_zones JSONB DEFAULT '{}',

  -- Core metrics
  training_stress_score NUMERIC,     -- TSS or rTSS or sTSS
  intensity_factor NUMERIC,
  normalized_power NUMERIC,          -- cycling
  normalized_graded_pace NUMERIC,    -- running (sec/km)
  variability_index NUMERIC,
  efficiency_factor NUMERIC,

  -- Decoupling
  aerobic_decoupling NUMERIC,        -- percentage drift

  -- Splits
  splits JSONB DEFAULT '[]',         -- [{km: 1, pace: 285, hr: 145}, ...]

  -- Zone compliance (vs prescribed)
  zone_compliance_score NUMERIC,     -- 0-100
  zone_compliance_details JSONB DEFAULT '{}',

  -- Cadence
  avg_cadence NUMERIC,
  cadence_variability NUMERIC,

  -- Elevation
  total_ascent NUMERIC,
  total_descent NUMERIC,
  grade_adjusted_pace NUMERIC,

  -- Running specific
  trimp NUMERIC,

  -- Meta
  analysis_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_analytics_user ON public.workout_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_analytics_workout ON public.workout_analytics(workout_id);

-- 2. Training load tracking (daily aggregates)
CREATE TABLE IF NOT EXISTS public.training_load (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  daily_tss NUMERIC DEFAULT 0,
  atl NUMERIC,              -- Acute Training Load (7-day)
  ctl NUMERIC,              -- Chronic Training Load (42-day)
  tsb NUMERIC,              -- Training Stress Balance (form)
  resting_hr NUMERIC,
  hrv NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_training_load_user_date ON public.training_load(user_id, date);

-- 3. Enable RLS
ALTER TABLE public.workout_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_load ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analytics" ON public.workout_analytics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can manage analytics" ON public.workout_analytics
  FOR ALL USING (true);

CREATE POLICY "Users can view own training load" ON public.training_load
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can manage training load" ON public.training_load
  FOR ALL USING (true);
