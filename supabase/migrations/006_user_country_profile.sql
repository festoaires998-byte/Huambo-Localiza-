-- Persist the registration country and expose it only to the owning user.
create table if not exists public.user_country_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  country_code text not null references public.country_configs(country_code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (country_code ~ '^[A-Z]{2}$')
);

alter table public.user_country_profiles enable row level security;
drop policy if exists user_country_profiles_select_own on public.user_country_profiles;
create policy user_country_profiles_select_own on public.user_country_profiles
  for select to authenticated using (user_id = auth.uid());

drop policy if exists user_country_profiles_insert_own on public.user_country_profiles;
create policy user_country_profiles_insert_own on public.user_country_profiles
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists user_country_profiles_update_own on public.user_country_profiles;
create policy user_country_profiles_update_own on public.user_country_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.handle_new_user_country()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  codigo text := upper(coalesce(new.raw_user_meta_data->>'country_code','AO'));
begin
  if not exists (select 1 from public.country_configs where country_code = codigo and enabled = true) then
    raise exception 'País Localiza inválido ou inativo.';
  end if;
  insert into public.user_country_profiles(user_id,country_code)
  values (new.id,codigo)
  on conflict (user_id) do update set country_code=excluded.country_code, updated_at=now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_country on auth.users;
create trigger on_auth_user_created_country
  after insert on auth.users
  for each row execute function public.handle_new_user_country();

create or replace function public.set_my_localiza_country(p_country_code text)
returns public.user_country_profiles
language plpgsql
security definer
set search_path = public
as $$
declare r public.user_country_profiles;
begin
  if not exists (select 1 from public.country_configs where country_code = upper(trim(p_country_code)) and enabled = true) then
    raise exception 'País Localiza inválido ou inativo.';
  end if;
  update public.user_country_profiles
    set country_code=upper(trim(p_country_code)), updated_at=now()
    where user_id=auth.uid()
    returning * into r;
  if r.user_id is null then
    raise exception 'Perfil de país não encontrado.';
  end if;
  return r;
end;
$$;

revoke all on function public.set_my_localiza_country(text) from public;
grant execute on function public.set_my_localiza_country(text) to authenticated;