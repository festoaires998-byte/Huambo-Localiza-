-- LOCALIZA — Deixa Aqui (PUDO) foundation
-- Adds an optional, reusable drop-off/pick-up point layer without altering
-- existing addresses or delivery flows.

create table if not exists public.deixa_aqui_points (
  id uuid primary key default gen_random_uuid(),
  address_id uuid not null references public.addresses(id) on delete restrict,
  country_code text not null default 'AO' references public.country_configs(country_code),
  name text not null,
  point_type text not null default 'COMMUNITY'
    check (point_type in ('SHOP','PHARMACY','MARKET','COMMUNITY','OFFICE','OTHER')),
  status text not null default 'PROPOSED'
    check (status in ('PROPOSED','VERIFIED','ACTIVE','PAUSED','INACTIVE')),
  accepts_deliveries boolean not null default false,
  capacity_limit integer check (capacity_limit is null or capacity_limit > 0),
  contact_name text,
  contact_phone text,
  opening_hours jsonb not null default '{}'::jsonb,
  instructions text,
  notes text,
  verified_by uuid,
  verified_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (address_id)
);

create index if not exists idx_deixa_aqui_points_address_id
  on public.deixa_aqui_points(address_id);

create index if not exists idx_deixa_aqui_points_country_status
  on public.deixa_aqui_points(country_code, status);

create index if not exists idx_deixa_aqui_points_active
  on public.deixa_aqui_points(status, accepts_deliveries);

alter table public.deixa_aqui_points enable row level security;

drop policy if exists "deixa_aqui_public_read_active" on public.deixa_aqui_points;
create policy "deixa_aqui_public_read_active"
on public.deixa_aqui_points
for select
to anon, authenticated
using (
  status = 'ACTIVE'
  and accepts_deliveries = true
);

create or replace function public.set_deixa_aqui_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_deixa_aqui_updated_at on public.deixa_aqui_points;
create trigger trg_deixa_aqui_updated_at
before update on public.deixa_aqui_points
for each row execute function public.set_deixa_aqui_updated_at();

-- The table is prepared for Supabase Realtime; no delivery flow depends on it yet.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'deixa_aqui_points'
  ) then
    alter publication supabase_realtime add table public.deixa_aqui_points;
  end if;
exception
  when undefined_object then
    null;
end;
$$;
