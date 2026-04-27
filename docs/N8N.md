# N8N.md - M2 Automation Bundle
# Phase 2

> n8n is now part of M2, not M3.

---

## Summary

n8n owns Seraphyn's async automation layer in M2.

Recommended ownership split:

- Portal server: auth, admin actions, GHL contract webhooks, access control
- Supabase webhooks: trigger most data-change automations
- n8n: OpenAI processing, contact sync, matching, screening, and downstream orchestration

Current implementation note:
- The portal now includes a direct server-side GHL contact sync fallback for nurse/employer records.
- This keeps employer contract sending unblocked if the n8n contact-sync workflow is not live yet.
- n8n should still remain the preferred long-term owner for contact-sync orchestration and retry logic.

Current production workflow state:
- `Seraphyn - Portal Events Inbound` is active in production with workflow ID `xh5ruX7lGR9m8vIE`
- `Seraphyn - Resume Parser` is exported to production with workflow ID `xFl2h0aUGWqK7Zsb`
- the resume parser remains inactive until a real OpenAI key is loaded into the native n8n credential

---

## Required Workflows

### 1. Resume Parser

Trigger:
- Supabase Storage webhook on `resumes/` uploads

Actions:
- Fetch resume file
- Extract text
- Send to OpenAI
- Write parsed JSON to `nurse_profiles.ai_parsed_data`
- Backfill empty nurse profile fields where safe

Primary output:
- `nurse_profiles.ai_parsed_data`

### 2. Job Matching

Trigger:
- Supabase DB webhook on approved or updated nurse profile

Actions:
- Load nurse profile
- Load active jobs
- Rank top matches with OpenAI
- Store top matches in `nurse_profiles.ai_job_matches`

Primary output:
- `nurse_profiles.ai_job_matches`

### 3. Admin Credential Screening

Trigger:
- Supabase DB webhook on `applications` insert

Actions:
- Compare nurse credentials with job requirements
- Write pass/fail reasoning to `applications.admin_notes`
- Flag obvious mismatches for review

Primary output:
- `applications.admin_notes`

### 4. Approval Notifications

Trigger:
- Supabase DB webhook when `public.users.status` changes to `approved`

Actions:
- Branch by role
- Trigger the right downstream notification path
- Hand off delivery to GHL with approved copy and business sequencing

### 5. GHL Contact Sync

Trigger:
- Supabase DB webhook on new nurse/employer creation

Actions:
- Build GHL contact payload
- Create or update contact in GHL
- Save returned `ghl_contact_id`
- Stamp `ghl_synced_at`

Primary outputs:
- `nurse_profiles.ghl_contact_id`
- `nurse_profiles.ghl_synced_at`
- `employer_profiles.ghl_contact_id`
- `employer_profiles.ghl_synced_at`

Fallback behavior currently available:
- `POST /api/integrations/ghl/sync-self`
- `POST /api/admin/employers/:id/sync-contact`
- `POST /api/admin/nurses/:id/sync-contact`
- Admin contract send will attempt an automatic employer sync before failing on a missing `ghl_contact_id`

---

## Optional Portal-to-n8n Event Hook

The portal can also forward high-signal events directly to n8n using:

```env
N8N_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=
```

Current server-side event candidates:

- `nurse.signup_confirmed`
- `nurse.document_uploaded`
- `nurse.approved`
- `employer.signup_confirmed`
- `employer.approved`
- `employer.contract_sent`
- `employer.contract_signed`
- `application.interview_scheduled`
- `application.hired`

This is optional support for orchestration. The primary automation source remains Supabase webhooks.

---

## Suggested Credentials in n8n

- Supabase service-role credential
- OpenAI credential
- GHL credential / token
- Email delivery path used by the business

Current native credentials already created in production:
- `Seraphyn Shared Webhook Secret` (`httpHeaderAuth`)
- `Seraphyn Supabase API` (`supabaseApi`)
- `Seraphyn OpenAI API` (`openAiApi`)

Approved delivery split:
- GHL owns contact-facing notification delivery in M2
- n8n stays focused on orchestration, AI work, and data writes

---

## Environment Variables

Document these in the deployment target used by n8n and/or the portal:

```env
OPENAI_API_KEY=sk-...
GHL_API_KEY=pit-...
GHL_LOCATION_ID=...
GHL_WORKFLOW_WEBHOOK_URL=https://hooks.leadconnectorhq.com/your-shared-ghl-webhook
GHL_WORKFLOW_WEBHOOK_SECRET=shared_secret
N8N_WEBHOOK_URL=https://your-n8n-instance/webhook/seraphyn-events
N8N_WEBHOOK_SECRET=shared_secret
```

Portal note:
- `server/lib/portal-events.js` now dispatches milestone events to n8n and can also send the same events to GHL workflow webhook URLs from the portal backend.

---

## Acceptance Checks

- Resume upload populates `ai_parsed_data`
- Approved nurse gets `ai_job_matches`
- New application gets screening notes
- Approved users receive the right notification path
- New users receive `ghl_contact_id` and `ghl_synced_at`

---

## Out of Scope

- Replacing portal business logic with n8n
- Using n8n as the canonical access-control layer
- Live payment automation
