# GHL_AUTOMATIONS.md — Seraphyn Care Solutions
# Full Automation Architecture — 11 Workflows (5 Nurse + 6 Employer)
# Payments are OFFLINE — no Stripe or GHL payment links used in the portal

> This document is the single source of truth for GHL workflow design.
> Build nothing until Kundayi approves the visual flow.
> Reference docs/GHL.md for pipelines, fields, tags, forms, and funnels.

---

## Payments — Offline Model (Updated)

All payments are handled **offline by Kundayi directly**. Do not wire up Stripe or GHL payment links in the portal or in any automation workflow. For the Consulting Funnel Step 1, the default is to remove the payment CTA and route to assessment / strategy-call actions only.

---

## Pipeline Ownership — Who Moves What

### Nurse Talent Pipeline

| Stage | # | Who Moves It | Trigger |
|---|---|---|---|
| New Applicant | 1 | Automation | Lead capture form submitted |
| Application Review | 2 | Automation | Portal webhook — nurse completes signup |
| Qualified Candidate | 3 | Seraphyn Team | Manual — reviews profile, approves quality |
| Credentialing In Progress | 4 | Automation | Nurse uploads license/resume on portal |
| Credentialed | 5 | Seraphyn Team | Manual — team verifies documents |
| Job Matched | 6 | Automation | n8n AI job match fires OR team assigns manually |
| Submitted to Facility | 7 | Seraphyn Team | Manual — team submits nurse to employer |
| Interview Scheduled | 8 | Automation | Application status → interview on portal |
| Offer Extended | 9 | Seraphyn Team | Manual — team confirms offer |
| Placed | 10 | Automation | Application status → hired on portal |
| Active Worker | 11 | Seraphyn Team | Manual — team confirms first shift |
| Redeploy | 12 | Seraphyn Team | Manual — team flags for redeployment |
| Inactive | 13 | Automation | 90-day inactivity OR nurse account suspended |

### Client Pipeline

| Stage | # | Who Moves It | Trigger |
|---|---|---|---|
| New Inquiry | 1 | Automation | Lead capture form submitted |
| Engaged | 2 | Automation | Portal webhook — employer completes signup |
| Assessment Completed | 3 | Automation | Consulting assessment form submitted |
| Qualified Opportunity | 4 | Seraphyn Team | Manual — confirms fit, kills ELS-01 nurture |
| Strategy Call Booked | 5 | Automation | Strategy call calendar booked |
| Strategy Call Completed | 6 | Seraphyn Team | Manual — marks after call |
| Proposal Sent | 7 | Seraphyn Team | Manual |
| Negotiation | 8 | Seraphyn Team | Manual |
| Closed Won | 9 | Seraphyn Team | Manual |
| Onboarding | 10 | Automation | Portal webhook — employer reaches Stage 3 (approved) |
| Active Client | 11 | Seraphyn Team | Manual — confirms first placement |
| Expansion | 12 | Seraphyn Team | Manual |
| Closed Lost | 13 | Seraphyn Team | Manual |
| Nurture | 14 | Automation | No conversion after ELS-01 Day 15 |

---

## Webhook Events — Portal → GHL

These are the portal events that must fire a webhook to GHL workflows.

Implementation note:
- The portal now dispatches milestone events through `server/lib/portal-events.js`.
- Events can fan out to n8n and to GHL workflow inbound webhook URLs at the same time.
- Approved M2 direction: GHL owns contact-facing notifications; n8n remains the orchestrator and AI layer.
- Fastest-launch recommendation is one shared `GHL_WORKFLOW_WEBHOOK_URL`, with per-event overrides like `GHL_WORKFLOW_WEBHOOK_URL_NURSE_SIGNUP_CONFIRMED` available later.

| Portal Event | Webhook Name | GHL Workflow Triggered |
|---|---|---|
| Nurse completes signup | `nurse.signup_confirmed` | NRS-03 |
| Nurse uploads document | `nurse.document_uploaded` | NRS-04 |
| Application status → interview | `application.interview_scheduled` | NRS-05 (partial) |
| Application status → hired | `application.hired` | NRS-05 |
| User inactive 90d or suspended | `nurse-inactive` | Inactivity workflow (NRS-01 exit) |
| Employer completes signup | `employer.signup_confirmed` | ELS-05 (partial — Stage 2) |
| Employer contract sent | `employer.contract_sent` | optional internal notification branch |
| Employer contract signed | `employer.contract_signed` | optional internal notification branch |
| Employer reaches onboarding Stage 3 | `employer.approved` | ELS-05 (full — Stage 10) |

---

## Nurse Workflows (5 Total)

---

