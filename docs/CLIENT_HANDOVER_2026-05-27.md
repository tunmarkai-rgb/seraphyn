# Seraphyn Portal Platform Handover

Prepared for the Seraphyn team as a full portal capability and usage reference.

## 1. Portal Overview

The Seraphyn portal is the operational system used by the Seraphyn team, nurses, and employers.

It currently supports three role-based experiences:
- Admin portal
- Nurse portal
- Employer portal

The portal is designed to handle:
- account creation and authentication
- employer onboarding
- nurse onboarding and profile completion
- job posting and applications
- internal/admin review workflows
- in-app notifications
- private document access
- portal-native employer agreement signing
- CRM and automation handoff through GHL and n8n

## 2. Role-Based Access

### Admin
Admins can:
- review pending nurse accounts
- review pending employer accounts
- approve or reject users
- view employer contract status
- view/download signed employer agreements
- view nurse profile details and uploaded documents
- monitor dashboard stats
- receive operational notifications inside the portal

### Nurse
Nurses can:
- sign up and confirm email
- log in to the nurse dashboard
- complete and edit their profile
- upload resume
- upload nursing license
- upload certification proof documents
- browse jobs
- apply to jobs
- send and receive messages
- view notification bell alerts

### Employer
Employers can:
- sign up and confirm email
- complete organization onboarding
- review and complete both required agreements
- access a pending-approval dashboard after signing
- download signed agreements
- post jobs after approval
- review applications after approval
- send and receive messages
- view notification bell alerts

## 3. Admin Journey

### Admin dashboard
The admin dashboard is the control center for platform oversight. It surfaces:
- total nurses
- total employers
- active jobs
- total applications
- pending nurse approvals
- pending employer approvals

### Admin review for nurses
Admins should use the nurse management area to:
1. open pending nurse records
2. review profile details
3. confirm whether required fields are complete
4. review uploaded resume, nursing license, and certification proof documents
5. approve or reject the nurse

Important behavior:
- a nurse can sign up before their profile is fully complete
- the Seraphyn team is notified at signup
- the Seraphyn team is notified again when the nurse reaches 100% profile completion
- the second notification is the strongest signal that the profile is ready for review

### Admin review for employers
Admins should use the employer management area to:
1. review organization profile details
2. confirm both agreements have been completed
3. open/download signed agreements
4. approve or reject the employer

Important behavior:
- employer approval stays blocked until the required agreements are signed
- once the agreements are signed, the employer remains in a pending approval state until an admin approves them

### Admin notifications
The admin team should currently expect internal operational signals for:
- new nurse signup
- new employer signup
- nurse profile reaching 100%
- employer agreement completion

These should surface in:
- the admin portal notification bell
- the internal operational inbox at `info@seraphyncare.com`

## 4. Nurse Journey

### Nurse acquisition and signup
Current nurse flow:
1. nurse enters from the nurse funnel / social flow
2. nurse reaches the portal signup page
3. nurse creates account
4. nurse confirms email
5. nurse is redirected into the nurse dashboard

### Nurse dashboard
The nurse dashboard gives the nurse:
- profile completion visibility
- document status
- recent applications
- job recommendations / open jobs

### Nurse profile management
The nurse profile page allows:
- editing personal details
- editing specialty and license details
- selecting certifications
- uploading:
  - resume / CV
  - nursing license copy
  - certification proof files

Current supported nurse document types:
- PDF
- DOC
- DOCX
- JPG
- JPEG
- PNG

### Profile completion logic
The nurse profile completion logic is used for approval readiness.

The profile is considered complete when the required fields are present, including:
- personal details
- professional details
- license details
- bio
- resume
- nursing license

When a nurse reaches 100%:
- an internal notification is created
- an internal operational email should be sent to `info@seraphyncare.com`
- the event is available for automation

### Nurse documents
Resume, license, and certification proof documents are stored as private portal assets.

Access rules:
- the nurse can access their own documents
- admins can review them
- approved employers can view the allowed private nurse documents when applicable inside the portal

## 5. Employer Journey

### Employer signup
Current employer flow:
1. employer creates account
2. employer confirms email
3. employer enters employer onboarding

### Employer onboarding
Employer onboarding currently has three stages:
1. Organization Profile
2. Sign Agreement
3. Pending Approval

### Stage 1: Organization Profile
The employer enters:
- organization name
- organization type
- contact name
- contact title
- city
- state
- number of beds
- organization description

### Stage 2: Agreement completion
The employer must complete both required agreements:
- Direct Hire Agreement
- Per Diem Staffing Agreement

