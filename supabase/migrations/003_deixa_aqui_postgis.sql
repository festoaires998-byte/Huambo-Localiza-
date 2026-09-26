-- LOCALIZA — Deixa Aqui spatial discovery
-- Reuses the canonical address coordinates and exposes a safe proximity function.
alter table public.deixa_aqui_points
  add column if not exists location geography(Point,4326);

update public.deixa_aqui_points p
set location = a.location
from public.addresses a
where p.address_id = a.id
  and p.location is null
  and a.location is not null;

create index if not exists idx_deixa_aqui_points_location_gist
  on public.deixa_aqui_points using gist(location);

create or replace function public.find_deixa_aqui_points(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters integer default 200
)
returns table (
  id uuid,
  name text,
  point_type text,
  address_id uuid,
  distance_meters double precision,
  capacity_limit integer,
  opening_hours jsonb,
  instructions text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.point_type,
    p.address_id,
    st_distance(
      p.location,
      st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography
    ) as distance_meters,
    p.capacity_limit,
    p.opening_hours,
    p.instructions
  from public.deixa_aqui_points p
  where p.status = 'ACTIVE'
    and p.accepts_deliveries = true
    and p.location is not null
    and st_dwithin(
      p.location,
      st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
      greatest(1, p_radius_meters)
    )
  order by p.location <-> st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography
  limit 20;
$$;

revoke all on function public.find_deixa_aqui_points(double precision,double precision,integer) from public;
grant execute on function public.find_deixa_aqui_points(double precision,double precision,integer) to anon, authenticated;