### NRS-01 — Entry & Nurture Sequence

**Trigger:** Tag added → `nurse-lead`

**Goal (any condition below kills this workflow):**
- Tag `nurse-portal-registered` present, OR
- Pipeline stage ≥ 3 (Seraphyn team has qualified the nurse — stop automated messages)

**Nodes:**

```
[1]  TRIGGER: Tag Added = nurse-lead

[2]  ACTION: Move Pipeline → Stage 1 (New Applicant)

[3]  WAIT: 0 mins (immediate)

[4]  ACTION: Send Email — NRS - D01 - Email - Welcome + Portal CTA
             Subject: "Your next shift starts here — complete your Seraphyn profile"
             CTA = trigger link → fires NRS-02 on click

[5]  WAIT: 1 day

[6]  IF/ELSE: nurse-portal-registered OR pipeline stage ≥ 3?
             → YES: END
             → NO: Continue

[7]  ACTION: Send SMS — NRS - D02 - SMS - Profile Reminder
             CTA = trigger link → fires NRS-02 on click

[8]  WAIT: 2 days

[9]  IF/ELSE: nurse-portal-registered OR pipeline stage ≥ 3?
             → YES: END
             → NO: Continue

[10] ACTION: Send Email — NRS - D04 - Email - Platform Benefits
             CTA = trigger link → fires NRS-02 on click

[11] WAIT: 3 days

[12] IF/ELSE: nurse-portal-registered OR pipeline stage ≥ 3?
             → YES: END
             → NO: Continue

[13] ACTION: Send SMS — NRS - D07 - SMS - Follow-up (profile still incomplete?)
             CTA = trigger link → fires NRS-02 on click

[14] WAIT: 3 days

[15] IF/ELSE: nurse-portal-registered OR pipeline stage ≥ 3?
             → YES: END
             → NO: Continue

[16] ACTION: Send Email — NRS - D10 - Email - Featured Opportunities in Specialty

[17] WAIT: 4 days

[18] IF/ELSE: nurse-portal-registered OR pipeline stage ≥ 3?
             → YES: END
             → NO: Continue

[19] ACTION: Send Email — NRS - D14 - Email - Final Nudge + Direct Contact

[20] END
```

---

### NRS-02 — Link Click Handler

**Trigger:** Trigger link clicked (any NRS email or SMS link)
**Conditions:** `nurse-portal-registered` NOT present + `nurse-link-clicked` NOT present
**Goal:** Tag `nurse-portal-registered`

**Nodes:**

```
[1]  TRIGGER: Trigger Link Clicked (NRS links)
             Filter: nurse-portal-registered NOT present
             Filter: nurse-link-clicked NOT present

[2]  ACTION: Add Tag → nurse-link-clicked

[3]  WAIT: 1 hour

[4]  IF/ELSE: nurse-portal-registered?
             → YES: END
             → NO: Continue

[5]  ACTION: Send SMS —
             "Hi {{contact.first_name}}, you're one step away from 
             accessing nursing opportunities near you. 
             Create your free profile here: https://staffing.seraphyncare.com/nurse/signup
             Reply STOP to opt out."

[6]  WAIT: 23 hours

[7]  IF/ELSE: nurse-portal-registered?
             → YES: END
             → NO: Continue

[8]  ACTION: Send Email —
             Subject: "Still thinking about it, {{contact.first_name}}?"
             Body: "We noticed you checked out the Seraphyn platform.
             Your profile takes less than 5 minutes and puts you 
             in front of facilities looking for your specialty.
             [Create My Profile →](https://staffing.seraphyncare.com/nurse/signup)"

[9]  END
```

---

### NRS-03 — Portal Signup Confirmed (Webhook)

**Trigger:** Inbound Webhook → `nurse.signup_confirmed` (fired when nurse completes portal signup)

**Nodes:**

```
[1]  TRIGGER: Inbound Webhook (nurse signup)

[2]  ACTION: Add Tag → nurse-portal-registered
             Remove Tag → nurse-lead, nurse-link-clicked

[3]  ACTION: Move Pipeline → Stage 2 (Application Review)

[4]  ACTION: Send Email to Nurse —
             Subject: "You're on Seraphyn — here's what happens next"
             Body: "Hi {{contact.first_name}}, your profile is live. 
             Our team is reviewing it and will be in touch shortly. 
             In the meantime, make sure your license and resume 
             are ready to upload when prompted."

[5]  ACTION: Send Internal Notification to Seraphyn Team —
             "New nurse profile submitted — review to qualify:
              {{contact.first_name}} {{contact.last_name}}
              Specialty: {{contact.specialty}}
              [View in Portal →](https://staffing.seraphyncare.com/admin)"

[6]  END
```

