# GHL Webhook Setup

This file covers the remaining HighLevel setup needed for Seraphyn M2.

## Goal

When a staffing agreement is signed in HighLevel Documents & Contracts, HighLevel should notify the portal so the employer can move forward in onboarding.

Portal endpoint:

```text
POST https://<YOUR_API_DOMAIN>/api/webhooks/ghl
```

Shared secret header:

```text
x-ghl-webhook-secret: your_ghl_webhook_secret
```

## Recommended HighLevel Setup

Use a Documents & Contracts workflow trigger in HighLevel, then add an outbound webhook action.

Reference:
- HighLevel documents trigger docs: https://help.gohighlevel.com/support/solutions/articles/155000001491-workflow-trigger-documents-contracts
- HighLevel outbound webhook action docs: https://help.gohighlevel.com/en/support/solutions/articles/155000003299-actions-webhook

## Steps In HighLevel

1. Open HighLevel for location `B508soKQSaXweoYGJGaF`.
2. Go to `Automation` -> `Workflows`.
3. Create a new workflow for document-sign events.
4. Choose the `Documents & Contracts` trigger.
5. Filter the trigger to the published template:
   - Template name: `Staffing Agreement`
   - Template ID: `69ed8d60324445de5d7aa17a`
6. Set the status condition to signed/completed.
7. Add a `Webhook` or `Custom Webhook` action.
8. Configure it as:
   - Method: `POST`
   - URL: `https://<YOUR_API_DOMAIN>/api/webhooks/ghl`
   - Header: `x-ghl-webhook-secret`
   - Header value: `your_ghl_webhook_secret`
   - Body format: JSON
9. Include the document/contact fields HighLevel exposes for the workflow step.
10. Publish the workflow.

## Expected Portal Behavior

The portal webhook already handles `DocumentSigned`-style payloads and will:

- verify the shared secret
- match the employer by GHL document reference or contact email
- mark the contract as signed
- set `employer_profiles.contract_signed = true`
- emit `employer.contract_signed` to n8n

## How To Test

1. Send a staffing agreement from the admin portal.
2. Sign it from the HighLevel recipient link.
3. Confirm the employer record updates in Supabase.
4. Confirm the employer becomes eligible for admin approval.

## Current Known Dependency

The backend still needs the production API domain in place of `https://<YOUR_API_DOMAIN>`.
