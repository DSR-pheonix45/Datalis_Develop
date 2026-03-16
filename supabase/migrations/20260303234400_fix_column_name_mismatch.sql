-- Fix column name mismatch: triggers reference "chat_sessions_created" 
-- but the actual column in usage_counters is "chat_sessions"
DO $$
BEGIN
  IF EXISTS(SELECT *
    FROM information_schema.columns
    WHERE table_name='usage_counters' and column_name='chat_sessions')
  THEN
      ALTER TABLE public.usage_counters RENAME COLUMN chat_sessions TO chat_sessions_created;
  END IF;
END $$;
