# DATABASE.md - Seraphyn Care Solutions
# Supabase Schema Reference

**Project URL:** https://rchydpjwyfpxuexnipwk.supabase.co
**PostgreSQL:** 17.6 | **Region:** US West 2 (Oregon)

---

## Core Tables

### users
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, references auth.users |
| email | text | unique, citext |
| role | enum | `nurse` \| `employer` \| `admin` |
| status | enum | `pending` \| `approved` \| `rejected` \| `suspended` |
| full_name | text | |
| avatar_url | text | |
| phone | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | auto-updated |
| last_login_at | timestamptz | |

### nurse_profiles
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK to users |
| first_name | text | |
| last_name | text | |
| specialty | text | use constants list |
| license_number | text | |
| license_state | text | state code |
| years_experience | integer | minimum value in range |
| resume_url | text | storage path in `resumes/` |
| license_url | text | storage path in `licenses/` |
| availability | text | |
| shift_preference | text | |
| bio | text | |
| certifications | text[] | structured certification tags |
| profile_photo_url | text | |
| approved_at | timestamptz | |
| ai_parsed_data | jsonb | resume parser output |
| ai_job_matches | jsonb | n8n job matching output |
| ghl_contact_id | text | |
| ghl_synced_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | auto-updated |

### nurse_documents
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| nurse_id | uuid | FK to nurse_profiles |
| document_type | text | currently `certification` |
| title | text | display label |
| file_url | text | private storage path in `certifications/` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### employer_profiles
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK to users |
| org_name | text | |
| org_type | text | hospital, clinic, etc. |
| contact_name | text | |
| contact_title | text | |
| city | text | |
| state | text | |
| bed_count | integer | |
| description | text | |
| logo_url | text | |
| onboarding_stage | text | `profile` \| `contract` \| `approved` |
| contract_signed | boolean | true once both required agreements are signed |
| contract_signed_at | timestamptz | |
| approved_at | timestamptz | admin approval timestamp |
| stripe_customer_id | text | legacy unused M2 field |
| subscription_status | text | legacy unused M2 field |
| subscription_start | timestamptz | |
| subscription_ends | timestamptz | |
| ghl_contact_id | text | |
| ghl_synced_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | auto-updated |

### jobs
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| employer_id | uuid | FK to employer_profiles |
| title | text | |
| specialty | text | |
| location | text | |
| city | text | |
| state | text | |
| shift_type | text | `Per Diem` \| `Contract` \| `Permanent` |
| pay_rate | numeric | |
| contract_length | text | |
| description | text | |
| requirements | text | |
| status | text | `active` \| `filled` \| `closed` \| `paused` |
| expires_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### applications
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| job_id | uuid | FK to jobs |
| nurse_id | uuid | FK to nurse_profiles |
| employer_id | uuid | FK to employer_profiles |
| status | text | `submitted` \| `reviewing` \| `interview` \| `offer` \| `hired` \| `rejected` |
| cover_note | text | |
| admin_notes | text | |
| placement_fee_pct | numeric | |
| hired_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### messages
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| sender_id | uuid | FK to users |
| receiver_id | uuid | FK to users |
| application_id | uuid | nullable FK to applications; `null` means direct user-to-user thread |
| content | text | |
| read | boolean | default false |
| created_at | timestamptz | |

### notifications
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK to users |
| type | text | e.g. `message.new`, `nurse.profile_completed` |
| title | text | |
| body | text | |
| entity_type | text | |
| entity_id | text | |
| read | boolean | default false |
| read_at | timestamptz | |
| email_sent_at | timestamptz | |
| metadata | jsonb | |
| created_at | timestamptz | default now() |

