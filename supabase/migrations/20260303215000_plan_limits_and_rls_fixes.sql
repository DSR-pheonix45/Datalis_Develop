-- 1. Table Schema Updates
ALTER TABLE "public"."plans" ADD COLUMN IF NOT EXISTS "max_uploads" integer DEFAULT 100;
ALTER TABLE "public"."usage_counters" ADD COLUMN IF NOT EXISTS "uploads_created" integer DEFAULT 0;

-- 2. Utility Functions (SECURITY DEFINER)
-- Bypasses RLS to check membership or log activity

CREATE OR REPLACE FUNCTION "public"."is_workbench_member"("wb_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  return exists (
    select 1 from public.workbench_members
    where workbench_id = wb_id
    and user_id = auth.uid()
  );
end;
$$;

CREATE OR REPLACE FUNCTION "public"."log_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    v_workbench_id uuid;
    v_user_id uuid;
begin
    begin
        v_workbench_id := NEW.workbench_id;
    exception when others then
        v_workbench_id := null;
    end;

    v_user_id := auth.uid();
    if v_user_id is null then
        begin
            v_user_id := coalesce(NEW.user_id, NEW.created_by, NEW.uploaded_by);
        exception when others then
            v_user_id := null;
        end;
    end if;

    insert into public.audit_logs (
        workbench_id,
        user_id,
        action,
        entity_type,
        entity_id,
        old_data,
        new_data
    ) values (
        v_workbench_id,
        v_user_id,
        TG_OP,
        TG_TABLE_NAME,
        coalesce(NEW.id, OLD.id),
        case when TG_OP in ('UPDATE', 'DELETE') then row_to_json(OLD)::jsonb else null end,
        case when TG_OP in ('INSERT', 'UPDATE') then row_to_json(NEW)::jsonb else null end
    );

    if TG_OP = 'DELETE' then
        return OLD;
    end if;
    return NEW;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."check_plan_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    v_user_id uuid;
    v_plan_id text;
    v_limit integer;
    v_usage integer;
    v_month date;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        v_user_id := coalesce(NEW.user_id, NEW.created_by, NEW.uploaded_by);
    end if;

    if v_user_id is null then
        return NEW;
    end if;

    select plan_id into v_plan_id from public.user_subscriptions where user_id = v_user_id and status = 'active' limit 1;
    v_month := date_trunc('month', now())::date;

    if TG_TABLE_NAME = 'workbenches' then
        select max_workbenches into v_limit from public.plans where id = v_plan_id;
        select workbenches_created into v_usage from public.usage_counters where user_id = v_user_id and month = v_month;
        if v_usage >= v_limit then raise exception 'Workbench creation limit reached for your plan (%)', v_plan_id; end if;
    elsif TG_TABLE_NAME = 'chat_sessions' then
        select max_chat_sessions into v_limit from public.plans where id = v_plan_id;
        select chat_sessions_created into v_usage from public.usage_counters where user_id = v_user_id and month = v_month;
        if v_usage >= v_limit then raise exception 'Chat session limit reached for your plan (%)', v_plan_id; end if;
    elsif TG_TABLE_NAME = 'workbench_documents' then
        select max_uploads into v_limit from public.plans where id = v_plan_id;
        select uploads_created into v_usage from public.usage_counters where user_id = v_user_id and month = v_month;
        if v_usage >= v_limit then raise exception 'Upload limit reached for your plan (%)', v_plan_id; end if;
    end if;

    return NEW;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."increment_usage_counter"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    v_user_id uuid;
    v_month date;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        v_user_id := coalesce(NEW.user_id, NEW.created_by, NEW.uploaded_by);
    end if;

    if v_user_id is null then
        return NEW;
    end if;

    v_month := date_trunc('month', now())::date;

    insert into public.usage_counters (user_id, subscription_id, month, workbenches_created, chat_sessions_created, uploads_created)
    select v_user_id, id, v_month, 0, 0, 0
    from public.user_subscriptions 
    where user_id = v_user_id and status = 'active'
    limit 1
    on conflict (user_id, month) do nothing;

    if TG_TABLE_NAME = 'workbenches' then
        update public.usage_counters set workbenches_created = workbenches_created + 1 where user_id = v_user_id and month = v_month;
    elsif TG_TABLE_NAME = 'chat_sessions' then
        update public.usage_counters set chat_sessions_created = chat_sessions_created + 1 where user_id = v_user_id and month = v_month;
    elsif TG_TABLE_NAME = 'workbench_documents' then
        update public.usage_counters set uploads_created = uploads_created + 1 where user_id = v_user_id and month = v_month;
    end if;

    return NEW;
end;
$$;

-- 3. Standardize RLS Policies
-- Use SECURITY DEFINER function to reliably check membership

