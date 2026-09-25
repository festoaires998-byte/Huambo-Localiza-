-- LOCALIZA — PALOP country runtime (safe rollout)
-- Idempotent migration. Does NOT alter existing delivery/address/KYC tables.

create table if not exists public.country_configs (
  country_code text primary key check (country_code ~ '^[A-Z]{2}$'),
  country_name text not null,
  app_name text not null,
  locale text not null default 'pt-PT',
  currency_code text not null,
  currency_symbol text not null,
  lowest_admin_level text not null,
  phone_rules jsonb not null default '{}'::jsonb,
  labels jsonb not null default '{}'::jsonb,
  vehicle_types jsonb not null default '[]'::jsonb,
  payment_methods jsonb not null default '[]'::jsonb,
  kyc_rules jsonb not null default '{}'::jsonb,
  pricing jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.country_configs
(country_code, country_name, app_name, locale, currency_code, currency_symbol,
 lowest_admin_level, phone_rules, labels, vehicle_types, payment_methods, kyc_rules, pricing, enabled)
values
('AO', 'Angola', 'Angola Localiza', 'pt-AO', 'AOA', 'Kz', 'quadra',
 '{"country_calling_code":"244","national_length":9,"pattern":"^9[1-9][0-9]{7}$"}'::jsonb,
 '{"lowest_admin":"Quadra","vehicle_estafeta":"Estafeta","address_reference":"Referência"}'::jsonb,
 '["Moto","TVS","Hiace","Toco-Toco","Carrinha"]'::jsonb,
 '["multicaixa_express","unitel_money"]'::jsonb,
 '{"document_name":"Bilhete de Identidade","legacy_validation":true}'::jsonb,
 '{"volumoso":500,"long_wait":300}'::jsonb,
 true),
('MZ', 'Moçambique', 'Localiza', 'pt-MZ', 'MZN', 'MT', 'quarteirao',
 '{"country_calling_code":"258","national_length":9,"pattern":"^(8[2-7])[0-9]{7}$"}'::jsonb,
 '{"lowest_admin":"Quarteirão","vehicle_estafeta":"Estafeta","address_reference":"Referência"}'::jsonb,
 '["Moto","Mopeda","Txopela","Carrinha","Pickup"]'::jsonb,
 '["mpesa","emola"]'::jsonb,
 '{"document_name":"BI/DIRE"}'::jsonb,
 '{}'::jsonb,
 false),
('CV', 'Cabo Verde', 'Localiza', 'pt-CV', 'CVE', '$', 'zona',
 '{"country_calling_code":"238","national_length":7,"pattern":"^[2-9][0-9]{6}$"}'::jsonb,
 '{"lowest_admin":"Zona","vehicle_estafeta":"Estafeta","address_reference":"Referência"}'::jsonb,
 '["Scooter","Hiace","Carrinha"]'::jsonb,
 '["vint4","pos"]'::jsonb,
 '{"document_name":"CNI"}'::jsonb,
 '{}'::jsonb,
 false),
('GW', 'Guiné-Bissau', 'Localiza', 'pt-GW', 'XOF', 'CFA', 'tabanca',
 '{"country_calling_code":"245","national_length":7,"pattern":"^[0-9]{7}$"}'::jsonb,
 '{"lowest_admin":"Tabanca","vehicle_estafeta":"Estafeta","address_reference":"Referência"}'::jsonb,
 '["Moto","Bicicleta","Carroça"]'::jsonb,
 '["orange_money","mtn_momo"]'::jsonb,
 '{"document_name":"BI/Cédula Pessoal"}'::jsonb,
 '{}'::jsonb,
 false),
('ST', 'São Tomé e Príncipe', 'Localiza', 'pt-ST', 'STN', 'Db', 'localidade',
 '{"country_calling_code":"239","national_length":7,"pattern":"^[0-9]{7}$"}'::jsonb,
 '{"lowest_admin":"Localidade","vehicle_estafeta":"Estafeta","address_reference":"Referência"}'::jsonb,
 '["Moto","Pickup"]'::jsonb,
 '["bank_transfer","pos"]'::jsonb,
 '{"document_name":"BI"}'::jsonb,
 '{}'::jsonb,
 false)
on conflict (country_code) do update set
  country_name = excluded.country_name,
  app_name = excluded.app_name,
  locale = excluded.locale,
  currency_code = excluded.currency_code,
  currency_symbol = excluded.currency_symbol,
  lowest_admin_level = excluded.lowest_admin_level,
  phone_rules = excluded.phone_rules,
  labels = excluded.labels,
  vehicle_types = excluded.vehicle_types,
  payment_methods = excluded.payment_methods,
  kyc_rules = excluded.kyc_rules,
  pricing = excluded.pricing,
  enabled = case when public.country_configs.country_code = 'AO' then true else public.country_configs.enabled end,
  updated_at = now();

-- O frontend só precisa de ler configurações activadas.
alter table public.country_configs enable row level security;

drop policy if exists "country_configs_public_read_enabled" on public.country_configs;
create policy "country_configs_public_read_enabled"
on public.country_configs
for select
to anon, authenticated
using (enabled = true);

-- Mantém updated_at consistente para futuras alterações no painel/admin.
create or replace function public.set_country_configs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_country_configs_updated_at on public.country_configs;
create trigger trg_country_configs_updated_at
before update on public.country_configs
for each row execute function public.set_country_configs_updated_at();
