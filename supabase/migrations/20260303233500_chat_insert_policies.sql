-- Add INSERT and DELETE policies for chat_sessions and chat_messages
-- These allow the authenticated user to create and manage their own chat data

-- chat_sessions: Users can create their own sessions
DROP POLICY IF EXISTS "Users can insert own chat sessions" ON "public"."chat_sessions";
CREATE POLICY "Users can insert own chat sessions" 
  ON "public"."chat_sessions" FOR INSERT 
  WITH CHECK (("auth"."uid"() = "user_id"));

-- chat_sessions: Users can delete their own sessions
DROP POLICY IF EXISTS "Users can delete own chat sessions" ON "public"."chat_sessions";
CREATE POLICY "Users can delete own chat sessions" 
  ON "public"."chat_sessions" FOR DELETE 
  USING (("auth"."uid"() = "user_id"));

-- chat_messages: Users can insert messages in their own sessions
DROP POLICY IF EXISTS "Users can insert own chat messages" ON "public"."chat_messages";
CREATE POLICY "Users can insert own chat messages" 
  ON "public"."chat_messages" FOR INSERT 
  WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chat_sessions"
  WHERE (("chat_sessions"."id" = "chat_messages"."session_id") AND ("chat_sessions"."user_id" = "auth"."uid"())))));

-- chat_messages: Users can delete messages from their own sessions
DROP POLICY IF EXISTS "Users can delete own chat messages" ON "public"."chat_messages";
CREATE POLICY "Users can delete own chat messages" 
  ON "public"."chat_messages" FOR DELETE 
  USING ((EXISTS ( SELECT 1
   FROM "public"."chat_sessions"
  WHERE (("chat_sessions"."id" = "chat_messages"."session_id") AND ("chat_sessions"."user_id" = "auth"."uid"())))));
