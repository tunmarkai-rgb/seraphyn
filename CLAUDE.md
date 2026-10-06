# CLAUDE.md - Seraphyn Care Solutions
# Master Project Reference

> Reference `docs/` for detailed implementation notes on database, GHL, payments/contracts, and n8n.
> M2 is now centered on offline billing, portal-native employer contracts, GHL CRM automation, and n8n orchestration.

---

## Project Overview

Two-sided healthcare staffing marketplace.

- Client: Kundayi Washaya (`kundayiw@gmail.com`)
- Dev: Abdulrasheed Olatunji
- Portal: `https://staffing.seraphyncare.com`
- Primary domain target: `staffing.seraphyncare.com`
- GHL: `consult.seraphyncare.com`
- Supabase: `https://rchydpjwyfpxuexnipwk.supabase.co`

---

## Tech Stack

| Layer | Technology | Status |
|---|---|---|
| Frontend | React + Vite | Live |
| Backend | Node.js + Express | Live |
| Database | Supabase PostgreSQL | Live |
| CRM + Legacy Contract Fallback | GoHighLevel + GHL Documents | M2 active |
| AI Automation | n8n + Claude (Anthropic) | M2 active |
| Payments | Offline only | M2 active |
| Hosting | Vercel (frontend) + DigitalOcean droplet (backend) + Docker/Caddy (n8n + public proxy) | Live |

---

## Ground Rules

1. Payments stay offline in M2. Do not wire Stripe or GHL payment links into the portal.
2. Employer agreements are signed in the portal by default. GHL Documents remains a fallback path only.
3. The portal remains the source of truth for app state, access control, and onboarding status.
4. n8n owns async automation: resume parsing, job matching, screening, and contact sync orchestration.
5. GHL owns contact-facing notification delivery for approved business email/SMS sequences in M2.
6. Canonical employer onboarding states are `profile`, `contract`, and `approved`.
7. Supabase secret credentials stay server-only; Supabase publishable key stays frontend-safe only.
8. Build must pass before closeout: `npm run build` in `client/`.
9. Supabase Auth currently owns signup confirmation and password reset delivery; those auth emails are branded and sent through Resend SMTP, not GHL.
10. Pricing is transparent by Kundayi's decision (2026-10-06): **nurse's desired pay + flat Seraphyn fee (default $17, editable at `/admin/settings`) = hospital bill rate**. Hospitals see the full breakdown and nurses see the bill rate their pay produces. What stays private is each hospital's **budget per job** (target/maximum bill rate in `job_budgets`): nurses only ever see a coarse fit label, never the number. `job_budgets` is a separate table because `jobs` is nurse-readable and RLS is row-level; never put a budget column on `jobs` and never write the deprecated `jobs.pay_rate`. Raw `nurse_rates` rows and rate history stay server/admin-only.
11. The repo no longer keeps the top-level browser test suite or `tmp/` scratch artifacts; if new QA automation is added, document it explicitly before checking it in.
12. Internal operational alerts for new signups, nurse 100% completion, and employer agreement completion are routed to `info@seraphyncare.com`.
13. Portal messaging supports both application threads and direct user-to-user threads. Direct threads store `messages.application_id = null`.
14. GHL form answers (the `leads` table) are applied to a portal profile only after Supabase has confirmed that account's email, and only into empty fields. Never return lead data to an unauthenticated browser.
15. Portal → GHL contact writes use the funnel forms' custom-field keys (`primary_specialty`, `organization_name`, ...) and add tags additively. The portal adds `nurse-portal-registered` / `employer-portal-registered`, never `nurse-lead` / `staffing-lead` (those start GHL nurture sequences).

---

## Project Structure

```text
seraphyn/
|-- CLAUDE.md
|-- docs/
|   |-- DATABASE.md
|   |-- GHL.md
|   |-- GHL_AUTOMATIONS.md
|   |-- N8N.md
|   `-- PAYMENTS.md
|-- client/
|   |-- src/
|   |   |-- components/
|   |   |-- context/
|   |   |-- lib/
|   |   `-- pages/
|   `-- vercel.json
`-- server/
    |-- config/
    |-- lib/
    |-- middleware/
    `-- routes/
