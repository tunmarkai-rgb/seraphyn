-- Employer-initiated nurse requests ("Request this nurse").
-- Run in the Supabase SQL editor if the schema is missing in a fresh environment.
-- Safe to re-run.
--
-- WHY A SEPARATE TABLE FROM `applications`:
--   * applications.job_id is a non-null FK to jobs, and an employer-initiated
--     request has no job. Making it nullable breaks every consumer that reads
--     app.jobs.title, and inventing placeholder job rows pollutes the public
--     job feed and the employer dashboard counts.
--   * applications is client-readable by both nurses and employers, so the
--     rate columns below would leak the margin in one direction and nurse pay
--     in the other.
--   * a nurse applying IS their consent; an employer requesting is a claim on
--     someone who has not agreed yet, so the flow needs an admin-gated
--     presentation step and a nurse accept/decline beat.
--
-- CONFIDENTIALITY: quoted_bill_rate and markup_pct_snapshot must never reach a
-- nurse; offered_nurse_rate must never reach an employer. RLS is enabled with
-- NO policies, so every read and write goes through the Express server, where
-- server/lib/nurse-requests.js applies the per-role response shapes.

create extension if not exists pgcrypto;

create table if not exists public.nurse_requests (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_profiles(id) on delete cascade,
  nurse_id uuid not null references public.nurse_profiles(id) on delete cascade,

  status text not null default 'submitted'
    check (status in (
      'submitted',       -- employer created it, awaiting Seraphyn
      'reviewing',       -- admin vetting fit, rate and availability
      'presented',       -- nurse can now see it
      'nurse_accepted',  -- nurse is in
      'nurse_declined',  -- nurse passed (terminal)
      'placed',          -- converted to an assignment (terminal)
      'rejected',        -- Seraphyn declined the request (terminal)
      'closed'           -- withdrawn or expired (terminal)
    )),

  engagement_type text not null default 'per_diem'
    check (engagement_type in ('per_diem', 'contract')),

  specialty text,
  city text,
  state text,
  start_date date,
  end_date date,
  hours_per_week integer check (hours_per_week is null or hours_per_week > 0),
  shift_type text,

  employer_note text not null default '',
  admin_notes text not null default '',
  nurse_response_note text not null default '',

  -- Snapshot of what the employer was shown at submit time. Admin-visible;
  -- never returned to the nurse.
  quoted_bill_rate numeric(8,2),
  markup_pct_snapshot numeric(6,2),

  -- What the nurse is told they will be paid. Never returned to the employer.
  offered_nurse_rate numeric(8,2),

  -- Kundayi controls when the facility's identity is revealed to the nurse.
  employer_visible_to_nurse boolean not null default false,

  presented_at timestamptz,
  responded_at timestamptz,
  placed_at timestamptz,
  closed_at timestamptz,
  closed_reason text not null default '',

  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nurse_requests_employer_idx
  on public.nurse_requests (employer_id, created_at desc);

create index if not exists nurse_requests_nurse_idx
  on public.nurse_requests (nurse_id, created_at desc);

create index if not exists nurse_requests_status_idx
  on public.nurse_requests (status, created_at desc);

-- One live request per employer/nurse pair. Terminal states are excluded so a
-- facility can request the same nurse again after a decline or a placement.
create unique index if not exists nurse_requests_one_live_per_pair
  on public.nurse_requests (employer_id, nurse_id)
  where status not in ('nurse_declined', 'placed', 'rejected', 'closed');

alter table public.nurse_requests enable row level security;
-- No policies: server-only, by design. See the confidentiality note above.

create table if not exists public.nurse_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.nurse_requests(id) on delete cascade,
  actor_role text not null check (actor_role in ('employer', 'admin', 'nurse', 'system')),
  actor_id uuid references public.users(id),
  from_status text,
  to_status text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists nurse_request_events_request_idx
  on public.nurse_request_events (request_id, created_at desc);

alter table public.nurse_request_events enable row level security;
-- No policies: server-only.
