-- GHL lead intake: one row per email that submitted a GHL funnel form.
--
-- Hand-apply in the Supabase SQL editor. Server-only: RLS is enabled with no
-- policies, so only the service role (the portal API) can read or write it.
-- Lead data is applied to a portal profile only after Supabase has confirmed
-- the account's email, so a stranger cannot sign up with someone else's email
-- and inherit their form answers.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('nurse', 'employer')),
  source text not null default 'ghl-form',

  ghl_contact_id text,
  ghl_opportunity_id text,

  first_name text,
  last_name text,
  phone text,

  -- nurse form
  license_state text,
  specialty text,
  years_experience integer,
  shift_preference text,

  -- employer form
  org_name text,
  org_type text,
  state text,
  looking_for text,
  nurses_needed_per_month text,

  raw jsonb not null default '{}'::jsonb,

  invite_sent_at timestamptz,
  claimed_by uuid references public.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Emails are stored lower-cased by the API; the index enforces one lead each.
create unique index if not exists leads_email_key on public.leads (email);
create index if not exists leads_ghl_contact_id_idx on public.leads (ghl_contact_id);

alter table public.leads enable row level security;
