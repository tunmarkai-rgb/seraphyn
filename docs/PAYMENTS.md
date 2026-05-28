# PAYMENTS.md - M2 Billing + Contracts Model

> M2 has no online payment collection.
> Billing is offline.
> Employer agreements are signed inside the portal by default.

---

## Summary

Seraphyn M2 currently uses:

- Portal app: onboarding state, contract signing, document storage, access control
- GHL: CRM, nurture, pipeline updates, legacy contract fallback
- n8n: async automation and contact sync orchestration

Payments do not run through Stripe, GHL payment links, or portal checkout in M2.

---

## Billing Rules

| Billing Item | M2 Handling |
|---|---|
| Platform subscription | invoiced offline |
| Placement fee | invoiced offline after hire |
| Per diem billing | tracked in portal, invoiced offline |

`payments` remains a manual tracking/reporting table only.

---

## Employer Agreement Flow

### Default path: portal-native signing

1. Employer completes Stage 1 profile setup.
2. Employer reaches onboarding Step 2 in the portal.
3. Step 2 shows:
   - onboarding guidance
   - Direct Hire Agreement
   - Per Diem Staffing Agreement
   - explicit required agreement fields and acknowledgements
   - one shared signature panel
4. Employer signs once through `POST /api/employers/contracts/sign`.
5. Server:
   - generates signed PDFs for both agreements
   - appends an audit/signature page to both source PDFs
   - stores both signed files in private `contracts` storage
   - upserts one `contracts` row per agreement document
   - sets `employer_profiles.contract_signed = true`
   - emails both signed PDFs to the employer
   - CCs `info@seraphyncare.com`
   - raises admin approval notifications
6. Employer moves to Step 3 pending approval.
7. Admin approval remains the final unlock for dashboard access.

### Legacy fallback: GHL Documents

- `POST /api/admin/employers/:id/send-contract` still exists.
- Use it only when the portal-native contract path is unavailable or needs manual fallback.
- Legacy webhook handling through `POST /api/webhooks/ghl` remains supported.

---

## Required Server Interfaces

### `POST /api/employers/contracts/sign`

Purpose:
- Sign both employer agreements in one portal session

Expected behavior:
- require authenticated employer session
- require signer name
- require signature image
- require consent checkbox
- generate two signed PDFs
- store both files privately
- email both files as attachments

### `GET /api/contracts/:id/download`

Purpose:
- Serve a private signed download URL for employer/admin viewers

Expected behavior:
- employer can only download its own contracts
- admin can download any employer contract
- return a signed URL, never a public bucket URL

### `POST /api/admin/employers/:id/send-contract`

Purpose:
- Legacy GHL document send fallback

Expected behavior:
- require admin auth
- require synced GHL contact or sync it first
- refuse resend once the employer is already fully signed in the portal path

---

## Portal UX Rules

- Keep the 3-step employer onboarding experience.
- Step 2 is the agreement stage.
- Employer should be able to re-open signed documents from onboarding and the private employer dashboard/account surfaces.
- Admin should be able to see both agreement rows and download both signed copies.
- Do not show payment links, checkout CTAs, or subscription purchase UI.

---

## What Is Intentionally Not in M2

- Stripe collection
- GHL Payments
- subscription checkout
- payment success webhooks
- automatic subscription lifecycle management

Those remain deferred while offline billing is the operating model.
