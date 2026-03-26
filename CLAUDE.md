# CLAUDE.md — Seraphyn Care Solutions
# Full Project Brief for Claude Code

> Read this entire file before writing any code.
> Ask before making any architectural decision not covered here.

---

## Project Overview

Seraphyn Care Solutions is a two-sided healthcare staffing marketplace
connecting nurses with healthcare organizations for per diem shifts,
contract placements, and permanent roles.

- **Client:** Kundayi Washaya
- **Developer:** Abdulrasheed Olatunji
- **Budget:** $450 (Contract 1) + $200 (Contract 2 — GHL, separate)
- **Timeline:** 21 days total
- **Live Demo (HTML prototype):** https://melodic-flan-6cb6c8.netlify.app/
- **Supabase Project:** https://rchydpjwyfpxuexnipwk.supabase.co
- **Upwork Profile:** https://www.upwork.com/freelancers/~0165842b81b1151c2e

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React (Vite) v8 | Already scaffolded |
| Backend | Node.js v24 + Express | Already scaffolded |
| Database | Supabase (PostgreSQL 17.6) | Live, all tables built |
| AI Automation | n8n (self-hosted on VPS) | Phase 3 |
| AI Model | OpenAI GPT-4o-mini | Cost-efficient |
| E-Signature | DocuSeal (open source) | Self-hosted |
| Payments | Stripe | Subscription + placement fee |
| Email | Resend | Free up to 3,000/month |
| Hosting | Hostinger VPS 2 (~$15/month) | Runs everything |
| Domain | seraphyncare.com | Transfer from Squarespace |
| CRM | GoHighLevel | Contract 2, separate build |

---

## Project Structure
```
seraphyn/
├── CLAUDE.md                  ← You are here
├── client/                    ← React frontend (Vite)
│   ├── public/
│   │   ├── logo.png           ← Seraphyn wings logo
│   │   ├── hero-bg.jpg        ← Hero section background
│   │   ├── favicon.png
│   │   └── icons.png
│   ├── src/
│   │   ├── main.jsx           ← Entry point
│   │   ├── App.jsx            ← Routes + AuthProvider
│   │   ├── index.css          ← Global styles + CSS variables
│   │   ├── lib/
│   │   │   └── supabase.js    ← Supabase client (anon key)
│   │   ├── context/
│   │   │   └── AuthContext.jsx ← Global auth state
│   │   ├── components/
│   │   │   ├── Navbar.jsx     ← Reusable navbar with logo
│   │   │   └── ProtectedRoute.jsx ← Role-based route guard
│   │   └── pages/
│   │       ├── HomePage.jsx   ← Full marketing homepage
│   │       ├── Login.jsx      ← Unified login
│   │       ├── NurseSignup.jsx
│   │       ├── EmployerSignup.jsx
│   │       ├── nurse/         ← Nurse portal pages (TODO)
│   │       ├── employer/      ← Employer portal pages (TODO)
│   │       └── admin/         ← Admin dashboard (TODO)
│   ├── .env                   ← NEVER commit this
│   ├── index.html             ← Shell with SEO meta tags
│   └── package.json
└── server/                    ← Node.js backend
    ├── index.js               ← Express server entry
    ├── config/
    │   └── supabase.js        ← Supabase client (service key)
    ├── routes/                ← API routes (TODO)
    │   ├── auth.js
    │   ├── nurses.js
    │   ├── employers.js
    │   ├── jobs.js
    │   ├── admin.js
    │   ├── payments.js
    │   └── webhooks.js
    ├── middleware/             ← (TODO)
    │   └── auth.js
    ├── .env                   ← NEVER commit this
    └── package.json
```

---

## Brand Identity

| Token | Value | Usage |
|---|---|---|
| Sky Blue | #7EB5C8 | Primary brand, email headers, nav accents |
| Soft Blue | #B8D8E4 | Secondary, backgrounds, section fills |
| Warm White | #F5F5F0 | Page background |
| Pure White | #FFFFFF | Cards, form containers |
| Warm Gold | #C8A96E | CTAs, icons, accents |
| Deep Navy | #2C3E50 | Body text, headings, buttons |

