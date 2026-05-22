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
| application_id | uuid | FK to applications |
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

- Employer onboarding Stage 1 now writes through `POST /api/employers/onboarding/profile` so server logic can backfill `public.users` / `employer_profiles` safely.
- Employer agreement signing is now portal-native first. GHL document send remains a legacy fallback path.
- Nurses can upload resume and license directly into `nurse_profiles` and certification proof files into `nurse_documents`.
- Admin and approved employers access private nurse certification documents through signed server URLs, not public bucket links.
