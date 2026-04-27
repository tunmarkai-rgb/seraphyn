# Seraphyn M2 n8n Pack

This folder tracks the M2 automation bundle for Seraphyn.

## Current Status

- Live workflows in n8n:
  - `Seraphyn - Portal Events Inbound`
  - Workflow ID: `xh5ruX7lGR9m8vIE`
  - Production webhook URL: `https://n8n.seraphyncare.com/webhook/seraphyn-events`
  - Uses native n8n `Header Auth` credential: `Seraphyn Shared Webhook Secret`
- Exported to production, currently inactive until OpenAI key is populated:
  - `Seraphyn - Resume Parser`
  - Workflow ID: `xFl2h0aUGWqK7Zsb`
  - Expected production webhook URL after activation: `https://n8n.seraphyncare.com/webhook/seraphyn-resume-parser`
- Portal env wired to:
  - `N8N_WEBHOOK_URL=https://n8n.seraphyncare.com/webhook/seraphyn-events`
- Portal currently forwards these high-signal events to n8n:
  - `nurse.signup_confirmed`
  - `nurse.document_uploaded`
  - `nurse.approved`
  - `employer.signup_confirmed`
  - `employer.approved`
  - `employer.contract_sent`
  - `employer.contract_signed`
  - `application.interview_scheduled`
  - `application.hired`

## Local MCP Setup

- Project-scoped MCP config lives in `/.mcp.json`
- Seraphyn MCP endpoint: `https://n8n.seraphyncare.com/mcp-server/http`
- Config is intentionally local-only because `.mcp.json` is gitignored
- After adding or changing the MCP config, restart your MCP-aware client/session so it reloads the project server

## Importable Workflow Files

- [workflows/portal-events-inbound.json](workflows/portal-events-inbound.json)
- [workflows/resume-parser.json](workflows/resume-parser.json)

## Native Credentials Created In n8n

- `Seraphyn Shared Webhook Secret` (`httpHeaderAuth`)
- `Seraphyn Supabase API` (`supabaseApi`)
- `Seraphyn OpenAI API` (`openAiApi`)

Current note:
- `Seraphyn OpenAI API` is scaffolded with a placeholder value because a real `OPENAI_API_KEY` is not available in this repo environment yet.

## Remaining Workflow Build Order

### 1. Resume Parser

Trigger:
- Supabase Storage webhook on `resumes/`

Needs:
- `OPENAI_API_KEY`
- Supabase service-role access inside n8n

Primary writes:
- `public.nurse_profiles.ai_parsed_data`
- safe backfill of missing nurse fields

Current import file:
- `workflows/resume-parser.json`

Current assumptions in that workflow:
- supported file types: `pdf`, `rtf`, `txt`
- resume bucket is public-read, so the workflow downloads from Supabase public storage URL
- nurse lookup is done by matching `nurse_profiles.resume_url` against the uploaded object path or public URL
- OpenAI now points at the native `Seraphyn OpenAI API` credential in n8n
- Supabase reads through the native `Seraphyn Supabase API` credential in n8n
- inbound webhook auth now uses the native `Seraphyn Shared Webhook Secret` credential in n8n

### 2. Job Matching

Trigger:
- Supabase DB webhook on approved or updated nurse profile

Needs:
- `OPENAI_API_KEY`
- Supabase service-role access inside n8n

Primary writes:
- `public.nurse_profiles.ai_job_matches`

### 3. Application Screening

Trigger:
- Supabase DB webhook on `applications` insert

Needs:
- `OPENAI_API_KEY`
- Supabase service-role access inside n8n

Primary writes:
- `public.applications.admin_notes`

### 4. Approval Notifications

Trigger:
- portal events now available immediately
- optional Supabase DB webhook on `public.users.status`

Needs:
- chosen delivery path
  - GHL workflow follow-up, or
  - n8n email/SMS provider

### 5. GHL Contact Sync

Trigger:
- Supabase DB webhook on new nurse/employer creation

Current fallback:
- already implemented directly in the portal backend

Needs if moved fully into n8n:
- GHL API token
- Supabase service-role access

## Supabase Webhook Targets To Create Later

Suggested paths in n8n:

- `/webhook/seraphyn-resume-parser`
- `/webhook/seraphyn-job-matching`
- `/webhook/seraphyn-application-screening`
- `/webhook/seraphyn-approval-notifications`
- `/webhook/seraphyn-ghl-contact-sync`

## Open Blockers

- real `OPENAI_API_KEY` not available yet, so resume parser remains inactive
- production backend host still unknown
- GHL signed-document webhook still needs to be configured in HighLevel
