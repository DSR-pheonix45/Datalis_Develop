create table if not exists public.template_rate_limits (
    id uuid default gen_random_uuid() primary key,
    ip_address text not null unique,
    generation_count integer default 1,
    last_generation_at timestamp with time zone default timezone('utc'::text, now())
);

-- Turn on RLS
alter table public.template_rate_limits enable row level security;

-- Only service role can access this table directly (via edge functions)
create policy "Service role has full access to template_rate_limits"
    on public.template_rate_limits
    for all
    using (auth.jwt() ->> 'role' = 'service_role');