---

### NRS-04 — Credentialing Triggered (Webhook)

**Trigger:** Inbound Webhook → `nurse.document_uploaded` (fired when nurse uploads license or resume on portal)

**Nodes:**

```
[1]  TRIGGER: Inbound Webhook (nurse document upload)

[2]  ACTION: Move Pipeline → Stage 4 (Credentialing In Progress)

[3]  ACTION: Add Tag → nurse-credentialing

[4]  ACTION: Send Email to Nurse —
             Subject: "Documents received — we're reviewing your credentials"
             Body: "Hi {{contact.first_name}}, we've received your documents 
             and our team is reviewing your credentials. 
             We'll notify you once you're credentialed and ready to be matched."

[5]  ACTION: Send Internal Notification to Seraphyn Team —
             "Nurse documents uploaded — ready for credential verification:
              {{contact.first_name}} {{contact.last_name}}
              [View in Portal →](https://staffing.seraphyncare.com/admin)"

[6]  END
```

> **Note:** Stage 5 (Credentialed) is moved **manually** by the Seraphyn team after document verification.
> n8n resume parsing runs in parallel and updates `ai_parsed_data`; it does not replace human credential review.

---

### NRS-05 — Placement & Post-Placement (Webhook)

**Trigger:** Inbound Webhook → `application.interview_scheduled` OR `application.hired`

**Nodes:**

```
[1]  TRIGGER: Inbound Webhook (application milestone)

[2]  IF/ELSE: webhook = application.interview_scheduled?
             → YES: Move Pipeline → Stage 8 (Interview Scheduled)
                    Send internal notification to Seraphyn Team
                    END
             → NO: Continue hired branch

[3]  ACTION: Move Pipeline → Stage 10 (Placed)

[4]  ACTION: Remove Tag → Ready to Place
             Add Tag → nurse-placed

[5]  ACTION: Send Email to Nurse —
             Subject: "You've been selected — congratulations! 🎉"
             Body: "Hi {{contact.first_name}}, congratulations! 
             You've been selected for a placement with 
             {{contact.company_name}}. 
             Your Seraphyn team will be in touch shortly 
             with next steps and shift details."

[6]  ACTION: Send Internal Notification to Seraphyn Team —
             "Nurse placed — confirm first shift to move to Active Worker:
              {{contact.first_name}} {{contact.last_name}}"

[7]  END
```

> **Note:** Stage 11 (Active Worker) is moved **manually** by the Seraphyn team after first shift confirmed.

---

## Employer Workflows (6 Total)

---

### ELS-01 — Entry & Nurture Sequence

**Trigger:** Tag added → `staffing-lead`

**Goal (any condition below kills this workflow):**
- Tag `demo-booked` present, OR
- Tag `strategy-call-booked` present, OR
- Tag `employer-portal-registered` present, OR
- Pipeline stage ≥ 4 (Seraphyn team has qualified the employer — stop automated messages)

**Nodes:**

```
[1]  TRIGGER: Tag Added = staffing-lead

[2]  ACTION: Move Pipeline → Stage 1 (New Inquiry)

[3]  WAIT: 0 mins (immediate)

[4]  ACTION: Send Email — ELS - D01 - Email - Cost Savings Intro
             CTA = trigger link → fires ELS-02 on click

[5]  WAIT: 2 days

[6]  IF/ELSE: demo-booked OR strategy-call-booked OR employer-portal-registered?
             → YES: END
             → NO: Continue

[7]  ACTION: Send SMS — ELS - D03 - SMS - Demo Invite
             link = trigger link → fires ELS-02 on click

[8]  WAIT: 2 days

[9]  IF/ELSE: demo-booked OR strategy-call-booked OR employer-portal-registered?
             → YES: END
             → NO: Continue

[10] ACTION: Send Email — ELS - D05 - Email - Case Study
             CTA = trigger link → fires ELS-02 on click

[11] WAIT: 3 days

[12] IF/ELSE: demo-booked OR strategy-call-booked OR employer-portal-registered?
             → YES: END
             → NO: Continue

[13] ACTION: Send SMS — ELS - D08 - SMS - Urgency Check-in
             link = trigger link → fires ELS-02 on click

[14] WAIT: 3 days

[15] IF/ELSE: demo-booked OR strategy-call-booked OR employer-portal-registered?
             → YES: END
             → NO: Continue

[16] IF/ELSE: Check tag — employer-link-clicked?
             → YES: Skip D11 email (they already engaged)
             → NO: Send Email — ELS - D11 - Email - Turnover Cost

[17] WAIT: 4 days

[18] IF/ELSE: demo-booked OR strategy-call-booked OR employer-portal-registered?
             → YES: END
             → NO: Continue

[19] ACTION: Send Email — ELS - D15 - Email - Free Assessment Offer

[20] WAIT: 1 day

[21] IF/ELSE: Still no conversion?
             → YES: Add Tag → Nurture
                    Move Pipeline → Stage 14 (Nurture)
             → NO: END

[22] END
```

