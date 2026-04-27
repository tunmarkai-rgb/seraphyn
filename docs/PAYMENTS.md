# PAYMENTS.md - M2 Billing + Contracts Model
# Phase 2

> M2 has no online payment collection.
> Billing is offline. Contracts are handled through GHL Documents.

---

## Summary

Seraphyn M2 uses three systems together:

- Portal app: onboarding state, admin workflows, dashboard access
- GHL Documents: send and sign staffing agreements
- n8n: async automation and contact/notification orchestration

Payments do not run through Stripe, GHL payment links, or the portal UI in M2.

---

## Billing Rules

| Billing Item | M2 Handling |
|---|---|
| Platform subscription | Kundayi invoices employer offline |
| Placement fee | Kundayi invoices employer offline after hire |
| Per diem billing | Portal tracks hours, Kundayi invoices offline |

The `payments` table remains a manual tracking/reporting table. It is not a source for live payment processing in M2.

---

## Contract Flow

### 1. Employer profile submitted

- Employer finishes Stage 1 profile setup in the portal
- `employer_profiles.onboarding_stage` moves to `contract`
- Employer waits for Seraphyn to send the staffing agreement

### 2. Admin sends contract

- Admin triggers `POST /api/admin/employers/:id/send-contract`
- Server calls GHL Documents template send API
- Server creates or updates a `contracts` row with:
  - `status = sent`
  - `sent_at`
  - `template_url = ghl-template:<templateId>`
  - GHL document reference stored in the legacy `docuseal_submission_id` field for now

### 3. Employer signs in GHL

- GHL sends `DocumentSigned` to `POST /api/webhooks/ghl`
- Server verifies the webhook secret
- Server matches the employer by GHL document reference or contact email
- Server updates:
  - `contracts.status = signed`
  - `contracts.signed_url`
  - `contracts.signed_at`
  - `employer_profiles.contract_signed = true`
  - `employer_profiles.contract_signed_at`

### 4. Admin approves account

- Admin approval remains the final unlock
- `employer_profiles.onboarding_stage` becomes `approved`
- Employer gets dashboard access

---

## Required Server Interfaces

### `POST /api/admin/employers/:id/send-contract`

Purpose:
- Send staffing agreement from the configured GHL template

Expected behavior:
- Require admin auth
- Require `GHL_API_KEY`, `GHL_LOCATION_ID`, and `GHL_DOCUMENT_TEMPLATE_ID`
- Require `GHL_USER_ID` for the GHL template send API
- Require employer to already have `ghl_contact_id`
- If `ghl_contact_id` is missing, attempt a server-side GHL contact sync before failing
- Refuse resend once `contract_signed = true`

### `POST /api/webhooks/ghl`

Purpose:
- Handle inbound GHL document events

M2 scope:
- `DocumentSigned` only

Out of scope for M2:
- `PaymentSuccess`
- subscription creation/cancellation
- any live billing automation

---

## GHL Requirements

Kundayi must provide or complete:

- GHL private integration token / API access
- GHL location ID
- Staffing agreement template uploaded in GHL Documents
- Template ID for the staffing agreement
- GHL user ID used as the document sender for template delivery
- Webhook target for `DocumentSigned`
- Shared secret used by the portal to verify GHL webhook calls

---

## Portal UX Rules

- Keep the 3-step employer onboarding experience
- Stage 2 is the real contract stage
- Show waiting/sent/signed messaging only
- Do not show payment links, checkout CTAs, or subscription collection UI

---

## What Is Intentionally Not in M2

- Stripe integration
- GHL Payments integration
- payment links in funnels or portal
- payment success webhooks
- automatic subscription state management

Those items are explicitly deferred while offline billing remains the operating model.
