-- LOCALIZA — associate an optional Deixa Aqui point with a delivery
create table if not exists public.delivery_deixa_aqui (
  delivery_id uuid primary key references public.deliveries(id) on delete cascade,
  point_id uuid not null references public.deixa_aqui_points(id) on delete restrict,
  selected_by uuid not null default auth.uid(),
  selected_at timestamptz not null default now()
);

alter table public.delivery_deixa_aqui enable row level security;

drop policy if exists "delivery_deixa_aqui_select_own" on public.delivery_deixa_aqui;
create policy "delivery_deixa_aqui_select_own"
on public.delivery_deixa_aqui for select to authenticated
using (
  selected_by = auth.uid()
  or exists (select 1 from public.deliveries d where d.id = delivery_id and d.created_by = auth.uid())
);

drop policy if exists "delivery_deixa_aqui_insert_own" on public.delivery_deixa_aqui;
create policy "delivery_deixa_aqui_insert_own"
on public.delivery_deixa_aqui for insert to authenticated
with check (
  selected_by = auth.uid()
  and exists (select 1 from public.deliveries d where d.id = delivery_id and d.created_by = auth.uid())
  and exists (select 1 from public.deixa_aqui_points p where p.id = point_id and p.status = 'ACTIVE' and p.accepts_deliveries = true)
);

create or replace function public.select_deixa_aqui_for_delivery(
  p_delivery_id uuid,
  p_point_id uuid
)
returns public.delivery_deixa_aqui
language plpgsql
security invoker
set search_path = public
as $$
declare result public.delivery_deixa_aqui;
begin
  if not exists (
    select 1 from public.deliveries d
    where d.id = p_delivery_id and d.created_by = auth.uid()
  ) then
    raise exception 'Entrega não pertence ao utilizador autenticado';
  end if;

  if not exists (
    select 1 from public.deixa_aqui_points p
    where p.id = p_point_id
      and p.status = 'ACTIVE'
      and p.accepts_deliveries = true
  ) then
    raise exception 'Ponto Deixa Aqui indisponível';
  end if;

  insert into public.delivery_deixa_aqui(delivery_id, point_id, selected_by)
  values (p_delivery_id, p_point_id, auth.uid())
  on conflict (delivery_id) do update
    set point_id = excluded.point_id,
        selected_by = excluded.selected_by,
        selected_at = now()
  returning * into result;

  return result;
end;
$$;

revoke all on function public.select_deixa_aqui_for_delivery(uuid, uuid) from public;
grant execute on function public.select_deixa_aqui_for_delivery(uuid, uuid) to authenticated;