### contracts
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| employer_id | uuid | FK to employer_profiles |
| document_type | text | `direct_hire` \| `staffing_boss` |
| title | text | agreement title |
| template_url | text | `portal-template:*` or legacy `ghl-template:*` |
| source_file_name | text | bundled source PDF |
| signed_url | text | legacy signed storage path field |
| signed_storage_path | text | canonical private storage path in `contracts/` |
| google_drive_url | text | optional mirror |
| docuseal_submission_id | text | legacy external reference field |
| status | text | `pending` \| `sent` \| `signed` \| `expired` |
| sent_at | timestamptz | |
| signed_at | timestamptz | |
| expires_at | timestamptz | |
| signed_by_name | text | |
| signed_by_email | text | |
| signed_by_title | text | |
| signature_provider | text | `portal-native` or legacy provider |
| signature_audit | jsonb | signed timestamp, IP, user agent |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### payments
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| employer_id | uuid | FK to employer_profiles |
| type | text | `subscription` \| `placement_fee` |
| amount | numeric | offline tracked amount in cents |
| currency | text | default `usd` |
| stripe_payment_intent_id | text | legacy unused M2 field |
| stripe_invoice_id | text | legacy unused M2 field |
| placement_percentage | numeric | |
| job_id | uuid | nullable FK to jobs |
| application_id | uuid | nullable FK to applications |
| status | text | `pending` \| `succeeded` \| `failed` \| `refunded` |
| notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### per_diem_shifts
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| employer_id | uuid | FK to employer_profiles |
| nurse_id | uuid | nullable FK to nurse_profiles. Read by admin screens but **no code path currently writes it** |
| specialty | text | |
| shift_date | date | |
| start_time / end_time | time | |
| hourly_rate | numeric | **BILL RATE the employer pays**, employer-entered. Not the nurse's pay |
| nurse_pay_rate | numeric(8,2) | **CONFIDENTIAL.** What the nurse is paid, snapshotted at booking |
| markup_pct_snapshot | numeric(6,2) | **CONFIDENTIAL.** Markup in force when the shift was priced |
| notes / admin_notes | text | |
| status | text | `open` \| `filled` \| `completed` \| `cancelled` |
| updated_at | timestamptz | |

### nurse_rates
Nurse self-set hourly rates. **Server-only writes.** See `docs/NURSE_RATES.sql`.

| Column | Type | Notes |
|---|---|---|
| nurse_id | uuid | PK, FK to nurse_profiles |
| desired_hourly | numeric(8,2) | what the nurse asked for, nullable |
| admin_hourly | numeric(8,2) | admin override; wins over desired_hourly |
| markup_pct_override | numeric(6,2) | per-nurse markup; null means use the platform default |
| previous_hourly | numeric(8,2) | prior value, for quick reference |
| rate_source | text | `nurse` \| `admin` |
| updated_by | uuid | FK to users |

RLS: enabled. Select policies for the owning nurse and for admins only. **No
insert/update/delete policies and no employer policy** — employers get zero rows
no matter what they select, and all writes go through the Express server.

### nurse_rate_history
Append-only audit of every rate change (`nurse_id`, `source`, `field`,
`old_value`, `new_value`, `markup_pct_at_change`, `bill_rate_at_change`,
`changed_by`, `reason`, `created_at`). RLS enabled with no policies: server-only.

### app_settings / app_settings_history
Platform configuration as `key` + `value jsonb`, with an append-only history
table. RLS enabled with **no policies** on both, so the publishable key sees an
empty table and only the service-role server can read or write.

Current keys:

| Key | Contents |
|---|---|
| `per_diem_billing` | `markup_pct` (default 30), `rounding_increment` (0.50), `min_nurse_rate` (15), `max_nurse_rate` (400) |

### nurse_requests
Employer-initiated requests for a specific nurse. **Server-only** (RLS enabled,
no policies) because the rate columns must not leak in either direction. See
`docs/NURSE_REQUESTS.sql` for why this is not folded into `applications`.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| employer_id | uuid | FK to employer_profiles |
| nurse_id | uuid | FK to nurse_profiles |
| status | text | `submitted` \| `reviewing` \| `presented` \| `nurse_accepted` \| `nurse_declined` \| `placed` \| `rejected` \| `closed` |
| engagement_type | text | `per_diem` \| `contract` |
| specialty / city / state | text | |
| start_date / end_date | date | `end_date` is contract-only |
| hours_per_week | integer | |
| shift_type | text | |
| employer_note | text | what the employer typed |
| admin_notes | text | internal only |
| nurse_response_note | text | optional reason on decline |
| quoted_bill_rate | numeric(8,2) | snapshot of what the employer was shown. **Never returned to the nurse** |
| markup_pct_snapshot | numeric(6,2) | **Never returned to the nurse or employer** |
| offered_nurse_rate | numeric(8,2) | what the nurse is told they are paid. **Never returned to the employer** |
| employer_visible_to_nurse | boolean | admin controls when the facility identity is revealed |
| presented_at / responded_at / placed_at / closed_at | timestamptz | lifecycle stamps |
| closed_reason | text | |

