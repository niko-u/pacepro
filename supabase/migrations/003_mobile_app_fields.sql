-- Migration 003: Mobile App Fields
-- Adds columns and tables needed for PacePro mobile app
-- All user-variable fields from onboarding, settings, analytics

-- ===========================================
-- 1. New columns on profiles
-- ===========================================

-- Goal race details
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_race_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_race_distance TEXT; -- e.g. "140.6 mi", "26.2 mi"
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_race_location TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_goal_race BOOLEAN DEFAULT TRUE;

-- Primary training goal
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_goal TEXT
  CHECK (primary_goal IN ('finish', 'time', 'podium', 'faster', 'healthy'));

-- Training schedule preferences
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_training_time TEXT DEFAULT 'morning'
  CHECK (preferred_training_time IN ('morning', 'evening', 'both'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longer_workout_preference TEXT DEFAULT 'weekends'
  CHECK (longer_workout_preference IN ('weekdays', 'weekends', 'no_preference'));

-- Coach personality settings
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coach_style TEXT DEFAULT 'balanced'
  CHECK (coach_style IN ('push', 'balanced', 'supportive'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coach_response_length TEXT DEFAULT 'concise'
  CHECK (coach_response_length IN ('concise', 'detailed'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coach_focus_areas TEXT[] DEFAULT '{}';

-- Subscription billing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_billing_date DATE;

-- ===========================================
-- 2. Personal Records table
-- ===========================================
CREATE TABLE IF NOT EXISTS public.personal_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  -- What was achieved
  metric TEXT NOT NULL, -- e.g. '5K Time', 'Threshold Pace', 'Bike FTP', 'Swim CSS'
  value TEXT NOT NULL, -- e.g. '19:45', '6:52/mi', '220W', '1:24/100yd'
  value_seconds INTEGER, -- normalized value in seconds for comparison (optional)
  value_numeric DECIMAL(10,2), -- normalized numeric value for comparison (optional)
  unit TEXT, -- 'time', 'pace', 'power', 'pace_per_100'

  -- Context
  sport TEXT CHECK (sport IN ('swim', 'bike', 'run', 'strength', 'other')),
  source TEXT DEFAULT 'strava' CHECK (source IN ('strava', 'garmin', 'manual', 'whoop')),
  activity_id TEXT, -- external activity reference
  workout_id UUID REFERENCES public.workouts(id) ON DELETE SET NULL,

  -- Trend
  previous_value TEXT,
  trend TEXT CHECK (trend IN ('up', 'down', 'same')),

  achieved_at DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own records" ON public.personal_records
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_personal_records_user ON public.personal_records(user_id, achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_personal_records_metric ON public.personal_records(user_id, metric);

-- ===========================================
-- 3. Coach Insights table
-- ===========================================
CREATE TABLE IF NOT EXISTS public.coach_insights (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  -- Insight content
  insight_text TEXT NOT NULL,
  category TEXT CHECK (category IN ('performance', 'recovery', 'nutrition', 'technique', 'volume', 'general')),
  sport TEXT CHECK (sport IN ('swim', 'bike', 'run', 'overall')),
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'warning', 'negative')),

  -- Optional link to data
  metric_name TEXT, -- e.g. 'run_pace', 'ftp', 'sleep'
  metric_value TEXT, -- e.g. '8% faster', '220W (+5W)'
  
  -- Display
  icon_name TEXT, -- lucide icon name for display
  icon_color TEXT, -- hex color

  -- Lifecycle
  active BOOLEAN DEFAULT TRUE,
  expires_at DATE, -- insights can age out
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.coach_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights" ON public.coach_insights
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage insights" ON public.coach_insights
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_coach_insights_user_active ON public.coach_insights(user_id, active, created_at DESC);

-- ===========================================
-- 4. Analytics Snapshots table (daily fitness metrics)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  date DATE NOT NULL,

  -- Training load metrics (CTL/ATL/TSB model)
  fitness_score INTEGER, -- Chronic Training Load (CTL) — 0-100
  fatigue_score INTEGER, -- Acute Training Load (ATL) — 0-100
  form_score INTEGER, -- Training Stress Balance (TSB) — can be negative
  readiness_score INTEGER CHECK (readiness_score BETWEEN 0 AND 100), -- Overall race readiness

  -- Weekly volume (hours)
  swim_hours DECIMAL(4,2) DEFAULT 0,
  bike_hours DECIMAL(4,2) DEFAULT 0,
  run_hours DECIMAL(4,2) DEFAULT 0,
  strength_hours DECIMAL(4,2) DEFAULT 0,
  total_hours DECIMAL(5,2) DEFAULT 0,

  -- Weekly distance (meters)
  swim_distance INTEGER DEFAULT 0,
  bike_distance INTEGER DEFAULT 0,
  run_distance INTEGER DEFAULT 0,

  -- Training stress
  training_stress_score DECIMAL(6,2), -- TSS equivalent

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date)
);

ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots" ON public.analytics_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage snapshots" ON public.analytics_snapshots
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_user_date ON public.analytics_snapshots(user_id, date DESC);

-- ===========================================
-- 5. Add Oura to integrations provider constraint
-- ===========================================
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;
ALTER TABLE public.integrations ADD CONSTRAINT integrations_provider_check
  CHECK (provider IN ('strava', 'whoop', 'garmin', 'apple_health', 'oura'));

-- ===========================================
-- 6. Indexes for common query patterns
-- ===========================================

-- Workouts by user + date (calendar view)
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON public.workouts(user_id, scheduled_date);

-- Chat messages by user (recent first)
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON public.chat_messages(user_id, created_at DESC);

-- Active training plans
CREATE INDEX IF NOT EXISTS idx_training_plans_active ON public.training_plans(user_id, status) WHERE status = 'active';