**Logo:** `/public/logo.png` — gold wings with SERAPHYN CARE SOLUTIONS text
**Fonts:** Cormorant Garamond (headings), DM Sans (body)
**CSS Variables:** All defined in `client/src/index.css`

---

## Database — Supabase

**Project URL:** https://rchydpjwyfpxuexnipwk.supabase.co
**Region:** US West 2 (Oregon)
**PostgreSQL:** 17.6

### Tables Built (all with RLS enabled)

#### users
id, email, role (nurse|employer|admin), status (pending|approved|rejected|suspended),
full_name, avatar_url, phone, created_at, updated_at, last_login_at

#### nurse_profiles
id, user_id (FK), first_name, last_name, specialty, license_number, license_state,
years_experience, resume_url, license_url, availability, shift_preference, bio,
certifications (array), profile_photo_url, approved_at, created_at, updated_at,
ai_parsed_data (jsonb), ai_job_matches (jsonb), ghl_contact_id, ghl_synced_at

#### employer_profiles
id, user_id (FK), org_name, org_type, contact_name, contact_title, city, state,
bed_count, description, logo_url, onboarding_stage, contract_signed, contract_signed_at,
stripe_customer_id, subscription_status, subscription_start, subscription_ends,
approved_at, created_at, updated_at, ghl_contact_id, ghl_synced_at

#### jobs
id, employer_id (FK), title, specialty, location, city, state, shift_type, pay_rate,
contract_length, description, requirements, status (active|filled|closed|paused),
created_at, updated_at, expires_at

#### applications
id, job_id (FK), nurse_id (FK), employer_id (FK), status
(submitted|reviewing|interview|offer|hired|rejected), cover_note, admin_notes,
created_at, updated_at, placement_fee_pct, hired_at

#### messages
id, sender_id (FK users), receiver_id (FK users), application_id (FK), content,
read (boolean), created_at

#### per_diem_shifts
id, employer_id (FK), nurse_id (FK nullable), specialty, shift_date, start_time,
end_time, hours_worked, hourly_rate, status (open|filled|completed|cancelled),
notes, admin_notes, created_at, updated_at

#### contracts
id, employer_id (FK), template_url, signed_url, google_drive_url,
docuseal_submission_id, status (pending|sent|signed|expired),
sent_at, signed_at, expires_at, created_at, updated_at

#### payments
id, employer_id (FK), type (subscription|placement_fee), amount, currency,
stripe_payment_intent_id, stripe_invoice_id, placement_percentage,
job_id (FK nullable), application_id (FK nullable), status, notes,
created_at, updated_at

### Auth Triggers
- `on_auth_user_created` — fires on every Supabase Auth signup, inserts into public.users
- `on_user_created` — fires on public.users insert, creates nurse_profile or employer_profile

### Extensions Enabled
pgcrypto, uuid-ossp, pg_stat_statements, pg_graphql, pg_trgm, citext, supabase_vault

---

## User Roles and Journeys

### Three User Types
- **nurse** — creates profile, uploads credentials, browses and applies to jobs
- **employer** — registers organization, goes through 3-stage onboarding, posts jobs
- **admin** — approves everything, manages platform, views all data

### Nurse Journey
1. Sign up at /nurse-signup
2. Profile pending admin approval
3. n8n parses uploaded resume via OpenAI, auto-fills profile fields
4. Admin approves — nurse gets email, gains full access
5. Browse jobs, apply, message employers, receive AI-matched recommendations

### Employer Journey — 3 Stages
- **Stage 1:** Create account and organization profile
  - Can see nurse profiles with LIMITED info only
  - (first name, specialty, years experience — no contact details)
- **Stage 2:** Sign staffing agreement via DocuSeal
  - Sent automatically on profile completion
  - Signed PDF saved to Supabase Storage + mirrored to Google Drive
- **Stage 3:** Admin approves signed contract
  - Full nurse profiles visible
  - Can post jobs and per diem shifts
  - Can message nurses directly
  - Can confirm hires (triggers Stripe placement fee)

