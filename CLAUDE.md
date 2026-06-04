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
10. The repo no longer keeps the top-level browser test suite or `tmp/` scratch artifacts; if new QA automation is added, document it explicitly before checking it in.
11. Internal operational alerts for new signups, nurse 100% completion, and employer agreement completion are routed to `info@seraphyncare.com`.
12. Portal messaging supports both application threads and direct user-to-user threads. Direct threads store `messages.application_id = null`.

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
- The nurse lead bridge in production currently expects `x-seraphyn-secret: seraphyn2026!` for the GHL nurse lead webhook action.
- Employer contract emails now go through Resend with attachments and `cc` support when agreements are signed in the portal; current CC target is `info@seraphyncare.com`.
- Internal operational email alerts default to `info@seraphyncare.com` via `INTERNAL_ALERT_EMAIL` or the hardcoded fallback.

---

## Auth Status

Current live auth flow state:

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
- `POST /api/employers/contracts/sign` signs both agreements in one session, stores signed PDFs in private Supabase storage, emails both signed copies to the employer, CCs `info@seraphyncare.com`, and raises internal approval notifications.
- The employer agreement UX is now portal-native and field-driven rather than PDF-page review only; required agreement fields must be completed before both agreements can be marked reviewed and signed.
- The rendered agreement templates now track the legal text of the source PDFs much more closely than the earlier short summaries, while preserving portal-native required fields/acknowledgements and final signed PDF output.
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
- `Seraphyn - Portal Events Inbound` is live in production as workflow `xh5ruX7lGR9m8vIE`
- `Seraphyn - Resume Parser` has been exported to production as workflow `xFl2h0aUGWqK7Zsb` and remains inactive until a real Anthropic API key is set
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
  - `shift_preference` is stored as `any`
  - `availability` is stored as `available`
  - legacy signup values such as `Permanent`, `Per Diem`, `Contract Travel`, `Day`, `Night`, `Evening`, and `Mixed` are normalized during bootstrap
- Nurse profile page now exposes a direct `Go to Dashboard` CTA so mobile users are not trapped at the bottom of the form
- Messaging now supports direct admin-to-nurse, admin-to-employer, and approved employer-to-nurse conversations even when no application thread exists yet
- Client-facing pre-call handover is tracked in [docs/CLIENT_HANDOVER_2026-05-27.md](docs/CLIENT_HANDOVER_2026-05-27.md)
- GHL workflow docs aligned to offline billing
- n8n docs aligned to live M2 scope
- Approval and application transitions routed through server hooks where needed

---

## Known Active Constraints

- Payments are offline by decision, not by blocker
- GHL contact sync must exist before contract send can succeed
- The `contracts` table now supports one row per agreement document. Legacy GHL sends may still reuse `docuseal_submission_id` as an external reference field.
- The seeded test employer still owns the retained sample jobs/application data used for portal verification. Cleanup did not remove those records because the test employer account was intentionally preserved.
- Admin UI still uses a mix of Supabase-direct and API-driven actions; approval and contract actions should prefer the server routes
- The shared `/messages` page currently uses the standard portal navbar even for admin direct-message threads; this does not block messaging, but a dedicated admin message layout remains a polish item.
- Portal milestone events can now fan out to n8n and optional GHL workflow webhook URLs; fastest-launch recommendation is one shared `GHL_WORKFLOW_WEBHOOK_URL`, with per-event overrides available later via `GHL_WORKFLOW_WEBHOOK_URL_<EVENT_NAME>`
- Resume parser production activation is blocked until the real `ANTHROPIC_API_KEY` is loaded into the native n8n `Seraphyn Anthropic API` credential

---

## Reference Docs

| File | Purpose |
|---|---|
| [docs/DATABASE.md](docs/DATABASE.md) | Current schema and important table notes |
| [docs/GHL.md](docs/GHL.md) | GHL build brief, funnels, forms, calendars |
| [docs/GHL_AUTOMATIONS.md](docs/GHL_AUTOMATIONS.md) | 11 workflow architecture and portal events |
| [docs/PAYMENTS.md](docs/PAYMENTS.md) | Offline billing + GHL Documents contract model |
| [docs/N8N.md](docs/N8N.md) | M2 automation bundle and integration design |
