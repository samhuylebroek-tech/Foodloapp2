create table public.loyalty_stores (
  slug text primary key,
  naam text not null,
  kleur text not null default '#0f766e',
  standaard_formaat text not null default 'CODE128',
  actief boolean not null default true,
  volgorde integer not null default 100,
  created_at timestamptz not null default now()
);
grant select on public.loyalty_stores to authenticated, anon;
grant all on public.loyalty_stores to service_role;
alter table public.loyalty_stores enable row level security;
create policy loyalty_stores_read on public.loyalty_stores for select to authenticated, anon using (actief);

create table public.loyalty_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_slug text,
  winkel_naam text not null,
  kaartnaam text not null default '',
  nummer text not null,
  formaat text not null default 'CODE128',
  favoriet boolean not null default false,
  gedeeld boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.loyalty_cards to authenticated;
grant all on public.loyalty_cards to service_role;
alter table public.loyalty_cards enable row level security;
create policy loyalty_cards_own on public.loyalty_cards for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy loyalty_cards_groep on public.loyalty_cards for select to authenticated
  using (gedeeld and public.samen_in_groep(user_id, auth.uid()));
create index loyalty_cards_user_idx on public.loyalty_cards(user_id);

create trigger loyalty_cards_updated before update on public.loyalty_cards
for each row execute function public.update_updated_at_column();

create table public.loyalty_scan_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  methode text not null,
  formaat text,
  store_slug text,
  ok boolean not null default true,
  reden text,
  created_at timestamptz not null default now()
);
grant insert on public.loyalty_scan_events to authenticated;
grant all on public.loyalty_scan_events to service_role;
alter table public.loyalty_scan_events enable row level security;
create policy loyalty_scan_insert on public.loyalty_scan_events for insert to authenticated
  with check (auth.uid() = user_id);