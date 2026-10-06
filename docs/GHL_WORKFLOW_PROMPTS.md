# GHL Workflow Build Prompts

Paste-ready prompts for GHL's **Automation → Workflows → Build using AI** button, one per
workflow still to build. The design they implement is [GHL_AUTOMATIONS.md](GHL_AUTOMATIONS.md);
where the two differ, this file wins, because it reflects what the portal already does
(checked against the live GHL location on 2026-09-27).

Already built: `NRS - 00 - Nurse Lead Capture Bridge`, `NRS-01 - Entry & Nurture Sequence`,
`ELS - 00 - Employer Lead Capture Bridge`. Ten remain.

---

## How to use each prompt

1. **Automation → Workflows → Build using AI.**
2. Paste the prompt in the grey box, exactly as written.
3. When GHL shows the draft, go through the **Check after it builds** list under that prompt.
   The AI builder often gets small things wrong (a missing filter, a wait in hours instead of
   days, a blank email body). Fix them by clicking the step.
4. Rename the workflow to the name in the heading, then leave it in **Draft**.
5. When Kundayi has approved the wording, switch it to **Publish** and click **Save**.

The email and SMS wording below is a first draft for Kundayi to approve or edit.

---

## Do these once, before building anything

**A. Create two trigger links** (**Marketing → Trigger Links → Add Link**):

| Name | URL |
|---|---|
| `NRS - Portal Signup` | `https://staffing.seraphyncare.com/signup?role=nurse` |
| `ELS - Book Demo` | `https://api.leadconnectorhq.com/widget/booking/JRNktDpCFjwEiAusNjGU` |

Nurse emails and SMS use the first, employer emails and SMS the second. A click on a trigger
link is what starts NRS-02 and ELS-02.

**B. Use the hyphenated tags only.** GHL has both `staffing-lead` and `staffing lead`, and
`consulting lead` with a space. Every workflow here uses `staffing-lead` and
`consulting-lead` (GHL creates `consulting-lead` the first time a workflow adds it). You can
delete `staffing lead` and `consulting lead` once nothing uses them.

**C. Internal notifications** go to `info@seraphyncare.com`.

**D. Add the lead tags to ELS - 00.** ELS-01 starts from the `staffing-lead` tag and ELS-06
from `consulting-lead`, but nothing adds either tag yet. Open
`ELS - 00 - Employer Lead Capture Bridge` and, after the Webhook step, add:

1. **If/Else** → condition: contact field **What are you looking for?**
   - Branch 1 *is* `Consulting Services` → **Add Tag** `consulting-lead`
   - Branch 2 *is* `Both` → **Add Tag** `staffing-lead` **and** **Add Tag** `consulting-lead`
   - None branch (Staffing Services) → **Add Tag** `staffing-lead`
2. Save and keep it published.

The portal never adds `staffing-lead` or `nurse-lead` itself, on purpose: those tags start
the nurture sequences, and someone who already has a portal account must not get them.

---

## Group 1 — build these now

These need nothing from the portal side.

### ELS-01 — Entry & Nurture Sequence

```
Create a workflow named "ELS-01 - Entry & Nurture Sequence".

Trigger: Contact Tag added, tag = "staffing-lead".

Workflow settings: do not allow re-entry. Add a workflow goal that ends the workflow when the
contact has any of these tags: "demo-booked", "strategy-call-booked",
"employer-portal-registered".

Steps:
1. Create or update opportunity in pipeline "Seraphyn – Client Pipeline", stage "New Inquiry",
   opportunity name "{{contact.organization_name}}".
2. Send email. Subject: "Cut your agency spend without cutting coverage".
   Body: "Hi {{contact.first_name}}, thanks for reaching out to Seraphyn Care Solutions.
   Facilities like {{contact.organization_name}} use Seraphyn to fill per diem, contract and
   permanent nursing roles with pre-credentialed nurses, typically for less than traditional
   agency rates. The fastest way to see if we're a fit is a 30-minute demo:
   [Book a demo] — The Seraphyn Team". The "Book a demo" link is the trigger link
   "ELS - Book Demo".
3. Wait 2 days.
4. If/Else: contact has tag "demo-booked" OR "strategy-call-booked" OR
   "employer-portal-registered" -> end the workflow. Otherwise continue.
5. Send SMS: "Hi {{contact.first_name}}, it's the Seraphyn team. Want to see how we can staff
   {{contact.organization_name}} faster? Book a 30-min demo: [trigger link ELS - Book Demo]
   Reply STOP to opt out."
6. Wait 2 days.
7. Same If/Else as step 4.
8. Send email. Subject: "How one facility cut agency costs".
   Body: "Hi {{contact.first_name}}, staffing gaps are expensive: overtime, agency premiums
   and burnout add up fast. Seraphyn gives you vetted nurses on demand with transparent
   bill rates and no placement until you approve the candidate. See how it would work for
   {{contact.organization_name}}: [Book a demo]". Link = trigger link "ELS - Book Demo".
9. Wait 3 days.
10. Same If/Else as step 4.
11. Send SMS: "Hi {{contact.first_name}}, any open nursing shifts we can help cover this month?
    Book a quick call: [trigger link ELS - Book Demo] Reply STOP to opt out."
12. Wait 3 days.
13. Same If/Else as step 4.
14. If/Else: contact has tag "employer-link-clicked" -> skip to step 16.
    Otherwise send email. Subject: "What nurse turnover really costs".
    Body: "Hi {{contact.first_name}}, replacing a single nurse can cost a facility tens of
    thousands of dollars once recruiting, onboarding and agency cover are counted. Seraphyn
    helps you fill roles quickly and keep them filled. [Book a demo]".
    Link = trigger link "ELS - Book Demo".
15. (continue)
16. Wait 4 days.
17. Same If/Else as step 4.
18. Send email. Subject: "A free staffing assessment for {{contact.organization_name}}".
    Body: "Hi {{contact.first_name}}, we'd like to offer you a free staffing assessment: a
    short call where we look at your current coverage, agency use and turnover, and show you
    where Seraphyn can help. [Book your free assessment]". Link = trigger link
    "ELS - Book Demo".
19. Wait 1 day.
20. Same If/Else as step 4. If still no conversion: add tag "Nurture" and move the
    opportunity in "Seraphyn – Client Pipeline" to stage "Nurture".
21. End.
```

