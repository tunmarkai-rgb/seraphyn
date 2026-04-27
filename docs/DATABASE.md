# DATABASE.md — Seraphyn Care Solutions
# Full Supabase Schema Reference

**Project URL:** https://rchydpjwyfpxuexnipwk.supabase.co
**PostgreSQL:** 17.6 | **Region:** US West 2 (Oregon)

---

## Extensions Enabled

`pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `pg_graphql`, `pg_trgm`, `citext`, `supabase_vault`, `plpgsql`

---

## Tables (All with RLS Enabled)

### users
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, references auth.users |
| email | text | unique, citext |
| role | enum | 'nurse' \| 'employer' \| 'admin' |
| status | enum | 'pending' \| 'approved' \| 'rejected' \| 'suspended' |
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
| user_id | uuid | FK → users |
| first_name | text | |
| last_name | text | |
| specialty | text | use constants.js list |
| license_number | text | |
| license_state | text | 2-char state code |
| years_experience | integer | Minimum years in range (1=1-2 yrs, 3=3-5 yrs, 6=6-10 yrs, 10=10-15 yrs, 15=15+ yrs) |
| resume_url | text | Supabase Storage: resumes/ |
| license_url | text | Supabase Storage: licenses/ |
| availability | text | |
| shift_preference | text | |
| bio | text | |
| certifications | text[] | array |
| profile_photo_url | text | |
| approved_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | auto-updated |
| ai_parsed_data | jsonb | written by n8n resume parser |
| ai_job_matches | jsonb | top 5 job matches from n8n |
| ghl_contact_id | text | written by GHL webhook |
| ghl_synced_at | timestamptz | |

### employer_profiles
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| org_name | text | |
| org_type | text | Hospital, Clinic, etc. |
| contact_name | text | |
| contact_title | text | |
| city | text | |
| state | text | |
| bed_count | integer | |
| description | text | |
| logo_url | text | |
| onboarding_stage | text | 'profile' \| 'contract' \| 'approved' |
| contract_signed | boolean | set by GHL Documents signed webhook |
| contract_signed_at | timestamptz | |
| stripe_customer_id | text | legacy field - unused in offline M2 |
| subscription_status | text | legacy field - offline billing in M2 |
| subscription_start | timestamptz | |
| subscription_ends | timestamptz | |
| approved_at | timestamptz | set by admin |
| created_at | timestamptz | |
| updated_at | timestamptz | auto-updated |
| ghl_contact_id | text | |
| ghl_synced_at | timestamptz | |

### jobs
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| employer_id | uuid | FK → employer_profiles |
| title | text | |
| specialty | text | use constants.js list |
| location | text | |
| city | text | |
| state | text | |
| shift_type | text | Per Diem \| Contract \| Permanent |
| pay_rate | numeric | hourly rate |
| contract_length | text | e.g. "13 Weeks" |
| description | text | |
| requirements | text | |
| status | text | 'active' \| 'filled' \| 'closed' \| 'paused' |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| expires_at | timestamptz | |

### applications
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| job_id | uuid | FK → jobs |
| nurse_id | uuid | FK → nurse_profiles |
| employer_id | uuid | FK → employer_profiles |
| status | text | 'submitted' \| 'reviewing' \| 'interview' \| 'offer' \| 'hired' \| 'rejected' |
| cover_note | text | |
| admin_notes | text | visible to nurse as "Admin Note" |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| placement_fee_pct | numeric | set by admin on hire |
| hired_at | timestamptz | |

### messages
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| sender_id | uuid | FK → users |
| receiver_id | uuid | FK → users — must include user_id in profile queries |
| application_id | uuid | FK → applications |
| content | text | |
| read | boolean | default false |
| created_at | timestamptz | |

**Important:** When querying messages, always include `user_id` in nested profile selects:
```js
nurse_profiles(first_name, last_name, user_id)
employer_profiles(org_name, user_id)
```

### per_diem_shifts
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| employer_id | uuid | FK → employer_profiles |
| nurse_id | uuid | FK → nurse_profiles, nullable |
| specialty | text | |
| shift_date | date | |
| start_time | time | |
| end_time | time | |
| hours_worked | numeric | |
| hourly_rate | numeric | |
| status | text | 'open' \| 'filled' \| 'completed' \| 'cancelled' |
| notes | text | |
| admin_notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### contracts
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| employer_id | uuid | FK → employer_profiles |
| template_url | text | agreement template reference, e.g. `ghl-template:<templateId>` |
| signed_url | text | Supabase Storage path |
| google_drive_url | text | mirrored copy |
| docuseal_submission_id | text | legacy field currently reused to store the GHL document reference |
| status | text | 'pending' \| 'sent' \| 'signed' \| 'expired' |
| sent_at | timestamptz | |
| signed_at | timestamptz | |
| expires_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### payments
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| employer_id | uuid | FK → employer_profiles |
| type | text | 'subscription' \| 'placement_fee' |
| amount | numeric | manual/offline tracking amount in cents |
| currency | text | default 'usd' |
| stripe_payment_intent_id | text | legacy field - unused in offline M2 |
| stripe_invoice_id | text | legacy field - unused in offline M2 |
| placement_percentage | numeric | 10–15 |
| job_id | uuid | FK → jobs, nullable |
| application_id | uuid | FK → applications, nullable |
| status | text | 'pending' \| 'succeeded' \| 'failed' \| 'refunded' |
| notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## Triggers

| Trigger | Table | Function | Purpose |
|---|---|---|---|
| on_auth_user_created | auth.users | handle_new_user() | Creates row in public.users on signup |
| on_user_created | public.users | handle_new_profile() | Creates nurse_profiles or employer_profiles row |
| users_updated_at | public.users | update_updated_at() | Auto-updates updated_at |
| jobs_updated_at | public.jobs | update_updated_at() | Auto-updates updated_at |
| applications_updated_at | public.applications | update_updated_at() | Auto-updates updated_at |
| shifts_updated_at | public.per_diem_shifts | update_updated_at() | Auto-updates updated_at |
| contracts_updated_at | public.contracts | update_updated_at() | Auto-updates updated_at |
| payments_updated_at | public.payments | update_updated_at() | Auto-updates updated_at |

---

## Storage Buckets

| Bucket | Access | Used For |
|---|---|---|
| resumes | authenticated write, public read | Nurse resume uploads |
| licenses | authenticated write, public read | Nurse license uploads |

---

## Supabase SQL Editor

Quick access: https://supabase.com/dashboard/project/rchydpjwyfpxuexnipwk/editor

Useful queries:
```sql
-- Check users table
SELECT id, email, role, status FROM public.users;

-- Reset employer to onboarding start (for testing)
UPDATE public.employer_profiles SET onboarding_stage = 'profile', contract_signed = false WHERE user_id = '[uuid]';

-- Approve a nurse
UPDATE public.users SET status = 'approved' WHERE email = 'nurse@example.com';
UPDATE public.nurse_profiles SET approved_at = NOW() WHERE user_id = '[uuid]';
```
