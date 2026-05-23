# Production Launch Guide

This is the shortest path to finish the nurse funnel rollout from the current live state.

Current baseline after cleanup:

- Only three core accounts are intentionally retained in production data:
  - `kundayiw@gmail.com` (admin)
  - `nurse.test@seraphyn.com` (test nurse)
  - `employer.test@seraphyn.com` (test employer)
- The top-level repo `tests/` directory and `tmp/` scratch artifacts were removed.
- The retained test employer still owns the sample jobs/application data used for portal verification.

## Already done

- Portal frontend is deployed on `https://staffing.seraphyncare.com`
- Production API is live on `https://api.seraphyncare.com`
- `public.notifications` exists in Supabase
- In-app notifications API is live
- Message email delivery is configured through Resend
- Nurse lead token prefill is live
- Nurse profile uploads are live for:
  - resume
  - nursing license
  - certification proof documents
- Nurse signup redirect to the generic portal signup page is live from the GHL form
- Nurse lead token now supports:
  - `ghlContactId`
  - `ghlOpportunityId`
- Direct GHL opportunity stage sync is live for:
  - `nurse.signup_confirmed`
  - `nurse.profile_completed`
  - `nurse.document_uploaded`
  - `nurse.job_matched`
  - `application.interview_scheduled`
  - `application.hired`

## What you need to do

### 1. Fix the GHL form submit handoff

Your GHL Nurse Lead Capture Form flow must send the nurse into:

- `POST https://api.seraphyncare.com/api/leads/nurse-prefill`

Use header:

- `x-seraphyn-secret: seraphyn2026!`

Send this JSON body:

```json
{
  "firstName": "{{contact.first_name}}",
  "lastName": "{{contact.last_name}}",
  "email": "{{contact.email}}",
  "phone": "{{contact.phone}}",
  "licenseState": "{{contact.state}}",
  "specialty": "{{contact.specialty}}",
  "yearsExperience": "{{contact.years_experience}}",
  "shiftPreference": "{{contact.shift_preference}}",
  "ghlContactId": "{{contact.id}}",
  "ghlOpportunityId": "{{opportunity.id}}",
  "source": "ghl-form"
}
```

Important:

- `ghlOpportunityId` is now preferred for the cleanest nurse funnel stage progression.
- Without `ghlOpportunityId`, the portal can still prefill signup, but GHL opportunity updates are less reliable.
- The current GHL workflow node may omit `ghlOpportunityId` if HighLevel does not expose an opportunity merge field there.
- The nurse profile flow now normalizes older lead/signup values to the live stored values required by production:
  - `shift_preference -> any`
  - `availability -> available`

Current live redirect path:

- The GHL form itself currently redirects to `https://staffing.seraphyncare.com/nurse-signup`
- The webhook call is still used to preserve lead data and GHL linkage on the backend

### 2. Make sure GHL still creates the contact and opportunity first

In the GHL workflow or form automation, confirm this order:

1. Create or update contact
2. Create or update opportunity in `Seraphyn – Nurse Talent Pipeline`
3. Move stage to `New Applicant`
4. Apply tag `nurse-lead`
5. Call the lead bridge endpoint above
6. Redirect to the portal signup page

### 3. Build the missing GHL nurture and webhook workflows

These still need to exist in GHL:

- `NRS-01` lead nurture with Day 14 reminder
- `NRS-03` inbound webhook for `nurse.signup_confirmed`
- `NRS-04` inbound webhook for `nurse.document_uploaded`

Recommended minimum behavior:

- Form submit -> move to `New Applicant`
- `nurse.signup_confirmed` -> add `nurse-portal-registered`, remove `nurse-lead`, move to `Application Review`
- `nurse.document_uploaded` -> move to `Credentialing In Progress`
- Day 14 without signup -> send final reminder email/SMS

Note:

- The portal now already moves opportunities directly in GHL, so these workflows are mostly for GHL-owned messages, tags, and nurture control.

### 4. Test one real nurse lead

Run one real test from the funnel:

1. Open `consult.seraphyncare.com/nurse-signup`
2. Click CTA
3. Submit GHL Nurse Lead Capture Form
4. Confirm redirect to the portal signup page
5. Complete signup
6. Upload resume and license
7. Confirm stage movement in GHL:
   - `New Applicant`
   - `Application Review`
   - `Credentialing In Progress`

### 5. Verify notifications in a real logged-in session

You should log into the portal with a nurse, employer, and admin test account and confirm:

1. Bell icon shows unread count
2. New message creates notification row
3. New message sends email
4. Mark-as-read works
5. Mark-all-read works

## What is still blocked

- GHL UI browser access is unreliable, so workflow setup inside GHL still needs your manual clicks unless the session starts rendering correctly.
- `GHL_WORKFLOW_WEBHOOK_URL` is still not configured in production.
- The 14-day reminder is not live until `NRS-01` is built in GHL.
- Resume parser should still be verified in n8n with a real uploaded resume.

## Simple launch order

Do these in this exact order:

1. Update the GHL form workflow to send `x-seraphyn-secret: seraphyn2026!` to `/api/leads/nurse-prefill`
2. Confirm redirect to `https://staffing.seraphyncare.com/nurse-signup`
3. Publish `NRS-01`, `NRS-03`, and `NRS-04` in GHL
4. Run one full nurse test
5. Run one portal messaging test with logged-in users
