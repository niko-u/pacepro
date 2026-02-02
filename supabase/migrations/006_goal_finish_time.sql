-- Fix goal_finish_time type mismatch: code writes TEXT but column was INTEGER
-- If the column doesn't exist yet, add it as TEXT
-- If it exists as INTEGER, alter the type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_plans' AND column_name = 'goal_finish_time'
  ) THEN
    ALTER TABLE training_plans ALTER COLUMN goal_finish_time TYPE TEXT USING goal_finish_time::TEXT;
  ELSE
    ALTER TABLE training_plans ADD COLUMN goal_finish_time TEXT;
  END IF;
END $$;
