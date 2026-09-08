-- Nurse self-set hourly rates + employer-facing agency markup.
-- Per-diem / contract hourly only. Direct hire keeps its separate placement-fee model.
-- Run in the Supabase SQL editor if the schema is missing in a fresh environment.
-- Safe to re-run.
--
-- CONFIDENTIALITY: nurse rates and the markup percentage must never reach an
-- employer. Both tables below are server-only (service-role key). The bill rate
-- an employer sees is computed in server/lib/rates.js on read and is never stored
-- on nurse_profiles, which employers can read.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Platform settings (server-only)
-- ---------------------------------------------------------------------------

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  description text not null default '',
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- RLS enabled with NO policies: the publishable/anon key sees an empty table.
-- Only the Express server's service-role key can read or write.
alter table public.app_settings enable row level security;

create table if not exists public.app_settings_history (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  old_value jsonb,
  new_value jsonb not null,
  changed_by uuid references public.users(id),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists app_settings_history_key_idx
  on public.app_settings_history (key, created_at desc);

alter table public.app_settings_history enable row level security;

insert into public.app_settings (key, value, description)
values (
  'per_diem_billing',
  jsonb_build_object(
    'markup_pct',          30.00,
    'rounding_increment',   0.50,
    'min_nurse_rate',      15.00,
    'max_nurse_rate',     400.00
  ),
  'CONFIDENTIAL. Per-diem/contract hourly agency markup. Never expose to employers or nurses.'
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Nurse rates (server-only writes; nurse and admin can read)
-- ---------------------------------------------------------------------------

create table if not exists public.nurse_rates (
  nurse_id uuid primary key
    references public.nurse_profiles(id) on delete cascade,

  -- what the nurse asked for
  desired_hourly numeric(8,2)
    check (desired_hourly is null or desired_hourly > 0),

  -- admin override; wins over desired_hourly when set
  admin_hourly numeric(8,2)
    check (admin_hourly is null or admin_hourly > 0),

  -- optional per-nurse markup. null means "use app_settings.per_diem_billing".
  -- A uniform global markup is trivially invertible by any employer who learns
  -- the percentage; per-nurse variation is the only real mitigation.
  markup_pct_override numeric(6,2)
    check (markup_pct_override is null or markup_pct_override > 0),

  previous_hourly numeric(8,2),
  rate_source text not null default 'nurse'
    check (rate_source in ('nurse', 'admin')),

  currency text not null default 'usd',
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nurse_rates enable row level security;

drop policy if exists "Nurses can read own rate" on public.nurse_rates;
create policy "Nurses can read own rate"
  on public.nurse_rates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.nurse_profiles np
      where np.id = nurse_rates.nurse_id
        and np.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can read all rates" on public.nurse_rates;
create policy "Admins can read all rates"
  on public.nurse_rates
  for select
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Deliberately NO insert / update / delete policies, and no employer select
-- policy. Every write goes through the Express server so it is validated and
-- audited; employers get zero rows from this table no matter what they select.

-- ---------------------------------------------------------------------------
-- 3. Rate change audit (server-only)
-- ---------------------------------------------------------------------------

create table if not exists public.nurse_rate_history (
  id uuid primary key default gen_random_uuid(),
  nurse_id uuid not null
    references public.nurse_profiles(id) on delete cascade,
  source text not null check (source in ('nurse', 'admin', 'system')),
  field text not null check (field in (
    'desired_hourly',
    'admin_hourly',
    'markup_pct_override'
  )),
  old_value numeric(8,2),
  new_value numeric(8,2),
  markup_pct_at_change numeric(6,2),
  bill_rate_at_change numeric(8,2),
  changed_by uuid references public.users(id),
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists nurse_rate_history_nurse_idx
  on public.nurse_rate_history (nurse_id, created_at desc);

alter table public.nurse_rate_history enable row level security;
-- No policies: server-only.
