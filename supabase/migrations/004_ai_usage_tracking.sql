-- Migration 004: AI usage tracking per user
-- Tracks input/output tokens per API call for cost monitoring and usage limits

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Which AI call
  call_type TEXT NOT NULL CHECK (call_type IN (
    'chat', 'workout_analysis', 'daily_checkin', 'weekly_outlook',
    'recovery_alert', 'preference_extraction', 'plan_generation',
    'plan_modification', 'workout_creation', 'conversation_compression'
  )),
  
  -- Model used
  model TEXT NOT NULL DEFAULT 'gpt-4-turbo-preview',
  
  -- Token counts
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  
  -- Cost estimate (in USD cents to avoid float issues)
  cost_cents NUMERIC(10,4) DEFAULT 0,
  
  -- Metadata
  chat_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying user usage over time
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON public.ai_usage(user_id, created_at DESC);

-- RLS
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own AI usage" ON public.ai_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Handy view: monthly usage per user
CREATE OR REPLACE VIEW public.ai_usage_monthly AS
SELECT
  user_id,
  date_trunc('month', created_at) AS month,
  COUNT(*) AS total_calls,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(input_tokens + output_tokens) AS total_tokens,
  SUM(cost_cents) AS total_cost_cents
FROM public.ai_usage
GROUP BY user_id, date_trunc('month', created_at);