**Check after it builds**
- The trigger is the tag `staffing-lead` (hyphen), not `staffing lead`.
- The goal (or each If/Else) checks all three tags.
- Waits are in **days**.
- Every "Book a demo" link is the `ELS - Book Demo` trigger link, not a plain URL. If it's a
  plain URL, clicks won't start ELS-02.

### ELS-06 — Consulting Lead Handler

```
Create a workflow named "ELS-06 - Consulting Lead Handler".

Triggers (either one starts it):
- Contact Tag added, tag = "consulting-lead".
- Form Submitted, form = "Consulting Assessment Form".

Steps:
1. Create or update opportunity in pipeline "Seraphyn – Client Pipeline", stage
   "Assessment Completed", opportunity name "{{contact.organization_name}}".
2. Add tag "consulting-lead" (so contacts who came in through the assessment form carry it).
3. Send internal notification email to info@seraphyncare.com.
   Subject: "New consulting enquiry — contact directly".
   Body: "New consulting enquiry. Skip nurture and contact them directly.
   Name: {{contact.first_name}} {{contact.last_name}}
   Organization: {{contact.organization_name}}
   Email: {{contact.email}}
   Phone: {{contact.phone}}"
4. Send email to the contact. Subject: "We received your enquiry — expect a call soon".
   Body: "Hi {{contact.first_name}}, thank you for getting in touch with Seraphyn Care
   Solutions. Someone from our team will reach out to you personally within 1 business day.
   If you'd like to pick a time now, you can book a strategy call directly:
   https://api.leadconnectorhq.com/widget/booking/uFMSW7I0eMVzSlSpxlJq
   — Kundayi Washaya, Seraphyn Care Solutions"
5. End.
```

**Check after it builds**
- Both triggers are there. The assessment-form one needs the **Form** filter set.
- If the Consulting Assessment Form already has its own workflow that sends a thank-you
  email, remove step 4 here so nobody gets two.

### ELS-03 — Discovery Call Booked

```
Create a workflow named "ELS-03 - Discovery Call Booked".

Trigger: Customer Booked Appointment, calendar = "Discovery Call – Seraphyn Care".

Steps:
1. Add tag "demo-booked". Remove tags "staffing-lead" and "employer-link-clicked".
2. Create or update opportunity in pipeline "Seraphyn – Client Pipeline", stage
   "Strategy Call Booked".
3. Send email to the contact. Subject: "Your demo is confirmed — here's what to expect".
   Body: "Hi {{contact.first_name}}, your demo with the Seraphyn team is confirmed for
   {{appointment.start_time}}. We'll walk you through the portal and show you exactly how it
   works for facilities like {{contact.organization_name}}. See you soon, The Seraphyn Team"
4. Send internal notification email to info@seraphyncare.com.
   Subject: "Demo booked — {{contact.organization_name}}".
   Body: "Demo booked. Prepare for the call.
   Name: {{contact.first_name}} {{contact.last_name}}
   Organization: {{contact.organization_name}}
   Time: {{appointment.start_time}}"
5. End.
```