```

---

## Environment Variables

### client/.env

```env
VITE_SUPABASE_URL=https://rchydpjwyfpxuexnipwk.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[publishable key]
VITE_APP_URL=https://staffing.seraphyncare.com
VITE_API_URL=https://api.seraphyncare.com
```

### server/.env

```env
PORT=5000
SUPABASE_URL=https://rchydpjwyfpxuexnipwk.supabase.co
SUPABASE_SERVICE_KEY=[service role key]
JWT_SECRET=seraphyn_super_secret_jwt_2026
CLIENT_URL=https://staffing.seraphyncare.com
CLIENT_URLS=https://staffing.seraphyncare.com
CORS_ORIGINS=https://staffing.seraphyncare.com

GHL_API_KEY=[private integration token]
GHL_LOCATION_ID=[ghl location id]
GHL_DOCUMENT_TEMPLATE_ID=[ghl staffing agreement template id]
GHL_WEBHOOK_SECRET=[shared secret for /api/webhooks/ghl]
GHL_WORKFLOW_WEBHOOK_URL=[recommended shared inbound GHL workflow webhook for fastest launch]
GHL_WORKFLOW_WEBHOOK_SECRET=[shared secret for portal milestone webhooks]

ANTHROPIC_API_KEY=[anthropic key for n8n]
N8N_WEBHOOK_URL=[optional inbound event webhook from portal to n8n]
N8N_WEBHOOK_SECRET=[shared secret for portal -> n8n webhook]
CLIENT_URLS=[optional comma-separated frontend origins for backend CORS]
CORS_ORIGINS=[optional comma-separated override for allowed frontend origins]
```

Notes:
- The backend accepts either `SUPABASE_SERVICE_KEY` or `SUPABASE_SECRET_KEY`.
- On the current DigitalOcean production droplet, public routing is handled by the existing Docker/Caddy stack, not by Nginx.
- The frontend uses `VITE_APP_URL` when building auth email redirect targets so confirmation and reset links do not fall back to localhost.
- GHL form workflows post to `POST /api/leads/ghl` with header `x-seraphyn-secret` = `LEAD_BRIDGE_SECRET` (also accepts `GHL_WORKFLOW_WEBHOOK_SECRET` / `N8N_WEBHOOK_SECRET`). The existing value is kept by client decision (not rotated); keep it out of committed docs. The signed-token `/api/leads/nurse-prefill` bridge is retired (410).
- Employer contract emails now go through Resend with attachments and `cc` support when agreements are signed in the portal; current CC target is `info@seraphyncare.com`.

---

## Auth Status

Current live auth flow state:

- Signup is one short page at `/signup?role=nurse|employer` (name, email, password). `/nurse-signup` and `/employer-signup` redirect there with their query string. Profile details are collected after confirmation, on the nurse profile page or employer onboarding Step 1, prefilled from a GHL lead when one exists

- Signup confirmation route is live at `https://staffing.seraphyncare.com/auth/confirm`
- Password reset request page is live at `https://staffing.seraphyncare.com/forgot-password`
- Password reset completion route is live at `https://staffing.seraphyncare.com/auth/reset-password`
- Vercel production frontend has already been redeployed with both routes
- Supabase `Site URL` should remain `https://staffing.seraphyncare.com`
- Supabase Redirect URLs should include:
  - `https://staffing.seraphyncare.com/auth/confirm`
  - `https://staffing.seraphyncare.com/auth/reset-password`
- Resend SMTP is now connected to Supabase for branded auth email delivery

Behavior notes:

- Email confirmation should redirect confirmed nurses into `/nurse/dashboard`
- Confirmed employers are redirected into `/employer/onboarding`
- Reset-password links should land on `/auth/reset-password` and then return the user to `/login?reset=1` after a successful password change
- `nurse.signup_confirmed` is fired after email confirmation succeeds, not immediately at signup creation
- The public homepage at `/` is guest-facing only; signed-in nurses/employers are redirected to their dashboards and admins to `/admin`
- The public nurse directory at `/nurses` is served by `GET /api/nurses/directory` and **intentionally shows approved nurses to signed-out guests** (first name, specialty, experience, certifications; no last name, no bio, no rate). Kundayi approved this on 2026-09-08. Before that route existed the page read `nurse_profiles` with the publishable key and rendered empty, because live RLS returns no rows to the `anon` role — do not treat the guest-visible directory as a regression
- The rate breakdown (desired pay + fee = hospital rate) on `/nurses` and `/nurses/:id` is shown only to fully-onboarded employers and admins; unapproved employers see `Unlocks after approval`, and guests and nurses see no rate row at all. (The fee amount itself is public via `GET /api/pricing`.)

