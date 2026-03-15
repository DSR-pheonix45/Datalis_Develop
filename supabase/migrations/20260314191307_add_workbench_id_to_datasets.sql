ALTER TABLE public.user_datasets 
ADD COLUMN IF NOT EXISTS workbench_id UUID REFERENCES public.workbenches(id) ON DELETE CASCADE;

ALTER TABLE public.financial_records 
ADD COLUMN IF NOT EXISTS workbench_id UUID REFERENCES public.workbenches(id) ON DELETE CASCADE;