**Check after it builds**
- The calendar filter is **Discovery Call – Seraphyn Care** only.
- If the calendar already sends its own confirmation email (**Calendar settings →
  Notifications**), drop step 3 or turn that notification off, so the contact gets only one.

### ELS-04 — Strategy Call Booked

```
Create a workflow named "ELS-04 - Strategy Call Booked".

Trigger: Customer Booked Appointment, calendar = "Strategy Call – Seraphyn Care".

Steps:
1. Add tag "strategy-call-booked". Remove tags "staffing-lead" and "employer-link-clicked".
2. Create or update opportunity in pipeline "Seraphyn – Client Pipeline", stage
   "Strategy Call Booked".
3. Send email to the contact. Subject: "Strategy call confirmed — let's solve your staffing
   challenges". Body: "Hi {{contact.first_name}}, your strategy call with Kundayi is confirmed
   for {{appointment.start_time}}. Before the call, it helps to have to hand:
   - your current monthly agency spend
   - your biggest staffing pain point right now
   - how many nurses you typically need per month
   See you soon, Kundayi Washaya, Seraphyn Care Solutions"
4. Send internal notification email to info@seraphyncare.com.
   Subject: "Strategy call booked — HIGH INTENT: {{contact.organization_name}}".
   Body: "Strategy call booked.
   Name: {{contact.first_name}} {{contact.last_name}}
   Organization: {{contact.organization_name}}
   Time: {{appointment.start_time}}"
5. End.
```

**Check after it builds:** same two checks as ELS-03, for the Strategy Call calendar.

### NRS-02 — Nurse Link Click Handler

```
Create a workflow named "NRS-02 - Link Click Handler".

Trigger: Trigger Link Clicked, link = "NRS - Portal Signup".
Filters on the trigger: contact does NOT have tag "nurse-portal-registered" AND does NOT have
tag "nurse-link-clicked".

Steps:
1. Add tag "nurse-link-clicked".
2. Wait 1 hour.
3. If/Else: contact has tag "nurse-portal-registered" -> end. Otherwise continue.
4. Send SMS: "Hi {{contact.first_name}}, you're one step away from nursing opportunities near
   you. Create your free Seraphyn profile here — use the same email you applied with and
   your details will be waiting: https://staffing.seraphyncare.com/signup?role=nurse
   Reply STOP to opt out."
5. Wait 23 hours.
6. If/Else: contact has tag "nurse-portal-registered" -> end. Otherwise continue.
7. Send email. Subject: "Still thinking about it, {{contact.first_name}}?"
   Body: "We noticed you checked out Seraphyn. Creating your account takes a minute: use the
   same email address you applied with and the details you already gave us will be filled in
   for you. [Create my account]" linking to
   https://staffing.seraphyncare.com/signup?role=nurse
8. End.
```

**Check after it builds**
- Both "does NOT have tag" filters are on the trigger.
- The links in steps 4 and 7 are **plain URLs**, not the trigger link. A trigger link here
  would restart this same workflow.

### ELS-02 — Employer Link Click Handler

```
Create a workflow named "ELS-02 - Link Click Handler".

Trigger: Trigger Link Clicked, link = "ELS - Book Demo".
Filters on the trigger: contact does NOT have tag "demo-booked" AND does NOT have tag
"employer-link-clicked".

Steps:
1. Add tag "employer-link-clicked".
2. Wait 1 hour.
3. If/Else: contact has tag "demo-booked" OR "employer-portal-registered" -> end.
   Otherwise continue.
4. Send SMS: "Hi {{contact.first_name}}, looks like you checked out Seraphyn! Ready to see how
   we can cut your staffing costs? Book a quick 30-min demo:
   https://api.leadconnectorhq.com/widget/booking/JRNktDpCFjwEiAusNjGU Reply STOP to opt out."
5. Wait 23 hours.
6. Same If/Else as step 3.
7. Send email. Subject: "Had a chance to look around?"
   Body: "Hi {{contact.first_name}}, we noticed you checked out what Seraphyn has to offer.
   If you have questions or want a live walkthrough built around
   {{contact.organization_name}}'s needs, we're happy to make time. [Book a 30-min demo]"
   linking to https://api.leadconnectorhq.com/widget/booking/JRNktDpCFjwEiAusNjGU
8. End.
```

**Check after it builds:** the same two checks as NRS-02. The links here are plain URLs too.

---

## Group 2 — build these, then send me each Inbound Webhook URL

These four start when the portal reports an event: signup confirmed, documents uploaded,
interview or hire, employer approved. Each one starts from an **Inbound Webhook** trigger,
which GHL may label *Premium* and charge per run.

After you build each one:
1. Open its trigger and copy the **webhook URL** GHL shows.
2. Send me the URL together with the workflow name.
3. I'll store it on the server under that event's setting, run one test event so GHL can read
   the fields, and then you map the contact (below).