Current retained baseline accounts after cleanup:

- Admin: `kundayiw@gmail.com`
- Test nurse: `nurse.test@seraphyn.com`
- Test employer: `employer.test@seraphyn.com`

All other ad-hoc signup accounts created during implementation testing were removed from Supabase Auth and the related app tables.

---

## Employer Access Model

| Stage | Value | Meaning |
|---|---|---|
| 1 | `profile` | Employer has created account / organization profile |
| 2 | `contract` | agreement review / signing stage |
| 3 | `approved` | Contract signed and team approved account |

Approved employers get full portal access. Unsanctioned or mid-onboarding employers remain restricted.

Current UX notes:

- Employer onboarding Step 3 exposes a direct CTA into `/employer/dashboard`
- Pending employers can open the dashboard and see an approval-in-progress state plus their signed agreement downloads
- Pending employers should not loop back to Step 1 when using the dashboard CTA

---

## Payment Model

All billing is offline for M2.

| Type | Handling |
|---|---|
| Platform subscription | Kundayi invoices offline |
| Placement fee | Kundayi invoices offline after hire |
| Per diem billing | Hours tracked in portal, invoiced offline |

`/api/payments/*` remains read-only/manual messaging only. Do not add payment collection code in M2.

---

## Contracts Model

- Portal-native signing is the primary employer contract path.
- Step 2 of employer onboarding shows onboarding guidance plus both required agreements:
  - Direct Hire Agreement
  - Per Diem Staffing Agreement
- Internal operational email alerts default to `info@seraphyncare.com` via `INTERNAL_ALERT_EMAIL` or the hardcoded fallback.
- `POST /api/employers/contracts/sign` signs both agreements in one session, appends an audit page to each PDF, stores them in private Supabase storage, emails both signed copies to the employer, and CCs `info@seraphyncare.com`.
- The employer agreement UX is portal-native and field-driven rather than PDF-page review only; required agreement fields must be completed before both agreements can be marked reviewed and signed.
- The rendered agreement templates track the legal text of the source PDFs closely, while preserving portal-native required fields/acknowledgements and final signed PDF output.
- Signed documents update:
  - `contracts.status`
  - `contracts.document_type`
  - `contracts.signed_storage_path`
  - `contracts.signed_by_*`
  - `contracts.signature_audit`
  - `employer_profiles.contract_signed`
  - `employer_profiles.contract_signed_at`
- `GET /api/contracts/:id/download` serves private signed download links for employers and admins.
- `POST /api/admin/employers/:id/send-contract` still exists as the legacy GHL fallback path when needed.
- Admin approval is still the final step before dashboard access.

Messaging and handover notes:

- Messaging supports direct admin-to-nurse, admin-to-employer, and approved employer-to-nurse conversations even when no application thread exists yet
- Admin message threads render inside the admin shell; nurse/employer message threads keep the standard portal navbar
- Client-facing pre-call handover is tracked in [docs/CLIENT_HANDOVER_2026-05-27.md](docs/CLIENT_HANDOVER_2026-05-27.md)

---

## n8n Scope in M2

These flows are now part of M2:

1. Resume Parser
2. Job Matching
3. Admin Credential Screening
4. Approval Notification Triggers
5. GHL Contact Sync

Supabase webhooks should trigger the core n8n flows. Optional portal-to-n8n event forwarding can use `N8N_WEBHOOK_URL`.

Current production n8n state:
- `Seraphyn - Portal Events Inbound` is live in production as workflow `JBhroT3TwEIrXPwj` (the instance was re-imported; the old ID `xh5ruX7lGR9m8vIE` is gone)
- `Seraphyn - Resume Parser` is workflow `1uJ9q9dgaYSqczjZ` (old ID `xFl2h0aUGWqK7Zsb` is gone) and is **active and verified end to end**: a real 2-page PDF runs webhook -> normalize -> Supabase lookup -> download -> extract -> Call Claude -> write-back, at roughly half a cent per resume
- native n8n credentials now hold the shared webhook secret and Supabase auth, so workflow JSON exports should not embed credentials directly
- GHL is the approved owner for contact-facing notifications in M2; n8n remains the orchestrator behind those triggers

---

## Milestones

