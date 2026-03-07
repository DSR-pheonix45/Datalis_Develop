-- Fix column name mismatch: triggers reference "chat_sessions_created" 
-- but the actual column in usage_counters is "chat_sessions"
ALTER TABLE public.usage_counters 
  RENAME COLUMN chat_sessions TO chat_sessions_created;
