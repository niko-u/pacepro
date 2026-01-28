-- Migration: Coach Intelligence Features
-- Adds: recovery_data, enhanced profiles, workout analysis, message types

-- 1. Add new fields to profiles for preferences and onboarding
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}';

-- Structured preferences (from onboarding + extracted from chat)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{
  "workout_likes": [],
  "workout_dislikes": [],
  "push_tolerance": 3,
  "recovery_needs": 3,
  "flexibility": 3,
  "feedback_style": "balanced"
}';

-- Extracted preferences (learned from conversations)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS learned_preferences JSONB DEFAULT '{
  "schedule_constraints": [],
  "recovery_notes": [],
  "limitations": [],
  "life_context": []
}';

-- Conversation summary for long-term memory
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS conversation_summary TEXT;

-- Notification preferences
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notifications JSONB DEFAULT '{
  "daily_reminder": true,
  "post_workout": true,
  "weekly_outlook": true,
  "recovery_alerts": true,
  "marketing": false
}';

-- 2. Add Strava ID and analysis to workouts
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS strava_activity_id BIGINT;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS analysis JSONB DEFAULT '{}';
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS coach_notes TEXT;

-- Index for Strava activity lookup
CREATE INDEX IF NOT EXISTS idx_workouts_strava_activity_id ON public.workouts(strava_activity_id);

-- 3. Add message type and metadata to chat_messages
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'chat' 
  CHECK (message_type IN ('chat', 'workout_analysis', 'weekly_outlook', 'daily_checkin', 'recovery_alert', 'system'));
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 4. Recovery data table (time-series from WHOOP, Garmin, Apple Health)
CREATE TABLE IF NOT EXISTS public.recovery_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  date DATE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('whoop', 'garmin', 'apple_health', 'manual')),
  
  -- Core metrics
  recovery_score INTEGER CHECK (recovery_score BETWEEN 0 AND 100),
  hrv_ms DECIMAL(6,2), -- Heart rate variability in ms
  resting_hr INTEGER,
  
  -- Sleep
  sleep_hours DECIMAL(4,2),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 0 AND 100),
  sleep_stages JSONB DEFAULT '{}', -- deep, rem, light, awake
  
  -- Strain/Load
  strain_score DECIMAL(4,2),
  training_load INTEGER,
  
  -- Additional data
  body_battery INTEGER,
  stress_level INTEGER,
  
  -- Raw data from provider
  raw_data JSONB DEFAULT '{}',
  
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, date, source)
);

-- Enable RLS on recovery_data
ALTER TABLE public.recovery_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own recovery data" ON public.recovery_data
  FOR ALL USING (auth.uid() = user_id);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_recovery_data_user_date ON public.recovery_data(user_id, date DESC);

-- 5. Training plan phase tracking
ALTER TABLE public.training_plans ADD COLUMN IF NOT EXISTS current_phase TEXT 
  CHECK (current_phase IN ('base', 'build', 'peak', 'taper', 'recovery'));
ALTER TABLE public.training_plans ADD COLUMN IF NOT EXISTS current_week INTEGER DEFAULT 1;
ALTER TABLE public.training_plans ADD COLUMN IF NOT EXISTS total_weeks INTEGER;

-- 6. Webhook events log (for debugging and idempotency)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_id TEXT, -- Provider's event ID for idempotency
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(provider, event_id)
);

-- Index for unprocessed events
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON public.webhook_events(provider, processed) WHERE NOT processed;

-- 7. Scheduled messages (for cron jobs to pick up)
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  message_type TEXT NOT NULL CHECK (message_type IN ('weekly_outlook', 'daily_checkin', 'recovery_alert', 'custom')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  
  content TEXT, -- Pre-generated content, or null to generate on send
  metadata JSONB DEFAULT '{}',
  
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for pending messages
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending 
  ON public.scheduled_messages(scheduled_for) 
  WHERE NOT sent;

-- Enable RLS
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled messages" ON public.scheduled_messages
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all (for cron jobs)
CREATE POLICY "Service can manage all scheduled messages" ON public.scheduled_messages
  FOR ALL USING (auth.role() = 'service_role');

-- 8. Add Strava athlete ID to integrations for webhook matching
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS strava_athlete_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_integrations_strava_athlete ON public.integrations(strava_athlete_id) WHERE provider = 'strava';