| # | Scope | Status |
|---|---|---|
| M1 | Auth, dashboards, core marketplace, Vercel live | Complete |
| M2 | Offline billing model, GHL Documents contracts, GHL workflow alignment, full n8n automation bundle | In progress |
| M3 | SEO, QA hardening, production polish, post-M2 cleanup | Next |

### M2 Deliverables

- Portal-native employer contract signing + signed PDF delivery
- GHL contract send/resend preserved as fallback
- Employer onboarding aligned to `profile -> contract -> approved`
- Admin contract send/resend controls
- Nurse certification proof uploads + private document access
- Nurse profile upload flow now uses server bootstrap plus canonical enum normalization:
  - `shift_preference` is the enum `per_diem | contract_travel | permanent | any` (default `any`)
  - `availability` is the enum `available | placed | unavailable` (default `available`)
  - legacy signup values such as `Permanent`, `Per Diem`, `Contract Travel`, `Day`, `Night`, `Evening`, and `Mixed` are normalized during bootstrap
- Nurse profile page now exposes a direct `Go to Dashboard` CTA so mobile users are not trapped at the bottom of the form
- GHL workflow docs aligned to offline billing
- n8n docs aligned to live M2 scope
- Approval and application transitions routed through server hooks where needed
- Transparent marketplace pricing and matching (Kundayi, 2026-10-06; replaced the confidential 30% markup):
  - nurses set an optional **desired pay**; admin can override it with a required reason
  - `bill_rate = desired pay + agency_fee` (flat, default $17, no rounding), shown as a breakdown to hospitals and as "your potential hospital bill rate" to nurses
  - per-diem/contract hourly only; direct hire keeps its 10% placement-fee model
  - job posts carry a target and maximum bill rate (`job_budgets`, nurse-unreadable) and an urgency (`standard | urgent | critical` on `jobs`)
  - the directory compares nurses against one of the employer's jobs or a typed budget: 🟢 within target / 🟡 within max / above budget, ranked by a match score in `server/lib/matching.js` (specialty, rate fit, licence state, certifications, availability, experience, urgency). Rate is a matching variable, never a filter; above-budget nurses get "Consider Anyway", which opens Request This Nurse
  - nurses see a market-response card (fits / above budget but urgent / below their rate), fit labels on jobs, and scored recommendations via `GET /api/nurses/self/market`
  - nurse requests and per-diem shifts snapshot `agency_fee_snapshot`; shifts warn when Seraphyn earns less than the fee
  - schema: [docs/MARKETPLACE_PRICING.sql](docs/MARKETPLACE_PRICING.sql)
- Employer-initiated nurse requests ("Request this nurse"):
  - employers request a specific nurse; admin reviews, sets the nurse's offered rate, then presents it
  - the nurse sees nothing until presented, then accepts or declines directly with no admin relay
  - employers see only coarse labels so they cannot tell whether the nurse has been asked yet
  - lives in `nurse_requests`, not `applications` (no job, and rate columns would leak both ways)
  - `server/lib/employer-access.js` now holds the single definition of employer full access, replacing four inline copies
- Two-way GHL ↔ portal contact sync (single signup, GHL lead prefill):
  - GHL nurse/employer form → GHL workflow webhook → `POST /api/leads/ghl` → `leads` row + Resend "Finish creating your account" email + `portal_signup_url` on the GHL contact
  - lead is claimed on email confirmation (`/api/integrations/ghl/sync-self`, nurse bootstrap, `POST /api/employers/self/bootstrap`)
  - portal contacts reach GHL at signup (not only after confirmation) and after profile saves; an existing `ghl_contact_id` is updated in place with `PUT /contacts/:id`
  - `server/lib/lead-normalize.js` maps GHL option labels ↔ portal values; `node server/scripts/ghl-custom-fields.js` checks the live GHL keys
- Per-diem shift rate reconciliation:
  - `per_diem_shifts.hourly_rate` is now explicitly the **bill rate the employer pays**, relabelled in the employer shift form
  - `nurse_pay_rate` and `markup_pct_snapshot` are admin-set and snapshotted at booking, never recomputed
  - admin shift cards show nurse pay / markup / bill rate with a live margin, and warn on a thin or below-cost shift
  - assigning a nurse prefills their pay from their current rate; the admin shift PUT allowlist now covers `nurse_id`, `nurse_pay_rate` and `markup_pct_snapshot`

---

## Known Active Constraints