### Hire Flow
1. Employer posts job or per diem shift
2. Nurses apply
3. Employer reviews applicants, messages nurse
4. Employer confirms hire
5. For permanent: admin sets placement fee % (10-15%), Stripe charges employer
6. Nurse receives notification, submits additional paperwork
7. For per diem: hours tracked in platform, Stripe billing added in Phase 2

---

## Payment Model (Stripe)

| Type | Details |
|---|---|
| Platform Subscription | Free for 3 months, then $99/month auto-billed |
| Permanent Placement Fee | 10-15% (admin sets % per hire), charged via Stripe |
| Per Diem | Hours tracked now, Stripe billing in Phase 2 |

### Stripe Webhooks Required
- payment_intent.succeeded
- customer.subscription.updated
- customer.subscription.deleted
- invoice.payment_failed

---

## Pages and Routes

| Route | Page | Access |
|---|---|---|
| / | Homepage | Public |
| /login | Login | Public |
| /nurse-signup | Nurse registration | Public |
| /employer-signup | Employer registration | Public |
| /jobs | Browse job listings | Public |
| /nurses | Nurse directory (limited info) | Employer only |
| /nurse/dashboard | Nurse dashboard | Nurse only |
| /nurse/profile | Edit nurse profile | Nurse only |
| /nurse/applications | My applications | Nurse only |
| /employer/dashboard | Employer dashboard | Employer only |
| /employer/post-job | Post job or shift | Employer (approved) |
| /employer/onboarding | 3-stage onboarding | Employer |
| /messages | In-app messaging | Authenticated |
| /admin | Admin dashboard | Admin only |
| /admin/nurses | Nurse approval queue | Admin only |
| /admin/employers | Employer approvals | Admin only |
| /admin/jobs | Manage job listings | Admin only |
| /admin/payments | Payment records | Admin only |

---

## Pages Already Built

- `HomePage.jsx` — full marketing page, all sections, real brand colors
- `Login.jsx` — unified login with role-based redirect
- `NurseSignup.jsx` — full signup form with specialty and state dropdowns
- `EmployerSignup.jsx` — org registration form
- `Navbar.jsx` — reusable, transparent on scroll, mobile hamburger, auth-aware
- `ProtectedRoute.jsx` — role-based route guard
- `AuthContext.jsx` — global auth state, signUp/signIn/signOut

---

## Pages Still To Build

### Nurse Portal
- `/nurse/dashboard` — applications tracker, job recommendations, profile completion, docs status
- `/nurse/profile` — edit all profile fields, upload resume and license
- `/nurse/applications` — all applications with status

### Employer Portal
- `/employer/onboarding` — 3-stage flow (profile, DocuSeal signing, pending approval)
- `/employer/dashboard` — active postings, applicants, quick actions, stats
- `/employer/post-job` — post job or per diem shift form

### Shared
- `/jobs` — public job listings with filters (specialty, state, shift type, pay range)
- `/nurses` — nurse directory for employers (limited profile info)
- `/messages` — in-app messaging thread view

### Admin Dashboard (NON-TECHNICAL CLIENT)
**Kundayi is non-technical. Every admin action must be point-and-click with zero code.**
- `/admin` — platform stats overview (total nurses, employers, jobs, revenue, pending approvals)
- `/admin/nurses` — nurse approval queue, view profile + docs, one-click approve/reject
- `/admin/employers` — employer approvals, view org + signed contract, approve/reject
- `/admin/jobs` — all listings, pause/remove/edit
- `/admin/applications` — all applications across platform
- `/admin/payments` — Stripe transactions, set placement fee %, export history
- `/admin/shifts` — per diem shift tracker

---

