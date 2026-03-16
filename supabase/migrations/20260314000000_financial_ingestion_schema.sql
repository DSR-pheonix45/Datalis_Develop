-- Migration to support Financial Data Ingestion Pipeline (Steps 6-10)

-- 1. Create parent `user_datasets` table
CREATE TABLE IF NOT EXISTS public.user_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    row_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    quality_score INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS logic for user_datasets
ALTER TABLE public.user_datasets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own datasets" ON public.user_datasets;
CREATE POLICY "Users can manage their own datasets" 
ON public.user_datasets FOR ALL 
USING (auth.uid() = user_id);

-- 2. Create `column_mappings` table for memorizing saved configurations
CREATE TABLE IF NOT EXISTS public.column_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES public.user_datasets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mapping JSONB NOT NULL,
    mapping_name TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS logic for column_mappings
ALTER TABLE public.column_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own column mappings" ON public.column_mappings;
CREATE POLICY "Users can manage their own column mappings" 
ON public.column_mappings FOR ALL 
USING (auth.uid() = user_id);

-- 3. Create the canonical financial records table
CREATE TABLE IF NOT EXISTS public.financial_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES public.user_datasets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    amount NUMERIC NOT NULL,
    category TEXT DEFAULT 'Uncategorized',
    counterparty TEXT DEFAULT 'Unknown',
    account TEXT DEFAULT 'Default',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for high-performance frontend queries
CREATE INDEX IF NOT EXISTS idx_financial_records_user_id ON public.financial_records(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_dataset_id ON public.financial_records(dataset_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_date ON public.financial_records(transaction_date);
CREATE INDEX IF NOT EXISTS idx_financial_records_category ON public.financial_records(category);

-- 2. Setup Row Level Security (RLS) for financial_records
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own financial records" ON public.financial_records;
CREATE POLICY "Users can view their own financial records"
ON public.financial_records FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own financial records" ON public.financial_records;
CREATE POLICY "Users can insert their own financial records"
ON public.financial_records FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own financial records" ON public.financial_records;
CREATE POLICY "Users can update their own financial records"
ON public.financial_records FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own financial records" ON public.financial_records;
CREATE POLICY "Users can delete their own financial records"
ON public.financial_records FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 3. Create 'raw_imports' Storage Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('raw_imports', 'raw_imports', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Set up Storage RLS Policies for the bucket
-- Allow authenticated users to upload files to their own directory
DROP POLICY IF EXISTS "Users can upload raw imports" ON storage.objects;
CREATE POLICY "Users can upload raw imports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'raw_imports' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to view their own uploaded files
DROP POLICY IF EXISTS "Users can view their own raw imports" ON storage.objects;
CREATE POLICY "Users can view their own raw imports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'raw_imports' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own uploaded files
DROP POLICY IF EXISTS "Users can delete their own raw imports" ON storage.objects;
CREATE POLICY "Users can delete their own raw imports"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'raw_imports' AND (storage.foldername(name))[1] = auth.uid()::text);
