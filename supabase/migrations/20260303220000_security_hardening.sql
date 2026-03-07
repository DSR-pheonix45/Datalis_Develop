-- SECURITY HARDENING MIGRATION
-- Addressing findings from findings.md

-- 1. SECURE SECURITY DEFINER FUNCTIONS
ALTER FUNCTION public.accept_invite(text) SET search_path = public;
ALTER FUNCTION public.is_workbench_member(uuid) SET search_path = public;
ALTER FUNCTION public.process_new_transaction() SET search_path = public;
ALTER FUNCTION public.log_activity() SET search_path = public;
ALTER FUNCTION public.check_plan_limit() SET search_path = public;
ALTER FUNCTION public.increment_usage_counter() SET search_path = public;

-- 2. ENABLE RLS ON MISSING TABLES
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbench_invites ENABLE ROW LEVEL SECURITY;

-- 3. DEFINE RLS POLICIES

-- Plans (Read for everyone, no write)
DROP POLICY IF EXISTS "Plans are viewable by everyone" ON public.plans;
CREATE POLICY "Plans are viewable by everyone" ON public.plans FOR SELECT USING (true);

-- User Subscriptions (Read for self, no direct write)
DROP POLICY IF EXISTS "Users can view own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscription" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Usage Counters (Read for self, no direct write)
DROP POLICY IF EXISTS "Users can view own usage counters" ON public.usage_counters;
CREATE POLICY "Users can view own usage counters" ON public.usage_counters FOR SELECT USING (auth.uid() = user_id);

-- Party Accounts (Read for workbench members)
DROP POLICY IF EXISTS "Members can view party accounts" ON public.party_accounts;
CREATE POLICY "Members can view party accounts" ON public.party_accounts FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.workbench_parties p
        WHERE p.id = party_accounts.party_id
        AND public.is_workbench_member(p.workbench_id)
    )
);

-- Inventory Items (Read for members)
DROP POLICY IF EXISTS "Members can view inventory items" ON public.inventory_items;
CREATE POLICY "Members can view inventory items" ON public.inventory_items FOR SELECT USING (public.is_workbench_member(workbench_id));

DROP POLICY IF EXISTS "Members can manage inventory items" ON public.inventory_items;
CREATE POLICY "Members can manage inventory items" ON public.inventory_items FOR ALL USING (
    public.is_workbench_member(workbench_id) AND 
    (SELECT role FROM public.workbench_members WHERE workbench_id = inventory_items.workbench_id AND user_id = auth.uid()) = ANY (ARRAY['founder', 'ca', 'analyst'])
);

-- Workbench Invites (Read for invited email or inviter)
DROP POLICY IF EXISTS "Invites are viewable by inviter or invited" ON public.workbench_invites;
CREATE POLICY "Invites are viewable by inviter or invited" ON public.workbench_invites FOR SELECT USING (
    auth.uid() = invited_by OR 
    (SELECT email FROM auth.users WHERE id = auth.uid()) = email
);

-- 4. UPDATE FOREIGN KEY CASCADES
-- We need to drop and recreate them to add the ON DELETE behavior

-- Budgets
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_workbench_id_fkey;
ALTER TABLE public.budgets ADD CONSTRAINT budgets_workbench_id_fkey FOREIGN KEY (workbench_id) REFERENCES public.workbenches(id) ON DELETE CASCADE;

-- Transactions
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_party_account_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_party_account_id_fkey FOREIGN KEY (party_account_id) REFERENCES public.party_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_party_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.workbench_parties(id) ON DELETE SET NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_source_document_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES public.workbench_documents(id) ON DELETE SET NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_workbench_account_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_workbench_account_id_fkey FOREIGN KEY (workbench_account_id) REFERENCES public.workbench_accounts(id) ON DELETE SET NULL;

-- Workbench Records
ALTER TABLE public.workbench_records DROP CONSTRAINT IF EXISTS workbench_records_document_id_fkey;
ALTER TABLE public.workbench_records ADD CONSTRAINT workbench_records_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.workbench_documents(id) ON DELETE SET NULL;

-- Audit Logs User
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
