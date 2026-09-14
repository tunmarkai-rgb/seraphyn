# GHL.md — GoHighLevel CRM Setup
# Contract 2 — $200 — 14 Days (Concurrent with Contract 1)

---

## Overview

Build a fully automated marketing and CRM system for Seraphyn Care Solutions inside GoHighLevel (GHL). This runs concurrently with the portal build and has its own Upwork contract.

**GHL Account Access:** Kundayi has admin access to the sub-account.
**Brand Colors:** Sky Blue #7EB5C8 | Warm Gold #C8A96E | Warm White #F5F5F0 | Deep Navy #2C3E50

Current auth-email boundary:
- GHL does not currently send portal signup confirmation emails.
- GHL does not currently send portal password reset emails.
- Those account-auth emails are handled by Supabase Auth with Resend SMTP branding.

---

## What's Already Built in GHL (Before Scope Change)

The original scope had 5 stages per pipeline. Kundayi updated the scope.
All original pipelines and tags were deleted and rebuilt with the new spec below.

---

## CRM Pipelines

### Pipeline 1: Seraphyn – Nurse Talent Pipeline (13 stages)
1. New Applicant
2. Application Review
3. Qualified Candidate
4. Credentialing In Progress
5. Credentialed
6. Job Matched
7. Submitted to Facility
8. Interview Scheduled
9. Offer Extended
10. Placed
11. Active Worker
12. Redeploy
13. Inactive

### Pipeline 2: Seraphyn – Client Pipeline (14 stages)
1. New Inquiry
2. Engaged
3. Assessment Completed
4. Qualified Opportunity
5. Strategy Call Booked
6. Strategy Call Completed
7. Proposal Sent
8. Negotiation
9. Closed Won
10. Onboarding
11. Active Client
12. Expansion
13. Closed Lost
14. Nurture

---

## Custom Fields

### Nurse Custom Fields (8)
| Field | Type | Options |
|---|---|---|
| Specialty | Dropdown | ICU, ER, OR, Telemetry, Med-Surg, Pediatrics, OB, PACU, Hospice, Clinic |
| Years of Experience | Number | — |
| License Number | Text | — |
| License Expiration | Date | — |
| Certifications | Multi-select | BLS, ACLS, PALS, NRP, TNCC, CCRN, CEN, CNOR, NIHSS, STABLE |
| Preferred Location | Text | — |
| Availability | Dropdown | Immediate, 2 Weeks, 30 Days, Not Available |
| Shift Preference | Dropdown | Per Diem, Contract Travel, Permanent |

### Client Custom Fields (6)
| Field | Type | Options |
|---|---|---|
| Facility Name | Text | — |
| Bed Size | Number | — |
| Current Agency Spend ($) | Number | — |
| Turnover Rate (%) | Number | — |
| Pain Level | Single Select | 1–10 |
| Decision Maker Role | Text | — |

**Pain Level** = sales qualification score (1=low urgency, 10=high urgency). One score per organization, assigned by Seraphyn team.

---

## Tags (19)

### Nurse Tags (13)
`Travel Nurse`, `Ready to Place`, `Needs Credentialing`, `ICU`, `ER`, `OR`, `Telemetry`, `Med-Surg`, `Pediatrics`, `OB`, `PACU`, `Hospice`, `Clinic`

### Client Tags (6)
`Consulting Lead`, `Staffing Lead`, `Hybrid Lead`, `Book Buyer`, `High Value`, `Urgent`

---

## Lead Capture Forms

### 1. Nurse Lead Capture Form
(Embed ID: qxTojqt2g2mV99UGXqgy)

| # | Field | Type | Required |
|---|---|---|---|
| 1 | First Name | Text | Yes |
| 2 | Last Name | Text | Yes |
| 3 | Email Address | Email | Yes |
| 4 | Phone Number | Phone | Yes |
| 5 | Nursing License State | Dropdown (50 states) | Yes |
| 6 | Primary Specialty | Dropdown | Yes |
| 7 | Years of Experience | Dropdown | Yes |
| 8 | Shift Preference | Checkbox | Yes |
| 9 | Licensed in the US? | Radio (Yes/No) | Yes |

**Routing:** → Nurse Pipeline Stage 1 (New Applicant) + fires Nurse Sequence + notifies admin