---

### ELS-02 — Link Click Handler

**Trigger:** Trigger link clicked (any ELS email or SMS link)
**Conditions:** `demo-booked` NOT present + `employer-link-clicked` NOT present
**Goal:** Tag `demo-booked` OR `employer-portal-registered`

**Nodes:**

```
[1]  TRIGGER: Trigger Link Clicked (ELS links)
             Filter: demo-booked NOT present
             Filter: employer-link-clicked NOT present

[2]  ACTION: Add Tag → employer-link-clicked

[3]  WAIT: 1 hour

[4]  IF/ELSE: demo-booked OR employer-portal-registered?
             → YES: END
             → NO: Continue

[5]  ACTION: Send SMS —
             "Hi {{contact.first_name}}, looks like you checked out Seraphyn! 
             Ready to see how we can cut your staffing costs? 
             Book a quick 30-min demo here: 
             https://api.leadconnectorhq.com/widget/booking/JRNktDpCFjwEiAusNjGU
             Reply STOP to opt out."

[6]  WAIT: 23 hours

[7]  IF/ELSE: demo-booked OR employer-portal-registered?
             → YES: END
             → NO: Continue

[8]  ACTION: Send Email —
             Subject: "Had a chance to look around?"
             Body: "Hi {{contact.first_name}}, we noticed you checked out 
             what Seraphyn has to offer.
             If you have questions or want to see a live walkthrough 
             built around {{contact.company_name}}'s needs, 
             we're happy to make time.
             [Book a 30-Min Demo →]
             (https://api.leadconnectorhq.com/widget/booking/JRNktDpCFjwEiAusNjGU)"

[9]  END
```

---

### ELS-03 — Demo Booked Handler

**Trigger:** Appointment booked on **Discovery Call** calendar

**Nodes:**

```
[1]  TRIGGER: Appointment Booked — Discovery Call Calendar

[2]  ACTION: Add Tag → demo-booked
             Remove Tag → staffing-lead, employer-link-clicked

[3]  ACTION: Move Pipeline → Stage 5 (Strategy Call Booked)

[4]  ACTION: Send Email to Employer —
             Subject: "Your demo is confirmed — here's what to expect"
             Body: "Hi {{contact.first_name}}, your demo with 
             the Seraphyn team is confirmed. 
             We'll walk you through the platform and show you 
             exactly how it works for facilities like {{contact.company_name}}.
             See you soon,
             The Seraphyn Team"

[5]  ACTION: Send Internal Notification to Seraphyn Team —
             "Demo booked — prepare for call:
              {{contact.first_name}} {{contact.last_name}}
              Company: {{contact.company_name}}
              [View Contact in GHL →]"

[6]  END
```

---

### ELS-04 — Strategy Call Booked Handler

**Trigger:** Appointment booked on **Strategy Call** calendar

**Nodes:**

```
[1]  TRIGGER: Appointment Booked — Strategy Call Calendar

[2]  ACTION: Add Tag → strategy-call-booked
             Remove Tag → staffing-lead, employer-link-clicked

[3]  ACTION: Move Pipeline → Stage 5 (Strategy Call Booked)

[4]  ACTION: Send Email to Employer —
             Subject: "Strategy call confirmed — let's solve your staffing challenges"
             Body: "Hi {{contact.first_name}}, your strategy call 
             with Kundayi is confirmed.
             Before the call, it helps to know:
             - Your current monthly agency spend
             - Your biggest staffing pain point right now
             - How many nurses you typically need per month
             See you soon,
             Kundayi Washaya, Seraphyn Care Solutions"

[5]  ACTION: Send Internal Notification to Seraphyn Team —
             "Strategy call booked — HIGH INTENT LEAD:
              {{contact.first_name}} {{contact.last_name}}
              Company: {{contact.company_name}}
              [View Contact in GHL →]"

[6]  END
```

---

### ELS-05 — Portal Onboarding Confirmed (Webhook)

**Trigger:** Inbound Webhook → `employer.approved` (fired when employer reaches onboarding_stage: approved on portal)

**Nodes:**