-- workbench_documents
DROP POLICY IF EXISTS "Members can read documents" ON "public"."workbench_documents";
CREATE POLICY "Members can read documents" ON "public"."workbench_documents" FOR SELECT USING ("public"."is_workbench_member"("workbench_id"));
DROP POLICY IF EXISTS "Members can insert documents" ON "public"."workbench_documents";
CREATE POLICY "Members can insert documents" ON "public"."workbench_documents" FOR INSERT WITH CHECK ("public"."is_workbench_member"("workbench_id"));
DROP POLICY IF EXISTS "Members can update documents" ON "public"."workbench_documents";
CREATE POLICY "Members can update documents" ON "public"."workbench_documents" FOR UPDATE USING ("public"."is_workbench_member"("workbench_id"));
DROP POLICY IF EXISTS "Members can delete documents" ON "public"."workbench_documents";
CREATE POLICY "Members can delete documents" ON "public"."workbench_documents" FOR DELETE USING ("public"."is_workbench_member"("workbench_id"));

-- adjustments
DROP POLICY IF EXISTS "Users can view adjustments of their workbenches" ON "public"."adjustments";
CREATE POLICY "Users can view adjustments of their workbenches" ON "public"."adjustments" FOR SELECT USING ("public"."is_workbench_member"("workbench_id"));

-- ledger_entries
DROP POLICY IF EXISTS "Users can view ledger entries of their workbenches" ON "public"."ledger_entries";
CREATE POLICY "Users can view ledger entries of their workbenches" ON "public"."ledger_entries" FOR SELECT USING ("public"."is_workbench_member"("workbench_id"));

-- workbench_records
DROP POLICY IF EXISTS "Members can update records" ON "public"."workbench_records";
CREATE POLICY "Members can update records" ON "public"."workbench_records" FOR UPDATE USING ("public"."is_workbench_member"("workbench_id"));
DROP POLICY IF EXISTS "records_select_all_members" ON "public"."workbench_records";
CREATE POLICY "records_select_all_members" ON "public"."workbench_records" FOR SELECT USING ("public"."is_workbench_member"("workbench_id"));

-- 4. Triggers
DROP TRIGGER IF EXISTS tr_workbenches_check_limit ON public.workbenches;
CREATE TRIGGER tr_workbenches_check_limit BEFORE INSERT ON public.workbenches FOR EACH ROW EXECUTE FUNCTION public.check_plan_limit();
DROP TRIGGER IF EXISTS tr_workbenches_increment ON public.workbenches;
CREATE TRIGGER tr_workbenches_increment AFTER INSERT ON public.workbenches FOR EACH ROW EXECUTE FUNCTION public.increment_usage_counter();
DROP TRIGGER IF EXISTS tr_workbenches_audit ON public.workbenches;
CREATE TRIGGER tr_workbenches_audit AFTER INSERT OR UPDATE OR DELETE ON public.workbenches FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS tr_chat_sessions_check_limit ON public.chat_sessions;
CREATE TRIGGER tr_chat_sessions_check_limit BEFORE INSERT ON public.chat_sessions FOR EACH ROW EXECUTE FUNCTION public.check_plan_limit();
DROP TRIGGER IF EXISTS tr_chat_sessions_increment ON public.chat_sessions;
CREATE TRIGGER tr_chat_sessions_increment AFTER INSERT ON public.chat_sessions FOR EACH ROW EXECUTE FUNCTION public.increment_usage_counter();
DROP TRIGGER IF EXISTS tr_chat_sessions_audit ON public.chat_sessions;
CREATE TRIGGER tr_chat_sessions_audit AFTER INSERT OR UPDATE OR DELETE ON public.chat_sessions FOR EACH ROW EXECUTE FUNCTION public.log_activity();

DROP TRIGGER IF EXISTS tr_workbench_documents_check_limit ON public.workbench_documents;
CREATE TRIGGER tr_workbench_documents_check_limit BEFORE INSERT ON public.workbench_documents FOR EACH ROW EXECUTE FUNCTION public.check_plan_limit();
DROP TRIGGER IF EXISTS tr_workbench_documents_increment ON public.workbench_documents;
CREATE TRIGGER tr_workbench_documents_increment AFTER INSERT ON public.workbench_documents FOR EACH ROW EXECUTE FUNCTION public.increment_usage_counter();
DROP TRIGGER IF EXISTS tr_workbench_documents_audit ON public.workbench_documents;
CREATE TRIGGER tr_workbench_documents_audit AFTER INSERT OR UPDATE OR DELETE ON public.workbench_documents FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- 5. Update Plan Data (SQL version)
INSERT INTO public.plans (id, name, max_workbenches, max_chat_sessions, max_uploads, retention_days, price_inr)
VALUES 
    ('free', 'Free', 1, 5, 10, 30, 0),
    ('go', 'Go', 5, 25, 100, 365, 3999),
    ('pro', 'Pro', 25, 100, 500, 1095, 14999)
ON CONFLICT (id) DO UPDATE SET
    max_workbenches = EXCLUDED.max_workbenches,
    max_chat_sessions = EXCLUDED.max_chat_sessions,
    max_uploads = EXCLUDED.max_uploads,
    retention_days = EXCLUDED.retention_days,
    price_inr = EXCLUDED.price_inr;