Merge keys for the custom fields, read from the live form on 2026-09-13 (needed only if a
redirect ever has to carry answers in the URL, as Funnel 3's does):

| Field | Merge key |
|---|---|
| Nursing License State | `contact.nursing_license_state` |
| Primary Specialty | `contact.primary_specialty` |
| Years of Experience | `contact.whats_your_years_of_experience` |
| Shift Preference | `contact.whats_your_shift_preference` |
| Licensed in the US? | `contact.licensed_in_the_us` |

Note the shift field's form input is `data-q="shift_preferences"` (plural) while its merge
key is `...shift_preference` (singular) — do not assume the two match on any GHL form.

Current live implementation notes:
- Form submit redirects to `https://staffing.seraphyncare.com/nurse-signup`
- The companion GHL workflow should call `POST https://api.seraphyncare.com/api/leads/nurse-prefill`
- Header for that webhook action: `x-seraphyn-secret: seraphyn2026!`
- `ghlOpportunityId` is optional in the current workflow step if HighLevel does not expose an opportunity merge field there

### 2. Employer Lead Capture Form
(Embed ID: 4Mo2IsoMKsbP1XooIJld)

| # | Field | Type | Required |
|---|---|---|---|
| 1 | Organization Name | Text | Yes |
| 2 | Contact First Name | Text | Yes |
| 3 | Contact Last Name | Text | Yes |
| 4 | Work Email | Email | Yes |
| 5 | Phone Number | Phone | Yes |
| 6 | Organization Type | Dropdown | Yes |
| 7 | State | Dropdown (50 states) | Yes |
| 8 | What are you looking for? | Radio | Yes |
| 9 | Nurses needed per month | Dropdown | Yes |

**Routing:** Staffing enquiries → Employer Pipeline Stage 1 + employer sequence. Consulting enquiries → skip nurture, ping admin directly.

### 3. Consulting Assessment Form
(Embed ID: 7EP8moLgQXNVHQucSCEt)

| # | Field | Type | Required |
|---|---|---|---|
| 1 | First Name | Text | No |
| 2 | Last Name | Text | No |
| 3 | Work Email | Email | Yes |
| 4 | Your Facility Name | Text | Yes |
| 5 | Agency Usage | Dropdown | Yes |
| 6 | Nurses employed | Radio — `Under 50` / `50–150` / `150–400` / `400–1,000` / `Over 1,000` | Yes |
| 7 | Turnover Rate | Radio — `Under 10%` / `10–20%` / `20–30%` / `30–40%` / `Over 40%` | Yes |
| 8 | Staffing Challenges | Multi-line Text | No |
| 9 | SMS consent | Checkbox | No |

Field 6 (`Nurses employed`) is what makes the step 3 results figure real; before it existed
the results page showed a hardcoded `$847,000` to everyone. It belongs **directly above**
Turnover Rate, and both must stay Radio bands — step 3 maps band labels to midpoints and
does not parse free numbers from these two fields.

The earlier version of this list was wrong on two counts (it recorded a single "Full Name"
and a Turnover Rate *dropdown*); it was corrected from the live rendered form on
2026-09-10. Verify against the builder before trusting it again.

**Step 2 → Step 3 redirect** is configured here, not in page code:
Settings → On Submit → *Redirect to URL* →

```
https://consult.seraphyncare.com/results?n={{contact.approximately_how_many_nurses_do_you_employ}}&t={{contact.facility_turnover_rate}}
```

**GHL derives a custom field's key from its question text**, so the keys are long and not
guessable. The full set on this form, read from its own definition on 2026-09-12:

| Field | Merge key |
|---|---|
| Nurses employed | `contact.approximately_how_many_nurses_do_you_employ` |
| Turnover Rate | `contact.facility_turnover_rate` |
| Your Facility Name | `contact.your_facility_name_` (note the trailing underscore) |
| Agency Usage | `contact.your_agency_usage` |
| Staffing Challenges | `contact.staffing_challenges` |

A wrong key is **silent**: GHL forwards the literal `{{...}}` text and step 3 falls back to
the generic benchmark for every visitor. `{{nurses_employed}}` and `{{turnover_rate}}` were
configured first and both were wrong — `turnover_rate` is only a substring of the real
`facility_turnover_rate`. To read the keys for any form without guessing:

```sh
curl -s "https://api.leadconnectorhq.com/widget/form/<FORM_ID>" | grep -oE 'contact\.[a-z0-9_]+' | sort -u
```

Verify after any change by submitting the form and reading the address bar on `/results`:
real band values mean it works, literal braces mean the key is wrong.

---

## Funnels (3)

### Funnel 1: Nurse Recruitment Funnel

> **Page source is version-controlled** in [ghl-funnels/nurse/](ghl-funnels/nurse/) —
> `step-1-nurse-signup.html`, `step-2-nurse-apply.html`. Keep each file byte-identical to
> its GHL Custom Code element.

Both steps are linked with **plain `<a href>` anchors to absolute URLs** plus a shared
2-node step tracker whose completed node is an anchor. Do not reintroduce
`javascript:history.back()` — see the note under Funnel 3 for why.

- **Step 1 (Path: nurse-signup):** Landing page with hero image + CTA
  - Hero image: Black female nurse in modern hospital corridor
  - GHL media URL: https://assets.cdn.filesafe.space/B508soKQSaXweoYGJGaF/media/69db6878a4e6aa34cbf09c6c.jpg
    (784x1168 JPEG, 178 KB — already a sensible weight, unlike the consulting cover)
  - CTA → `https://consult.seraphyncare.com/nurse-apply-page`
- **Step 2 (Path: **`nurse-apply-page`**):** Application form page with the embedded Nurse
  Lead Capture Form (`qxTojqt2g2mV99UGXqgy`). Back → step 1.
  - **The live path is `nurse-apply-page`, not `nurse-apply`** as this doc previously said.
  - On submit the form redirects to the **portal** at
    `https://staffing.seraphyncare.com/nurse-signup`, and the companion workflow posts to
    `/api/leads/nurse-prefill`. No query parameters are needed — unlike Funnel 3, the
    prefill travels over the webhook, not the URL.

### Funnel 2: Staffing Funnel
- **Step 1 (Path: hospital-signup):** Staffing landing page with 2 CTAs
  - Demo Calendar URL: https://api.leadconnectorhq.com/widget/booking/JRNktDpCFjwEiAusNjGU
  - Step 2 URL: update after creating employer form page
- **Step 2:** Employer form page with embedded Employer Lead Capture Form

### Funnel 3: Consulting Funnel

> **Page source is version-controlled** in [ghl-funnels/consulting/](ghl-funnels/consulting/)
> — `step-1-book.html`, `step-2-assessment.html`, `step-3-results.html`. Keep each file
> byte-identical to its GHL Custom Code element; edit the file, then paste it across.

All three steps are linked with **plain `<a href>` anchors to absolute URLs** plus a shared
3-node step tracker whose completed nodes are anchors. Do not reintroduce
`javascript:history.back()`: it is inert on cold arrival (most funnel traffic has no history
entry), can eject the visitor to an external referrer, and `javascript:` hrefs are blocked
under a strict CSP.

- **Step 1 (Path: book):** "THE NURSE RETENTION BLUEPRINT" book page
  - Book mockup image: https://assets.cdn.filesafe.space/B508soKQSaXweoYGJGaF/media/6aa26f778d826740050dd3ac.jpg
    (800x1200 JPEG, 114 KB). The first upload of this cover was a 2.3 MB 1024x1536 PNG —
    the heaviest asset on the primary landing page, above the fold, for an image displayed
    at 380px wide. It was recompressed before launch. **GHL has no replace-in-place for
    media**, so every re-upload gets a new URL and the page code must be edited to match.
  - Primary CTA: **Amazon** → https://a.co/d/0giV2nFK (`target="_blank" rel="noopener"`)
  - Secondary CTA: the assessment page
  - **No payment CTA and no price shown.** Payments stay offline (ground rule 1) and the
    book sells on Amazon, so a price here would only go stale. The former `$47` "instant
    digital download" block was replaced with credibility content.
- **Step 2 (Path: assessment):** Assessment form page with embedded Consulting Assessment
  Form (`7EP8moLgQXNVHQucSCEt`). Back → step 1. Forward → step 3 via the **form's own
  redirect setting**, which must pass `?n=` and `?t=`; see the form section above.
- **Step 3 (Path: results):** Results page — the annual cost figure is **computed**, not
  hardcoded
  - `?n=<headcount band>&t=<turnover band>` are mapped to midpoints and multiplied by an
    `$88,000` per-turnover constant, rounded to the nearest `$1,000`
  - **Cold visits fall back to a generic benchmark** (`$88,000` per nurse who leaves) and
    drop every personalised claim. This path is common — bookmarks, shared links, browser
    back, ads pointed straight at `/results` — so it must never show a specific figure
    presented as the visitor's own. The page previously showed a hardcoded `$847,000` to
    everybody while claiming it came from their reported rate
  - Strategy Call Calendar URL: https://api.leadconnectorhq.com/widget/booking/uFMSW7I0eMVzSlSpxlJq
    — **must stay a GHL calendar.** ELS-04 triggers on a booking on this calendar; an
    external scheduler (Calendly was proposed on 2026-09-10 and rejected) means no
    `strategy-call-booked` tag, no Stage 5 move, no confirmation email, no internal alert —
    and because that tag is a kill condition for ELS-01/ELS-02, a lead who had just booked
    would keep receiving emails asking them to book. Revisiting an external scheduler
    requires a webhook → n8n → GHL-API bridge, not a link swap
  - Book Page URL: https://consult.seraphyncare.com/book

---

## Calendars

### Discovery Call
- **URL:** https://api.leadconnectorhq.com/widget/booking/JRNktDpCFjwEiAusNjGU
- Duration: 30 min | Buffer: 10 min after
- Reminders: 24hr + 1hr before (Email + SMS)

### Strategy Call
- **URL:** https://api.leadconnectorhq.com/widget/booking/uFMSW7I0eMVzSlSpxlJq
- Duration: 30 min | Buffer: 10 min after
- Reminders: 24hr + 1hr before (Email + SMS)

---

## Automation Workflows (Still to Build — 11 Total)

> Full architecture is in [docs/GHL_AUTOMATIONS.md](GHL_AUTOMATIONS.md).
> Payments are **offline** — Kundayi handles all billing directly. No Stripe or GHL payment links in any workflow.

| # | Workflow | Side | Trigger |
|---|---|---|---|
| NRS-01 | Entry & Nurture Sequence | Nurse | Tag: nurse-lead |
| NRS-02 | Link Click Handler | Nurse | Trigger link clicked |
| NRS-03 | Portal Signup Confirmed | Nurse | Webhook: nurse.signup_confirmed |
| NRS-04 | Credentialing Triggered | Nurse | Webhook: nurse.document_uploaded |
| NRS-05 | Interview / Placement Milestones | Nurse | Webhook: application.interview_scheduled or application.hired |
| ELS-01 | Entry & Nurture Sequence | Employer | Tag: staffing-lead |
| ELS-02 | Link Click Handler | Employer | Trigger link clicked |
| ELS-03 | Demo Booked Handler | Employer | Appointment: Discovery Call booked |
| ELS-04 | Strategy Call Booked Handler | Employer | Appointment: Strategy Call booked |
| ELS-05 | Portal Signup / Approval Confirmed | Employer | Webhook: employer.signup_confirmed or employer.approved |
| ELS-06 | Consulting Lead Handler | Employer | Tag: consulting-lead |

---

## Portal → GHL Webhook Integration

When nurses or employers sign up on the portal, a webhook fires to GHL to create/update the contact and place them in the correct pipeline.

### Nurse Portal Signup Webhook Payload
```json
{
  "email": "nurse@example.com",
  "firstName": "Sarah",
  "lastName": "Chen",
  "phone": "+1234567890",
  "tags": ["nurse-lead"],
  "customField": {
    "specialty": "ICU / Critical Care",
    "licenseState": "CA",
    "shiftPreference": "Contract Travel"
  },
  "pipeline": "Nurse Talent Pipeline",
  "pipelineStage": "New Applicant"
}
```

### Employer Portal Signup Webhook Payload
```json
{
  "email": "employer@hospital.com",
  "firstName": "David",
  "lastName": "Harris",
  "companyName": "St. Mary's Medical Center",
  "phone": "+1234567890",
  "tags": ["staffing-lead"],
  "customField": {
    "facilityName": "St. Mary's Medical Center",
    "orgType": "Hospital",
    "state": "IL"
  },
  "pipeline": "Client Pipeline",
  "pipelineStage": "New Inquiry"
}
```

**Webhook handler:** `server/routes/webhooks.js` → `/api/webhooks/ghl`
**GHL endpoint:** GHL API v2 contacts endpoint (requires GHL API key in server .env)

---

## Milestones

### Milestone 1 — Day 7 — $150
Pipelines ✅, Custom Fields ✅, Tags ✅, Lead Capture Forms ✅, Funnels (3) — pages with embedded forms, calendars configured

### Milestone 2 — Day 14 — $150
Automation sequences live, calendar booking live, GHL Documents contract flow live, portal-to-GHL webhook connected + tested

---

## Remaining Funnel Placeholders

| Page | Placeholder | Replace With |
|---|---|---|
| Staffing Landing (Step 1) | `YOUR_DEMO_CALENDAR_URL_HERE` | https://api.leadconnectorhq.com/widget/booking/JRNktDpCFjwEiAusNjGU |
| Staffing Landing (Step 1) | `YOUR_STAFFING_FORM_STEP2_URL_HERE` | Staffing form page URL (pull from GHL funnel) |

All three **consulting** placeholders were resolved on 2026-09-10 and the pages committed to
[ghl-funnels/consulting/](ghl-funnels/consulting/). They had been live in production the
whole time, so the step 1 → step 2 link and both step 3 CTAs were dead. When updating the
remaining funnels, check for live `YOUR_*_HERE` strings in the page source first rather than
assuming the table is current — it under-reported by one (`YOUR_PAYMENT_LINK_HERE` on the
consulting book page was never listed here).

---

## What Kundayi Needs to Provide
- [ ] Admin notification email address for internal workflow alerts
- [ ] Zoom/Google Meet link for calendar confirmation emails
- [ ] Final staffing agreement uploaded to GHL Documents
- [ ] GHL staffing agreement Template ID