**Mapping the contact:** once a test event has arrived, set the trigger's contact lookup
to match on **email** = `payload.email`. Without this, GHL can't tell which contact the
event is about.

The portal already moves the **nurse** pipeline stage and adds `nurse-portal-registered`
itself, so the nurse workflows below **don't** do either. Doing it twice would clash.

### NRS-03 — Portal Signup Confirmed

```
Create a workflow named "NRS-03 - Portal Signup Confirmed".

Trigger: Inbound Webhook.

Steps:
1. Remove tags "nurse-lead" and "nurse-link-clicked".
2. Send email to the contact. Subject: "You're on Seraphyn — here's what happens next".
   Body: "Hi {{contact.first_name}}, your Seraphyn account is ready. Our team is reviewing
   your profile and will be in touch shortly. To speed things up, log in and upload your
   nursing license and resume: https://staffing.seraphyncare.com/login"
3. Send internal notification email to info@seraphyncare.com.
   Subject: "New nurse signup — review to qualify".
   Body: "New nurse account confirmed: {{contact.first_name}} {{contact.last_name}}
   Specialty: {{contact.primary_specialty}}
   Review: https://staffing.seraphyncare.com/admin"
4. End.
```

### NRS-04 — Documents Uploaded

```
Create a workflow named "NRS-04 - Documents Uploaded".

Trigger: Inbound Webhook.

Steps:
1. Add tag "nurse-credentialing".
2. Send email to the contact. Subject: "Documents received — we're reviewing your credentials".
   Body: "Hi {{contact.first_name}}, we've received your documents and our team is reviewing
   your credentials. We'll let you know once you're credentialed and ready to be matched."
3. Send internal notification email to info@seraphyncare.com.
   Subject: "Nurse documents uploaded — verify credentials".
   Body: "{{contact.first_name}} {{contact.last_name}} uploaded documents and is ready for
   credential verification. Review: https://staffing.seraphyncare.com/admin"
4. End.
```

### NRS-05 — Interview and Placement

```
Create a workflow named "NRS-05 - Interview and Placement".

Trigger: Inbound Webhook.

Steps:
1. If/Else on the webhook field "event":
   - equals "application.interview_scheduled":
       Send internal notification email to info@seraphyncare.com.
       Subject: "Interview scheduled — {{contact.first_name}} {{contact.last_name}}".
       Body: "An employer moved {{contact.first_name}} {{contact.last_name}} to interview.
       Check the application in the portal: https://staffing.seraphyncare.com/admin"
       End.
   - equals "application.hired": continue to step 2.
2. Remove tag "ready to place". Add tag "nurse-placed".
3. Send email to the contact. Subject: "You've been selected — congratulations!"
   Body: "Hi {{contact.first_name}}, congratulations! You've been selected for a placement.
   Your Seraphyn team will be in touch shortly with next steps and shift details."
4. Send internal notification email to info@seraphyncare.com.
   Subject: "Nurse placed — confirm first shift".
   Body: "{{contact.first_name}} {{contact.last_name}} was hired. Confirm their first shift,
   then move them to Active Worker."
5. End.
```

(The design's "Placed with {{contact.company_name}}" line was dropped: on a nurse's contact
that field is empty, because the facility belongs to the employer's contact.)

### ELS-05 — Employer Signup and Approval

```
Create a workflow named "ELS-05 - Employer Signup and Approval".

Trigger: Inbound Webhook.

Steps:
1. If/Else on the webhook field "event":
   - equals "employer.signup_confirmed":
       Create or update opportunity in pipeline "Seraphyn – Client Pipeline", stage "Engaged".
       Send internal notification email to info@seraphyncare.com.
       Subject: "New employer portal signup — {{contact.organization_name}}".
       Body: "{{contact.first_name}} {{contact.last_name}} created an employer portal account
       and is completing onboarding."
       End.
   - equals "employer.approved": continue to step 2.
2. Remove tags "staffing-lead", "employer-link-clicked", "demo-booked",
   "strategy-call-booked".
3. Create or update opportunity in pipeline "Seraphyn – Client Pipeline", stage "Onboarding".
4. Send email to the contact. Subject: "Welcome to Seraphyn — you're approved!"
   Body: "Hi {{contact.first_name}}, {{contact.organization_name}} is now fully approved on
   Seraphyn. You can start posting jobs and connecting with qualified nurses right away:
   https://staffing.seraphyncare.com/employer/dashboard"
5. Send internal notification email to info@seraphyncare.com.
   Subject: "Employer approved — assign account manager".
   Body: "{{contact.organization_name}} ({{contact.first_name}} {{contact.last_name}}) is
   approved on the portal."
6. End.
```

The portal adds `employer-portal-registered` itself at signup, so ELS-05 doesn't need to.