```
[1]  TRIGGER: Inbound Webhook (employer portal approved)

[2]  ACTION: Add Tag → employer-portal-registered
             Remove Tag → staffing-lead, employer-link-clicked
             Remove Tag → demo-booked, strategy-call-booked

[3]  ACTION: Move Pipeline → Stage 10 (Onboarding)

[4]  ACTION: Send Email to Employer —
             Subject: "Welcome to Seraphyn — you're approved! 🎉"
             Body: "Hi {{contact.first_name}}, 
             your organization is now fully approved on Seraphyn. 
             You can start posting jobs and connecting with 
             qualified nurses right away.
             [Go to My Dashboard →](https://staffing.seraphyncare.com)"

[5]  ACTION: Send Internal Notification to Seraphyn Team —
             "New employer approved — assign account manager:
              {{contact.company_name}}
              Contact: {{contact.first_name}} {{contact.last_name}}
              [View in Portal →](https://staffing.seraphyncare.com/admin)"

[6]  END
```

> **Note:** Employer signup (Stage 2 — Engaged) also fires a partial webhook (`employer.signup_confirmed`). This should move the pipeline to Stage 2 and notify the team, but not send the approval email. Build as a separate node branch or a lightweight variant of this workflow.

---

### ELS-06 — Consulting Lead Handler

**Trigger:** Tag added → `consulting-lead`
**Purpose:** Consulting leads skip nurture entirely — team contacts directly.

**Nodes:**

```
[1]  TRIGGER: Tag Added = consulting-lead

[2]  ACTION: Move Pipeline → Stage 3 (Assessment Completed)

[3]  ACTION: Send Internal Notification to Seraphyn Team —
             "New consulting enquiry — contact directly, skip nurture:
              {{contact.first_name}} {{contact.last_name}}
              Company: {{contact.company_name}}
              Email: {{contact.email}}
              Phone: {{contact.phone}}"

[4]  ACTION: Send Email to Employer —
             Subject: "We received your assessment — expect a call soon"
             Body: "Hi {{contact.first_name}}, thank you for 
             completing the Seraphyn consulting assessment.
             Our team has reviewed your responses and someone 
             will be reaching out to you personally within 
             1 business day.
             In the meantime, feel free to book a strategy 
             call directly:
             [Book Strategy Call →]
             (https://api.leadconnectorhq.com/widget/booking/uFMSW7I0eMVzSlSpxlJq)"

[5]  END
```

---

## Tag Master Plan

### Nurse Tags

| Tag | Purpose |
|---|---|
| `nurse-lead` | STARTS NRS-01 nurture |
| `nurse-link-clicked` | Engaged but not converted — fires NRS-02 |
| `nurse-portal-registered` | KILLS NRS-01 + NRS-02 — converted |
| `nurse-credentialing` | Documents uploaded — in NRS-04 flow |
| `nurse-placed` | Application hired — in NRS-05 flow |

### Employer Tags

| Tag | Fires / Kills |
|---|---|
| `staffing-lead` | STARTS ELS-01 nurture |
| `consulting-lead` | STARTS ELS-06 (skips nurture) |
| `employer-link-clicked` | Engaged — fires ELS-02 |
| `demo-booked` | KILLS ELS-01, ELS-02 |
| `strategy-call-booked` | KILLS ELS-01, ELS-02 |
| `employer-portal-registered` | KILLS ELS-01, ELS-02 — converted |
| `Nurture` | ELS-01 Day 15 no conversion — long-term pool |
| `High Value` | Manually flagged by Seraphyn team |
| `Urgent` | Immediate staffing need — manually flagged |

---

## Full Workflow Index

| # | Workflow ID | Side | Trigger |
|---|---|---|---|
| 1 | NRS-01 | Nurse | Tag: nurse-lead |
| 2 | NRS-02 | Nurse | Trigger link clicked |
| 3 | NRS-03 | Nurse | Webhook: nurse.signup_confirmed |
| 4 | NRS-04 | Nurse | Webhook: nurse.document_uploaded |
| 5 | NRS-05 | Nurse | Webhook: application.interview_scheduled / application.hired |
| 6 | ELS-01 | Employer | Tag: staffing-lead |
| 7 | ELS-02 | Employer | Trigger link clicked |
| 8 | ELS-03 | Employer | Appointment: Discovery Call booked |
| 9 | ELS-04 | Employer | Appointment: Strategy Call booked |
| 10 | ELS-05 | Employer | Webhook: employer.signup_confirmed / employer.approved |
| 11 | ELS-06 | Employer | Tag: consulting-lead |

---

## Pending Decisions (Requires Kundayi Input)

| Item | Question |
|---|---|
| Admin notification email | What email should internal notifications go to? |
| Inactivity automation | Confirm 90-day threshold for marking nurse Inactive is correct |