A partial unique index (`nurse_requests_one_live_per_pair`) allows one live
request per employer/nurse pair, excluding terminal statuses so a facility can
request the same nurse again after a decline or placement.

### nurse_request_events
Append-only transition log: `request_id`, `actor_role`
(`employer`/`admin`/`nurse`/`system`), `actor_id`, `from_status`, `to_status`,
`note`, `created_at`. RLS enabled, no policies.

---

## Storage Buckets

| Bucket | Access | Used For |
|---|---|---|
| resumes | authenticated write, existing public-read flow | nurse resume uploads |
| licenses | authenticated write, existing public-read flow | nurse license uploads |
| certifications | private, signed server downloads only | nurse certification proof documents |
| contracts | private, signed server downloads only | signed employer agreements |

---

## Operational Notes

**Shift rates are snapshots, not live lookups.** `per_diem_shifts.nurse_pay_rate`
and `markup_pct_snapshot` are written when a nurse is assigned and are never
recomputed. `nurse_rates` holds the nurse's *current* rate, so pricing an
already-worked shift from it would silently re-price history after any rate
change. The same applies to `nurse_requests.quoted_bill_rate`.

**Nurse requests are admin-brokered.** A nurse sees nothing until an admin sets
`offered_nurse_rate` and presents the request; after that the nurse accepts or
declines directly with no admin relay. Employers receive only a coarse status
label (In Review / Confirming Availability / Placed / Not Available /
Withdrawn), because the raw status would reveal whether the nurse has been
asked yet. The transition map in `server/lib/nurse-requests.js` is keyed by
actor role and is the only thing that may change a status.

**Bill rates are computed, never stored.** `bill_rate = nurse_rate x (1 + markup)`,
rounded up to `rounding_increment`, calculated in `server/lib/rates.js` on read.
There is deliberately no rate column on `nurse_profiles`: employers can read that
table, and Postgres RLS is row-level rather than column-level, so any rate column
there would be readable by every employer that can see the row. A markup change
therefore takes effect everywhere immediately with no backfill.

**The live schema is not fully in this repo.** RLS is enabled and enforcing on
`nurse_profiles`, `employer_profiles`, `applications` and `users` in production,
but those policies were applied by hand in the Supabase dashboard and are not in
any file here. Dump `pg_policies` before changing access control.

- Employer onboarding Stage 1 now writes through `POST /api/employers/onboarding/profile` so server logic can backfill `public.users` / `employer_profiles` safely.
- Employer agreement signing is now portal-native first. GHL document send remains a legacy fallback path.
- Employer agreement completion now raises both in-app admin notifications and an internal operational email to `info@seraphyncare.com`.
- Nurses can upload resume and license directly into `nurse_profiles` and certification proof files into `nurse_documents`.
- Admin and approved employers access private nurse certification documents through signed server URLs, not public bucket links.
- Messages support both application-scoped threads and direct user-to-user threads:
  - application thread: `messages.application_id` references `applications.id`
  - direct thread: `messages.application_id` is `null`, grouped by sender/receiver pair
- New nurse and employer signups also create internal operational alerts for approval review.
- Production nurse profile writes normalize the currently accepted enum-backed values to:
  - `shift_preference = any`
  - `availability = available`
- Legacy nurse metadata values from older signup flows are coerced server-side so profile bootstrap and uploads do not fail on enum mismatches.
- After the May 23, 2026 cleanup pass, the only intentionally retained baseline users are:
  - `kundayiw@gmail.com` (admin)
  - `nurse.test@seraphyn.com` (test nurse)
  - `employer.test@seraphyn.com` (test employer)
- The retained seeded test employer still owns the sample jobs/application records used for portal verification.
- The temporary employer used during contract-signing implementation was removed together with its signed contracts, notifications, and auth account.
