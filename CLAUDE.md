# CLAUDE.md - Seraphyn Care Solutions
# Master Project Reference

> Reference `docs/` for detailed implementation notes on database, GHL, payments/contracts, and n8n.
> M2 is now centered on offline billing, GHL Documents, and n8n automation.

---

## Project Overview

Two-sided healthcare staffing marketplace.

- Client: Kundayi Washaya (`kundayiw@gmail.com`)
- Dev: Abdulrasheed Olatunji
- Portal: `https://seraphyn.vercel.app`
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
| CRM + Contracts | GoHighLevel + GHL Documents | M2 active |
| AI Automation | n8n + OpenAI | M2 active |
| Payments | Offline only | M2 active |
| Hosting | Vercel (client) + Hostinger VPS/server target | Mixed |

---

## Ground Rules

1. Payments stay offline in M2. Do not wire Stripe or GHL payment links into the portal.
2. Contracts are sent and signed through GHL Documents.
3. The portal remains the source of truth for app state, access control, and onboarding status.
4. n8n owns async automation: resume parsing, job matching, approval notifications, and contact sync.
5. Canonical employer onboarding states are `profile`, `contract`, and `approved`.
6. Service-role Supabase credentials stay server-only.
7. Build must pass before closeout: `npm run build` in `client/`.

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
VITE_SUPABASE_ANON_KEY=[publishable key]
VITE_API_URL=http://localhost:5000
```

### server/.env

```env
PORT=5000
SUPABASE_URL=https://rchydpjwyfpxuexnipwk.supabase.co
SUPABASE_SERVICE_KEY=[secret key]
SUPABASE_ANON_KEY=[publishable key]
JWT_SECRET=seraphyn_super_secret_jwt_2026
CLIENT_URL=http://localhost:5173

GHL_API_KEY=[private integration token]
GHL_LOCATION_ID=[ghl location id]
GHL_DOCUMENT_TEMPLATE_ID=[ghl staffing agreement template id]
GHL_WEBHOOK_SECRET=[shared secret for /api/webhooks/ghl]
GHL_WORKFLOW_WEBHOOK_URL=[optional shared inbound webhook for portal milestone events]
GHL_WORKFLOW_WEBHOOK_SECRET=[optional shared secret for portal milestone webhooks]

OPENAI_API_KEY=[openai key for n8n]
N8N_WEBHOOK_URL=[optional inbound event webhook from portal to n8n]
N8N_WEBHOOK_SECRET=[shared secret for portal -> n8n webhook]
```

---

## Employer Access Model

| Stage | Value | Meaning |
|---|---|---|
| 1 | `profile` | Employer has created account / organization profile |
| 2 | `contract` | GHL staffing agreement is pending or sent |
| 3 | `approved` | Contract signed and team approved account |

Approved employers get full portal access. Unsanctioned or mid-onboarding employers remain restricted.

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

- Admin sends staffing agreements from the portal through `POST /api/admin/employers/:id/send-contract`
- GHL Documents delivers the contract to the employer
- `POST /api/webhooks/ghl` handles `DocumentSigned`
- Signed documents update:
  - `contracts.status`
  - `contracts.signed_url`
  - `employer_profiles.contract_signed`
  - `employer_profiles.contract_signed_at`
- Admin approval is still the final step before dashboard access

---

## n8n Scope in M2

These flows are now part of M2:

1. Resume Parser
2. Job Matching
3. Admin Credential Screening
4. Approval Notification Emails
5. GHL Contact Sync

Supabase webhooks should trigger the core n8n flows. Optional portal-to-n8n event forwarding can use `N8N_WEBHOOK_URL`.

Current production n8n state:
- `Seraphyn - Portal Events Inbound` is live in production as workflow `xh5ruX7lGR9m8vIE`
- `Seraphyn - Resume Parser` has been exported to production as workflow `xFl2h0aUGWqK7Zsb` and remains inactive until a real OpenAI API key is set
- native n8n credentials now hold the shared webhook secret and Supabase auth, so workflow JSON exports should not embed credentials directly

---

## Milestones

| # | Scope | Status |
|---|---|---|
| M1 | Auth, dashboards, core marketplace, Vercel live | Complete |
| M2 | Offline billing model, GHL Documents contracts, GHL workflow alignment, full n8n automation bundle | In progress |
| M3 | SEO, QA hardening, production polish, post-M2 cleanup | Next |

### M2 Deliverables

- GHL Documents contract send + signed webhook flow
- Employer onboarding aligned to `profile -> contract -> approved`
- Admin contract send/resend controls
- GHL workflow docs aligned to offline billing
- n8n docs aligned to live M2 scope
- Approval and application transitions routed through server hooks where needed

---

## Known Active Constraints

- Payments are offline by decision, not by blocker
- GHL contact sync must exist before contract send can succeed
- Signed-contract matching currently reuses `contracts.docuseal_submission_id` as a legacy storage field for the GHL document reference until a schema cleanup happens
- Admin UI still uses a mix of Supabase-direct and API-driven actions; approval and contract actions should prefer the server routes
- Portal milestone events can now fan out to n8n and optional GHL workflow webhook URLs; per-event overrides can be configured with `GHL_WORKFLOW_WEBHOOK_URL_<EVENT_NAME>`
- Resume parser production activation is blocked until the real `OPENAI_API_KEY` is loaded into the native n8n `Seraphyn OpenAI API` credential

---

## Reference Docs

| File | Purpose |
|---|---|
| [docs/DATABASE.md](docs/DATABASE.md) | Current schema and important table notes |
| [docs/GHL.md](docs/GHL.md) | GHL build brief, funnels, forms, calendars |
| [docs/GHL_AUTOMATIONS.md](docs/GHL_AUTOMATIONS.md) | 11 workflow architecture and portal events |
| [docs/PAYMENTS.md](docs/PAYMENTS.md) | Offline billing + GHL Documents contract model |
| [docs/N8N.md](docs/N8N.md) | M2 automation bundle and integration design |