## Server API Routes Still To Build
```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/nurses          (admin + employer only, limited fields for employer)
GET    /api/nurses/:id
PUT    /api/nurses/:id

GET    /api/jobs            (public)
POST   /api/jobs            (employer only)
PUT    /api/jobs/:id
DELETE /api/jobs/:id

POST   /api/applications
GET    /api/applications
PUT    /api/applications/:id

GET    /api/messages/:applicationId
POST   /api/messages

POST   /api/payments/subscription
POST   /api/payments/placement-fee
POST   /api/webhooks/stripe

GET    /api/admin/stats
GET    /api/admin/nurses
PUT    /api/admin/nurses/:id/approve
PUT    /api/admin/nurses/:id/reject
GET    /api/admin/employers
PUT    /api/admin/employers/:id/approve
POST   /api/webhooks/docuseal
POST   /api/webhooks/ghl
```

---

## n8n Automation Workflows (Phase 3)

| Workflow | Trigger | Action |
|---|---|---|
| Resume Parser | Nurse uploads resume | Send to OpenAI, extract fields, update nurse_profiles.ai_parsed_data |
| Job Matching | Nurse profile approved/updated | Match against active jobs, store top 5 in ai_job_matches |
| Credential Screening | New application submitted | Check license state, specialty match, flag for admin |
| Approval Notifications | Admin approves user | Resend email to nurse or employer |
| GHL Webhook Push | Nurse or employer signs up | POST to GHL API v2, create contact, assign pipeline stage |

---

## DocuSeal E-Signature Flow

1. Install DocuSeal on VPS (Docker)
2. Client uploads staffing agreement PDF as template
3. On employer Stage 1 completion, Node.js calls DocuSeal API
4. Employer receives email with signing link
5. DocuSeal webhook fires on completion
6. Node.js downloads signed PDF, uploads to Supabase Storage
7. n8n mirrors copy to Google Drive folder named after org
8. Admin notified, employer moved to Stage 3

---

## SEO Requirements

- All public pages must pass Google Core Web Vitals
- LCP under 2.5s, CLS under 0.1, INP under 200ms
- SSR or static generation for /, /jobs, /nurses
- Semantic HTML, meta descriptions, og tags on all public pages
- Clean URL slugs — /jobs/icu-travel-rn-chicago not /jobs?id=123
- XML sitemap for public pages
- robots.txt blocks /admin, /nurse/*, /employer/*
- SSL via Let's Encrypt on VPS

---

## Environment Variables

### client/.env
```
VITE_SUPABASE_URL=https://rchydpjwyfpxuexnipwk.supabase.co
VITE_SUPABASE_ANON_KEY=[publishable key]
VITE_API_URL=http://localhost:5000
```

### server/.env
```
PORT=5000
SUPABASE_URL=https://rchydpjwyfpxuexnipwk.supabase.co
SUPABASE_SERVICE_KEY=[secret key]
SUPABASE_ANON_KEY=[publishable key]
JWT_SECRET=seraphyn_super_secret_jwt_2026
STRIPE_SECRET_KEY=[stripe secret]
STRIPE_WEBHOOK_SECRET=[stripe webhook secret]
RESEND_API_KEY=[resend key]
CLIENT_URL=http://localhost:5173
```

---

## Milestones

| Milestone | Scope | Due | Payment |
|---|---|---|---|
| M1 — Foundation | Auth, nurse/employer signup, core dashboards, VPS live | Day 10 | $180 |
| M2 — Full Platform | Payments, DocuSeal, messaging, AI resume parsing | Day 17 | $150 |
| M3 — Launch Ready | n8n workflows, GHL webhook, SEO, QA, Loom | Day 21 | $120 |

---

## Critical Rules

1. **Never commit .env files** — both are in .gitignore
2. **Client is non-technical** — admin panel must be fully point-and-click
3. **Always check mobile** — test every page at 390px (iPhone 12 Pro)
4. **Brand colors only** — use CSS variables, never hardcode hex values
5. **Ask before architecture changes** — don't change tech stack or folder structure
6. **RLS is on** — all Supabase queries from the frontend use the anon key
7. **Service key stays on server only** — never expose in client code
8. **Confirm platform versions** before using new libraries
9. **Node.js is v24, dotenv is v17** — logging behaviour is different from older versions
10. **Build order** — complete one feature fully before starting the next
