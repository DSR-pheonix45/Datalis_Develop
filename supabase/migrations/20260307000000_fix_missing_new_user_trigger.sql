-- Fix: Create the missing trigger that binds handle_new_user() to auth.users
-- Without this trigger, signups create auth.users rows but never create
-- user_profiles, user_subscriptions, or usage_counters rows.
--
-- NOTE: This migration may not work via `supabase db push` because it targets
-- the auth schema. Run this SQL directly in the Supabase Dashboard SQL Editor.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
