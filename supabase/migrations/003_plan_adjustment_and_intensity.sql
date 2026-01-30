-- Migration 003: Add plan_adjustment message type + intensity column on workouts

-- 1. Update message_type CHECK constraint on chat_messages to include plan_adjustment
-- Drop existing constraint and re-add with new value
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_message_type_check
  CHECK (message_type IN ('chat', 'workout_analysis', 'weekly_outlook', 'daily_checkin', 'recovery_alert', 'system', 'plan_adjustment'));

-- 2. Add intensity column to workouts table
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS intensity TEXT
  CHECK (intensity IN ('easy', 'moderate', 'hard', 'max'));

-- 3. Create index for scheduled workouts by date (used by adaptation engine)
CREATE INDEX IF NOT EXISTS idx_workouts_user_date_status 
  ON public.workouts(user_id, scheduled_date, status);
