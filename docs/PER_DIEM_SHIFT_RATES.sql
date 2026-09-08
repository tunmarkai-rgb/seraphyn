-- Per-diem shift rate reconciliation.
-- Run in the Supabase SQL editor if the schema is missing in a fresh environment.
-- Safe to re-run.
--
-- `per_diem_shifts.hourly_rate` has existed since M1 but its MEANING was never
-- defined: nothing recorded whether it was the employer's cost or the nurse's
-- pay. Now that nurses set their own rates that ambiguity is a margin bug, so
-- it is pinned here:
--
--   hourly_rate    = the BILL RATE the employer pays  (employer-entered)
--   nurse_pay_rate = what the nurse is paid           (admin-set, confidential)
--
-- The column is not renamed because it is referenced from
-- client/src/pages/employer/PostJob.jsx, client/src/pages/admin/Shifts.jsx and
-- server/routes/admin.js; it is redefined and relabelled in the UI instead.
--
-- Both new columns are snapshots taken at booking, NOT live lookups.
-- nurse_rates holds the nurse's CURRENT rate, so pricing an already-worked
-- shift from it would silently re-price history after any rate change.

alter table public.per_diem_shifts
  add column if not exists nurse_pay_rate numeric(8,2)
    check (nurse_pay_rate is null or nurse_pay_rate > 0),
  add column if not exists markup_pct_snapshot numeric(6,2)
    check (markup_pct_snapshot is null or markup_pct_snapshot > 0);

comment on column public.per_diem_shifts.hourly_rate is
  'BILL RATE the employer pays, employer-entered. Not the nurse''s pay.';

comment on column public.per_diem_shifts.nurse_pay_rate is
  'CONFIDENTIAL. What the nurse is paid for this shift, snapshotted at booking. '
  'Never expose to employers.';

comment on column public.per_diem_shifts.markup_pct_snapshot is
  'CONFIDENTIAL. Markup in force when the shift was priced.';

create index if not exists per_diem_shifts_nurse_idx
  on public.per_diem_shifts (nurse_id, shift_date desc);
