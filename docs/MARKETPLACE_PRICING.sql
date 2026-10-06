-- Transparent marketplace pricing (Kundayi, 2026-10-06).
--
--   Nurse's desired pay + flat Seraphyn agency fee = hospital bill rate
--
-- Replaces the confidential percentage markup. The fee and the split are now
-- shown to hospitals and nurses. What stays private is each hospital's own
-- budget (target / maximum bill rate per job): nurses only ever see whether a
-- job fits their desired pay, never the number, so `job_budgets` is a separate
-- table that nurses cannot read even with a direct Supabase query.
--
-- Hand-apply in the Supabase SQL editor (project rchydpjwyfpxuexnipwk) BEFORE
-- deploying the matching server code. Safe to re-run.

-- 1. The fee lives in the existing billing settings row --------------------
update public.app_settings
set value = value || jsonb_build_object('agency_fee', 17)
where key = 'per_diem_billing'
  and not (value ? 'agency_fee');

-- 2. Fee snapshots, so a quote or a booked shift keeps the fee it was made
--    with if Kundayi later changes the amount ------------------------------
alter table public.nurse_requests
  add column if not exists agency_fee_snapshot numeric(8,2)
    check (agency_fee_snapshot is null or agency_fee_snapshot >= 0);

alter table public.per_diem_shifts
  add column if not exists agency_fee_snapshot numeric(8,2)
    check (agency_fee_snapshot is null or agency_fee_snapshot >= 0);

alter table public.nurse_rate_history
  add column if not exists agency_fee_at_change numeric(8,2);

-- 3. Urgency is public on the job; the budget is not ------------------------
alter table public.jobs
  add column if not exists urgency text not null default 'standard'
    check (urgency in ('standard', 'urgent', 'critical'));

create table if not exists public.job_budgets (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  target_bill_rate numeric(8,2) check (target_bill_rate is null or target_bill_rate > 0),
  max_bill_rate numeric(8,2) check (max_bill_rate is null or max_bill_rate > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_bill_rate is null or max_bill_rate is null or target_bill_rate <= max_bill_rate)
);

alter table public.job_budgets enable row level security;

drop policy if exists "Employers can read own job budgets" on public.job_budgets;
create policy "Employers can read own job budgets"
  on public.job_budgets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.jobs j
      join public.employer_profiles ep on ep.id = j.employer_id
      where j.id = job_budgets.job_id
        and ep.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can read all job budgets" on public.job_budgets;
create policy "Admins can read all job budgets"
  on public.job_budgets
  for select
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Deliberately no nurse policy and no write policies: nurses get zero rows,
-- and every write goes through POST/PUT /api/jobs.

-- 4. Existing jobs: the old single "Pay Rate" was what employers typed as the
--    rate for the role, so it becomes the job's maximum bill rate ------------
insert into public.job_budgets (job_id, max_bill_rate)
select id, pay_rate
from public.jobs
where pay_rate is not null and pay_rate > 0
on conflict (job_id) do nothing;

-- `jobs` is readable by nurses, so once the value is safely in job_budgets the
-- copy on the job row is cleared -- otherwise it would leak the maximum.
update public.jobs j
set pay_rate = null
where j.pay_rate is not null
  and exists (select 1 from public.job_budgets b where b.job_id = j.id);

comment on column public.jobs.pay_rate is
  'DEPRECATED 2026-10-06. Superseded by job_budgets (target/max bill rate), '
  'which nurses cannot read. Always null; do not write it.';
