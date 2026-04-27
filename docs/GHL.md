# GHL.md — GoHighLevel CRM Setup
# Contract 2 — $200 — 14 Days (Concurrent with Contract 1)

---

## Overview

Build a fully automated marketing and CRM system for Seraphyn Care Solutions inside GoHighLevel (GHL). This runs concurrently with the portal build and has its own Upwork contract.

**GHL Account Access:** Kundayi has admin access to the sub-account.
**Brand Colors:** Sky Blue #7EB5C8 | Warm Gold #C8A96E | Warm White #F5F5F0 | Deep Navy #2C3E50

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

Fields: Full Name, Work Email, Facility Name, Turnover Rate (Dropdown), Agency Usage (Dropdown), Staffing Challenges (Multi-line Text)

---

## Funnels (3)

### Funnel 1: Nurse Recruitment Funnel
- **Step 1 (Path: nurse-signup):** Landing page with hero image + CTA
  - Hero image: Black female nurse in modern hospital corridor
  - GHL media URL: https://assets.cdn.filesafe.space/B508soKQSaXweoYGJGaF/media/69db6878a4e6aa34cbf09c6c.jpg
  - CTA button links to Step 2 URL (update in code)
- **Step 2 (Path: nurse-apply):** Application form page with embedded Nurse Lead Capture Form

### Funnel 2: Staffing Funnel
- **Step 1 (Path: hospital-signup):** Staffing landing page with 2 CTAs
  - Demo Calendar URL: https://api.leadconnectorhq.com/widget/booking/JRNktDpCFjwEiAusNjGU
  - Step 2 URL: update after creating employer form page
- **Step 2:** Employer form page with embedded Employer Lead Capture Form

### Funnel 3: Consulting Funnel
- **Step 1 (Path: book):** "The Million Dollar Nurse" book page
  - Book mockup image: https://assets.cdn.filesafe.space/B508soKQSaXweoYGJGaF/media/69dbd3db982fd67a35987b0e.jpg
  - Primary CTA: route to the assessment page
  - Secondary CTA: strategy call only if Kundayi explicitly wants it
  - Default: no payment CTA while billing stays offline
  - Placeholder: YOUR_ASSESSMENT_URL_HERE (Step 2 URL)
- **Step 2 (Path: assessment):** Assessment form page with embedded Consulting Assessment Form
- **Step 3 (Path: results):** Results page ("Your organization is losing $847,000")
  - Strategy Call Calendar URL: https://api.leadconnectorhq.com/widget/booking/uFMSW7I0eMVzSlSpxlJq
  - Book Page URL: YOUR_BOOK_PAGE_URL_HERE

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
| Consulting Book (Step 1) | `YOUR_ASSESSMENT_URL_HERE` | Assessment page URL (pull from GHL funnel) |
| Consulting Results (Step 3) | `YOUR_STRATEGY_CALL_CALENDAR_URL_HERE` | https://api.leadconnectorhq.com/widget/booking/uFMSW7I0eMVzSlSpxlJq |
| Consulting Results (Step 3) | `YOUR_BOOK_PAGE_URL_HERE` | Book page URL (pull from GHL funnel) |

---

## What Kundayi Needs to Provide
- [ ] Admin notification email address for internal workflow alerts
- [ ] Zoom/Google Meet link for calendar confirmation emails
- [ ] Final staffing agreement uploaded to GHL Documents
- [ ] GHL staffing agreement Template ID
