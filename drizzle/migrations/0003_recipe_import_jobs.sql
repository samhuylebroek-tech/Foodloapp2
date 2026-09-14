create table if not exists public.recipe_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source_url text,
  canonical_url text,
  platform text not null default 'website',
  status text not null default 'klaar',
  extraction_method text,
  ai_used boolean not null default false,
  credits_used integer not null default 0,
  cache_hit boolean not null default false,
  duration_ms integer not null default 0,
  fields_found text[] not null default '{}',
  fields_missing text[] not null default '{}',
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

grant select on public.recipe_import_jobs to authenticated;
grant all on public.recipe_import_jobs to service_role;

alter table public.recipe_import_jobs enable row level security;

create policy "eigen importpogingen lezen"
  on public.recipe_import_jobs for select
  to authenticated
  using (auth.uid() = user_id);

create index if not exists recipe_import_jobs_created_idx on public.recipe_import_jobs (created_at desc);
create index if not exists recipe_import_jobs_platform_idx on public.recipe_import_jobs (platform);
create index if not exists recipe_import_jobs_canonical_idx on public.recipe_import_jobs (canonical_url);