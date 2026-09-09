# N8N.md - M2 Automation Bundle
# Phase 2

> n8n is now part of M2, not M3.

---

## Summary

n8n owns Seraphyn's async automation layer in M2.

Recommended ownership split:

- Portal server: auth, admin actions, GHL contract webhooks, access control
- Supabase webhooks: trigger most data-change automations
- n8n: Claude processing, contact sync, matching, screening, and downstream orchestration

Current auth-email note:
- Signup confirmation and password reset emails are currently sent by Supabase Auth through Resend SMTP.
- n8n is not part of the live auth-email path.
- GHL is not the sender for account verification or password recovery in the current setup.

Current implementation note:
- The portal now includes a direct server-side GHL contact sync fallback for nurse/employer records.
- This keeps employer contract sending unblocked if the n8n contact-sync workflow is not live yet.
- n8n should still remain the preferred long-term owner for contact-sync orchestration and retry logic.

Current production workflow state:
- `Seraphyn - Portal Events Inbound` is active in production with workflow ID `JBhroT3TwEIrXPwj`
- `Seraphyn - Resume Parser` is workflow ID `1uJ9q9dgaYSqczjZ`, model Claude Sonnet 5 (`claude-sonnet-5`)
- the resume parser is active and verified end to end against a real 2-page PDF (~2.6K input / 215 output tokens per resume)
- it calls the Messages API via a plain HTTP Request node with structured outputs; the LangChain AI Agent, chat-model and output-parser nodes were removed after the agent runtime OOM-killed the container on a 7KB file
- field extraction is verified against a realistic nurse resume PDF: name, email, phone, licence number/state, 7 years experience, five certifications and nine skills all extracted, and the specialty normalised to the canonical `ICU / Critical Care`
- **`.docx` resumes are silently skipped.** The parser handles `pdf`, `rtf` and `txt` only (n8n's Extract from File node has no DOCX operation), but the nurse profile upload accepts `.pdf,.doc,.docx,.jpg,.png`. At least one live nurse already has a `.docx` resume that will never be parsed. Either restrict the upload accept list to PDF, convert on upload, or add a DOCX extraction path
- `availability` and `shift_preference` are enum-backed columns, so Build Profile Update maps Claude's free text (`"immediate"`, `"nights (7p-7a)"`) to canonical values and **skips the write when it cannot map**. The raw text is still kept in `ai_parsed_data`. Test the negative case when editing those mappings: `not available` contains `available`, so the negative branch must be checked first

---

## Required Workflows

### 1. Resume Parser

Trigger:
- Supabase Storage webhook on `resumes/` uploads

Actions:
- Fetch resume file
- Extract text
- Send to Claude through the native n8n AI Agent path
- Write parsed JSON to `nurse_profiles.ai_parsed_data`
- Backfill empty nurse profile fields where safe

Plain-language explanation:
- a nurse uploads a resume
- the workflow pulls the file and extracts readable text
- Claude converts the unstructured resume into structured profile data
- the structured result is saved to `ai_parsed_data`
- safe empty-field backfill can then enrich the nurse profile without replacing trusted existing values

Primary output:
- `nurse_profiles.ai_parsed_data`

### 2. Job Matching

Trigger:
- Supabase DB webhook on approved or updated nurse profile

Actions:
- Load nurse profile
- Load active jobs
- Rank top matches with Claude
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
- `nurse.profile_completed`
- `nurse.job_matched`
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
- Anthropic credential
- GHL credential / token
- Email delivery path used by the business

Current native credentials already created in production:
- `Seraphyn Shared Webhook Secret` (`httpHeaderAuth`)
- `Seraphyn Supabase API` (`supabaseApi`)
- `Seraphyn Anthropic API` (`anthropicApi`)

Approved delivery split:
- GHL owns contact-facing notification delivery in M2
- n8n stays focused on orchestration, AI work, and data writes
- Supabase + Resend own auth email delivery for signup confirmation and password reset

---

## Environment Variables

Document these in the deployment target used by n8n and/or the portal:

```env
ANTHROPIC_API_KEY=sk-ant-...
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

## Runtime Hardening (docker-compose)

n8n runs on the same DigitalOcean droplet as the portal API, so its memory
budget is shared with production. These settings keep an execution from taking
the container down. Apply on the n8n service, then `docker compose up -d`.

**Applied 2026-09-09** to `/opt/seraphyn-n8n/docker-compose.yml` (backup kept
alongside as `docker-compose.yml.bak-<timestamp>`):

```yaml
      - N8N_DEFAULT_BINARY_DATA_MODE=filesystem
      - EXECUTIONS_DATA_SAVE_ON_ERROR=all
      - EXECUTIONS_DATA_SAVE_ON_PROGRESS=false
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168          # hours
      - N8N_CONCURRENCY_PRODUCTION_LIMIT=1
      - NODE_OPTIONS=--max-old-space-size=768
```

`EXECUTIONS_DATA_SAVE_ON_SUCCESS=none` is the largest storage saver but is
deliberately **not** set yet: successful-run payloads are what make failures
diagnosable, and the parser still needs validating against a real nurse resume.
Add it after that.

Sizing: the droplet is 2GB and n8n is the only container, but PM2 (portal API)
and Caddy run outside Docker on the same host, so the heap cap is 768MB rather
than half of RAM. n8n idles around 410-440MB. Re-tune `--max-old-space-size` if
the droplet is resized again.

### Container memory limit

Also on the n8n service:

```yaml
    mem_limit: 1200m
    memswap_limit: 1800m
```

Without a limit the kernel's OOM reaper picks the victim under pressure, and it
could pick the PM2 portal API rather than n8n. A container limit guarantees
Docker kills only n8n. 1200m sits above the 768m heap cap plus native overhead;
`memswap_limit` lets it lean on ~600MB of swap first, so the failure mode is
degraded rather than dead.

### Swap

The droplet shipped with **zero swap**, which is what made a memory spike an
instant kill rather than a slowdown. Added 2026-09-09:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab   # persist across reboots
sysctl -w vm.swappiness=10                        # cushion, not routine paging
```

`vm.swappiness=10` is persisted in `/etc/sysctl.conf`. Swap sat at 0B used
after a full parse, so this is genuine headroom, not a crutch.

Symptom to recognise: an execution ends with status `crashed` and the message
"Workflow did not finish, possible out-of-memory issue", n8n loses the real node
outputs and returns `isArtificialRecoveredEventItem` placeholders, and Caddy
serves 502 on `n8n.seraphyncare.com` until Docker restarts the container. The
portal API is unaffected only by luck - it shares the box.

---

## Acceptance Checks

- Resume upload populates `ai_parsed_data`
- Nurse 100% completion fires `nurse.profile_completed`
- Job match milestone fires `nurse.job_matched`
- Approved nurse gets `ai_job_matches`
- New application gets screening notes
- Approved users receive the right notification path
- New users receive `ghl_contact_id` and `ghl_synced_at`

---

## Out of Scope

- Replacing portal business logic with n8n
- Using n8n as the canonical access-control layer
- Live payment automation
