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

Portal handoff (see [GHL form → portal handoff](#ghl-form--portal-handoff) for setup):
- Form submit redirects to `https://staffing.seraphyncare.com/signup?role=nurse`
- The companion GHL workflow posts the submission to `POST https://api.seraphyncare.com/api/leads/ghl`
  with `role=nurse`. The old `/api/leads/nurse-prefill` bridge is retired (returns 410).

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

Merge keys, read from the live form on 2026-09-14:

| Field | Merge key |
|---|---|
| Organization Name | `contact.organization_name` |
| Organization Type | `contact.organization_type` |
| State | `contact.organization_state` |
| What are you looking for? | `contact.what_are_you_looking_for` |
| Nurses needed per month | `contact.nurses_needed_per_month` |

The "What are you looking for?" radio renders with `data-q="radio_6r7a"` — an
auto-generated input key bearing no relation to its merge key. Never infer one from the
other; read both off the form.

**Routing:** Staffing enquiries → Employer Pipeline Stage 1 + employer sequence. Consulting enquiries → skip nurture, ping admin directly.

Portal handoff: the form redirects to `https://staffing.seraphyncare.com/signup?role=employer`
and its workflow posts to `POST /api/leads/ghl` with `role=employer`. "Consulting Services"
answers are stored as a lead but get no portal invite email. The live State field is free
text, not the 50-state dropdown listed above; the portal converts "New York" to `NY`.

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
    `https://staffing.seraphyncare.com/signup?role=nurse`, and the companion workflow posts to
    `/api/leads/ghl`. No answers go in the URL — unlike Funnel 3, the prefill travels over
    the webhook and is applied after the nurse confirms their email.

### Funnel 2: Staffing Funnel

> **Page source is version-controlled** in [ghl-funnels/staffing/](ghl-funnels/staffing/) —
> `step-1-hospital-signup.html`, `step-2-hospital-apply.html`. Keep each file
> byte-identical to its GHL Custom Code element.

Both steps are linked with **plain `<a href>` anchors to absolute URLs** plus a shared
2-node step tracker whose completed node is an anchor. Do not reintroduce
`javascript:history.back()` — see the note under Funnel 3.

- **Step 1 (Path: hospital-signup):** Staffing landing page with 2 CTAs
  - Demo CTA → https://api.leadconnectorhq.com/widget/booking/JRNktDpCFjwEiAusNjGU
    — **must stay a GHL calendar.** ELS-03 triggers on a booking on this Discovery Call
    calendar and applies the `demo-booked` tag, which also kills the ELS-01/ELS-02 nurture
    sequences at five IF/ELSE gates. A `calendly.com/seraphyncare-info/30min` link was live
    here until 2026-09-14; it meant no tag, no Stage 5 move, no team alert, and leads who
    had already booked kept receiving "book a demo" emails. Same defect as Funnel 3's
    strategy call — see the note there before swapping either calendar again.
  - Request Staffing CTA → `https://consult.seraphyncare.com/hospital-apply-page`
    — **was pointing at `/hospital-apply`, which does not exist.** The button was dead in
    production. Note the `-page` suffix; the nurse funnel had the identical trap.
  - Hero image: https://assets.cdn.filesafe.space/B508soKQSaXweoYGJGaF/media/69db80f6982fd67a358aa026.jpg
    (784x1168 JPEG, 190 KB)
- **Step 2 (Path: **`hospital-apply-page`**):** Employer form page with the embedded
  Employer Lead Capture Form (`4Mo2IsoMKsbP1XooIJld`). Back → step 1.

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

## Two-way contact sync (portal ↔ GHL)

One person, one GHL contact, one portal record — whichever door they come in through.

### Portal → GHL

`server/lib/ghl-sync.js` writes the contact through the GHL API (not a workflow webhook):

- **When:** at signup (before email confirmation), after email confirmation, when a nurse
  saves their profile, when an employer saves onboarding Step 1, and on admin approval.
- **Which contact:** if the profile already holds a `ghl_contact_id` (from an earlier sync
  or from the GHL form that created the lead), that exact contact is updated with
  `PUT /contacts/:id`; otherwise `/contacts/upsert` matches by email.
- **Fields:** the same custom-field keys the funnel forms write, so a contact never ends up
  with two sets of answers:

| Portal column | GHL custom field | Value mapping |
|---|---|---|
| nurse `specialty` | `primary_specialty` | `ICU / Critical Care` → `ICU`, `Medical-Surgical` → `Med-Surg`, … |
| nurse `license_state` | `nursing_license_state` | 2-letter code |
| nurse `years_experience` | `whats_your_years_of_experience` | number → `1-2` / `3-5` / `6-10` / `11-15` / `15+` |
| nurse `shift_preference` | `whats_your_shift_preference` | `per_diem` → `Per Diem`; `any` is not sent |
| nurse `license_number`, `availability`, `certifications` | same names | |
| employer `org_name` | `organization_name` | |
| employer `org_type` | `organization_type` | `Long-Term Care Facility` → `Long-Term Care`, … |
| employer `state` | `organization_state` | |
| employer `contact_title`, `bed_count` | `decision_maker_role`, `bed_size` | |
| employer `onboarding_stage` | `portal_onboarding_stage` | created 2026-09-24 |

- **Tags** are added through `POST /contacts/:id/tags`, which is additive, so tags applied
  by GHL workflows are never wiped. Portal contacts get `nurse-portal-registered` /
  `employer-portal-registered` (which end the NRS-01/02 and ELS-01/02 nurture), plus
  `portal-nurse` / `portal-employer` and `portal-account`. The portal deliberately never
  adds `nurse-lead` or `staffing-lead`: those tags *start* the nurture sequences.
- Check the keys against the live location with `node server/scripts/ghl-custom-fields.js`.
  GHL silently drops a write to a key it does not know.

### GHL form → portal handoff

1. A nurse or employer submits the funnel form.
2. The form redirects them to `https://staffing.seraphyncare.com/signup?role=nurse` (or
   `role=employer`). That page asks only for name, email and password.
3. In parallel, the form's GHL workflow posts the submission to `POST /api/leads/ghl`. The
   portal stores it in `leads`, emails a "Finish creating your account" link (Resend), and
   writes the same link to the contact's `portal_signup_url` field so GHL SMS/email steps
   can use `{{contact.portal_signup_url}}`.
4. When the person signs up with the same email and **confirms it**, the portal copies the
   lead's answers into their profile (only into empty fields) and links the GHL contact.
   The nurse profile / employer onboarding page opens prefilled.

If they already had a confirmed portal account, step 3 fills any gaps in that profile
instead of sending an invite.

**GHL setup, per form** (nurse form `qxTojqt2g2mV99UGXqgy`, employer form `4Mo2IsoMKsbP1XooIJld`):

1. **Form → Options → On submit:** redirect to URL
   `https://staffing.seraphyncare.com/signup?role=nurse` (employer form: `role=employer`).
2. **Workflow** triggered by *Form Submitted* for that form → add a **Webhook** action:
   - Method `POST`, URL `https://api.seraphyncare.com/api/leads/ghl`
   - Header `x-seraphyn-secret` = the value of `LEAD_BRIDGE_SECRET` on the API server
     (kept in the server `.env`, never in this repo)
   - Custom data: `role` = `nurse` (or `employer`). The standard webhook body already
     carries the contact id, name, email, phone and the form's custom fields; the portal
     reads them under their field names or keys, so no other mapping is needed.
3. Optional: in NRS-02 / ELS-02 replace hard-coded portal links with
   `{{contact.portal_signup_url}}`.

A consulting-only employer ("What are you looking for?" = Consulting Services) is stored
but not invited to the portal.

---

## Milestones

### Milestone 1 — Day 7 — $150
Pipelines ✅, Custom Fields ✅, Tags ✅, Lead Capture Forms ✅, Funnels (3) — pages with embedded forms, calendars configured

### Milestone 2 — Day 14 — $150
Automation sequences live, calendar booking live, GHL Documents contract flow live, portal-to-GHL webhook connected + tested

---

## Funnel Placeholders — all resolved

**None remain.** All three funnels were reworked between 2026-09-10 and 2026-09-14 and their
page source now lives in [ghl-funnels/](ghl-funnels/). Grep that directory for `_HERE` to
confirm before trusting this heading.

This table used to list what was outstanding, and it was wrong in both directions:

- It **under-reported.** `YOUR_PAYMENT_LINK_HERE` was live on the consulting book page and
  was never listed here at all.
- It **over-reported.** Both staffing entries had in fact been filled in — but wrongly: the
  demo CTA had been pointed at Calendly (breaking ELS-03) and the step 2 CTA at
  `/hospital-apply`, a path that does not exist.

The lesson for any future funnel work: **read the live page source, never this table.** A
placeholder that has been replaced with the wrong value is worse than one left in place,
because nothing flags it — the consulting funnel's dead CTAs and the staffing funnel's dead
"Request Staffing" button had all been sitting in production unnoticed.

---

## What Kundayi Needs to Provide
- [ ] Admin notification email address for internal workflow alerts
- [ ] Zoom/Google Meet link for calendar confirmation emails
- [ ] Final staffing agreement uploaded to GHL Documents
- [ ] GHL staffing agreement Template ID