- Payments are offline by decision, not by blocker
- GHL contact sync must exist before contract send can succeed
- The `contracts` table now supports one row per agreement document. Legacy GHL sends may still reuse `docuseal_submission_id` as an external reference field.
- The seeded test employer still owns the retained sample jobs/application data used for portal verification. Cleanup did not remove those records because the test employer account was intentionally preserved.
- Admin UI still uses a mix of Supabase-direct and API-driven actions; approval and contract actions should prefer the server routes
- Portal milestone events can now fan out to n8n and optional GHL workflow webhook URLs; fastest-launch recommendation is one shared `GHL_WORKFLOW_WEBHOOK_URL`, with per-event overrides available later via `GHL_WORKFLOW_WEBHOOK_URL_<EVENT_NAME>`
- The resume parser calls the Messages API through a plain **HTTP Request node**, not the n8n LangChain AI Agent. The agent node's runtime is what OOM-killed the n8n container on a 7KB PDF; the payload was never the problem. Structured outputs (`output_config.format` with a `json_schema`) give schema-valid JSON, which is why no output parser is needed. Do not reintroduce `@n8n/n8n-nodes-langchain.*` nodes into this workflow without checking memory headroom first
- The Claude request body (model, schema, system prompt) is built in the `Prepare Resume Prompt` code node and serialised by the HTTP node as `{{ JSON.stringify($json.claudeRequest) }}`, so the schema stays readable rather than buried in a node field
- n8n shares the DigitalOcean droplet with the portal API (`api.seraphyncare.com` and `n8n.seraphyncare.com` resolve to the same IP), so an n8n OOM threatens production. The droplet was resized for headroom on 2026-09-09
- n8n credentials on the current instance had to be recreated from scratch: the shared webhook credential existed but held no data, the Supabase credential ID did not exist, and the Anthropic credential ID was the literal placeholder `replace-me`. Live credentials are now `Seraphyn Portal Webhook Secret`, `Seraphyn Supabase Service Role` and `Seraphyn Anthropic API Key`
- The `resumes` bucket is private, so the parser's download nodes use the authenticated `/storage/v1/object/{bucket}/{path}` endpoint with the Supabase service-role credential. Do **not** switch them back to the public URL, and do not make the bucket public
- Live n8n credentials: `Seraphyn Portal Webhook Secret`, `Seraphyn Supabase Service Role`, `Seraphyn Anthropic API Key` (dedicated nodes) and `Seraphyn Anthropic API (HTTP)` (scoped to `api.anthropic.com` for the HTTP Request node)
- n8n credential `allowedHttpRequestDomains` is a trap worth remembering: a credential set to `none` cannot be used by an HTTP Request node, and the schema's `allOf` treats an ABSENT value as matching `domains` and then demands `allowedDomains`. Always set it explicitly. The public API can create credentials but cannot update an existing one's data, so a mis-scoped credential has to be replaced

---

## Reference Docs

| File | Purpose |
|---|---|
| [docs/DATABASE.md](docs/DATABASE.md) | Current schema and important table notes |
| [docs/GHL.md](docs/GHL.md) | GHL build brief, funnels, forms, calendars |
| [docs/GHL_AUTOMATIONS.md](docs/GHL_AUTOMATIONS.md) | 11 workflow architecture and portal events |
| [docs/PAYMENTS.md](docs/PAYMENTS.md) | Offline billing + GHL Documents contract model |
| [docs/N8N.md](docs/N8N.md) | M2 automation bundle and integration design |
| [docs/NURSE_RATES.sql](docs/NURSE_RATES.sql) | Nurse rate + agency markup schema (hand-apply in Supabase) |
| [docs/NURSE_REQUESTS.sql](docs/NURSE_REQUESTS.sql) | Employer-initiated nurse request schema (hand-apply in Supabase) |
| [docs/PER_DIEM_SHIFT_RATES.sql](docs/PER_DIEM_SHIFT_RATES.sql) | Per-diem shift nurse pay + markup snapshot columns (hand-apply in Supabase) |
| [docs/LEADS.sql](docs/LEADS.sql) | GHL lead intake table for the form → portal handoff (hand-apply in Supabase) |
| [docs/MARKETPLACE_PRICING.sql](docs/MARKETPLACE_PRICING.sql) | Flat agency fee, job budgets + urgency, fee snapshots (hand-apply in Supabase) |
| [docs/GHL_WORKFLOW_PROMPTS.md](docs/GHL_WORKFLOW_PROMPTS.md) | Paste-ready prompts for building the remaining GHL workflows |