The portal-native agreement flow now supports:
- in-portal agreement review
- explicit agreement fields
- explicit acknowledgement checkboxes
- signer identity fields
- required initials / completion fields
- final electronic signature generation
- signed PDF generation and storage

### Stage 3: Pending Approval
After signing:
- the employer moves to pending approval
- signed documents remain downloadable
- the employer can open the pending dashboard state
- the employer still requires admin approval before full portal use

### Signed agreement delivery
Once the agreement set is completed:
- signed PDFs are generated
- signed PDFs are emailed to the employer
- `info@seraphyncare.com` receives a copy
- the employer can download the signed documents in the portal
- admins can download the signed documents in the portal

### Employer dashboard after approval
Once approved, employers can:
- post jobs
- manage job postings
- review applicants
- update applicant status
- message candidates
- access signed agreement history

## 6. Jobs, Applications, and Messaging

### Jobs
Approved employers can create and manage jobs.

Jobs include:
- title
- specialty
- location
- shift details
- pay rate
- contract length
- requirements

### Applications
Nurses can apply to jobs.

Application statuses currently include:
- submitted
- reviewing
- interview
- offer
- hired
- rejected

Employers and admins can update application status from their respective portal areas.

### Messaging
The portal includes messaging between parties.

Current expected behavior:
- in-app notifications for new messages
- notification bell updates
- email alerts for new messages

## 7. Notifications and Operational Triggers

### In-app notifications
The bell notification system exists for:
- nurses
- employers
- admins

It is intended to surface:
- new messages
- workflow state changes
- internal review triggers

### Internal operational email routing
Operational internal email is standardized to:
- `info@seraphyncare.com`

This is intended to receive:
- new nurse signups
- new employer signups
- nurse 100% completion alerts
- employer contract completion alerts

### Contract signed trigger
Once both employer agreements are completed, the system should provide a visible trigger through:
- internal email to `info@seraphyncare.com`
- admin in-app notification
- internal portal event / automation event (`employer.contract_signed`)

## 8. Resume Parsing

### What it is
Resume parsing converts an uploaded nurse resume into structured data the portal can use.

In plain language:
1. a nurse uploads a resume
2. the workflow extracts the readable text from the file
3. Claude processes the text
4. Claude returns structured nursing profile data
5. that parsed output is saved to `ai_parsed_data`
6. the parsed output can support:
   - profile enrichment
   - admin review
   - matching
   - screening workflows

### Current status
Resume parsing is built and wired, but not fully testable right now because the LLM credit is too low.

Important interpretation:
- this is a credit/testing constraint
- it is not being treated as a missing feature design

Once credit is restored, the live resume parsing test should confirm:
- resume upload triggers the workflow
- parsed JSON is written to `ai_parsed_data`
- safe profile backfill behavior works as intended

## 9. Documents and Agreement Access

### Nurse documents
The portal supports private handling of:
- resume
- nursing license
- certification proof files

### Employer documents
The portal supports private handling of:
- signed Direct Hire Agreement
- signed Per Diem Staffing Agreement

### Access model
These documents are not intended to be public.

They are accessed through:
- signed download links
- authenticated portal screens
- admin/employer/nurse role restrictions as appropriate

## 10. Important Current Constraints

These are the main operational constraints the Seraphyn team should understand:

### Resume parsing
- built and wired
- currently credit-blocked for testing

### Approval still matters
- nurse signup does not equal nurse approval
- employer agreement completion does not equal employer approval
- admin approval is still the final control point

### Agreement wording and field coverage
- the agreement experience is portal-native
- if the business wants additional signer fields, initials, or wording changes, those can still be refined after test review

### GHL and n8n
- the portal already has direct behavior for several workflows
- GHL and n8n remain part of the broader operating model for CRM and automation handoff

## 11. Recommended Joint Test Agenda

For the testing call, the best order is:

1. Admin overview
   - dashboard
   - nurse approvals
   - employer approvals
   - notifications

2. Nurse journey
   - signup
   - email confirmation
   - dashboard
   - profile completion
   - resume/license/certification uploads

3. Employer journey
   - signup
   - email confirmation
   - onboarding step 1
   - agreement review and signing
   - pending approval state
   - signed document access

4. Messaging and notifications
   - send a message
   - verify bell notification
   - verify email notification

5. Resume parsing readiness discussion
   - explain workflow
   - confirm blocked only by credits

## 12. Post-Call Next Steps

After the test session, the likely follow-up actions are:
- capture agreement wording/field adjustments
- confirm final internal notification expectations
- perform one live resume parsing test after credit top-up
- finalize any remaining admin approval UX improvements
- complete remaining polish based on Seraphyn team feedback
