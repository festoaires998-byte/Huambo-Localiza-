-- LOCALIZA — Supabase Realtime tracking foundation
create table if not exists public.delivery_tracking (
  delivery_id uuid primary key references public.deliveries(id) on delete cascade,
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  updated_by uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  constraint delivery_tracking_coordinates_check check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

alter table public.delivery_tracking enable row level security;

drop policy if exists "delivery_tracking_select_relevant" on public.delivery_tracking;
create policy "delivery_tracking_select_relevant"
on public.delivery_tracking for select to authenticated
using (
  exists (
    select 1 from public.deliveries d
    where d.id = delivery_id
      and (
        d.created_by = (select auth.uid())
        or d.assigned_driver = (select auth.uid())
        or is_admin((select auth.uid()))
      )
  )
);

drop policy if exists "delivery_tracking_insert_relevant" on public.delivery_tracking;
create policy "delivery_tracking_insert_relevant"
on public.delivery_tracking for insert to authenticated
with check (
  updated_by = (select auth.uid())
  and exists (
    select 1 from public.deliveries d
    where d.id = delivery_id
      and (
        d.assigned_driver = (select auth.uid())
        or d.created_by = (select auth.uid())
        or is_admin((select auth.uid()))
      )
  )
);

drop policy if exists "delivery_tracking_update_relevant" on public.delivery_tracking;
create policy "delivery_tracking_update_relevant"
on public.delivery_tracking for update to authenticated
using (
  exists (
    select 1 from public.deliveries d
    where d.id = delivery_id
      and (
        d.assigned_driver = (select auth.uid())
        or d.created_by = (select auth.uid())
        or is_admin((select auth.uid()))
      )
  )
)
with check (updated_by = (select auth.uid()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'delivery_tracking'
  ) then
    alter publication supabase_realtime add table public.delivery_tracking;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'deliveries'
  ) then
    alter publication supabase_realtime add table public.deliveries;
  end if;
end $$;
