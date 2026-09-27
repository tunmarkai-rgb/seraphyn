const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole, requireSessionUser } = require('../middleware/auth')
const { dispatchPortalEvent } = require('../lib/portal-events')
const { createNotification, notifyAdmins, notifyInternalInbox } = require('../lib/notifications')
const { ensureEmployerProfileRow, ensurePublicUserForAuthUser } = require('../lib/user-bootstrap')
const { signEmployerContracts, sendSignedContractEmail } = require('../lib/contracts')
const { claimLeadForAuthUser, hasClaimedLead } = require('../lib/leads')
const { syncContactForUser } = require('../lib/ghl-sync')
const { requireFullAccessEmployer } = require('../lib/employer-access')
const { getBillingSettings, computeBillRate, resolveMarkupPct, loadRateRow } = require('../lib/rates')
const {
  employerRequestShape,
  loadRequest,
  applyTransition,
  recordEvent,
  loadNurseSummaries
} = require('../lib/nurse-requests')

function isEmployerUser(req) {
  return req.user?.role === 'employer' || req.authUser?.user_metadata?.role === 'employer'
}

async function getEmployerProfileByUserId(userId) {
  const { data } = await supabase
    .from('employer_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  return data || null
}

// GET /api/employers — admin only
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { data, error } = await supabase
    .from('employer_profiles')
    .select('*, users(email, status, created_at)')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/employers/self - current employer profile
router.get('/self', requireAuth, requireRole('employer'), async (req, res) => {
  const profile = await getEmployerProfileByUserId(req.user.id)
  if (!profile) return res.status(404).json({ error: 'Employer profile not found' })
  res.json(profile)
})

// Registered before the parameterised routes below: Express matches in
// registration order, so router.get('/:id') would otherwise swallow
// GET /nurse-requests and report "Employer not found".
// --- Employer-initiated nurse requests -----------------------------------

// POST /api/employers/nurse-requests
router.post('/nurse-requests', requireAuth, requireRole('employer'), async (req, res) => {
  try {
    const gate = await requireFullAccessEmployer(req.user.id, 'request a nurse')
    if (gate.error) return res.status(gate.status).json({ error: gate.error })

    const body = req.body || {}
    const nurseId = String(body.nurse_id || '').trim()
    if (!nurseId) return res.status(400).json({ error: 'nurse_id is required' })

    const engagementType = body.engagement_type === 'contract' ? 'contract' : 'per_diem'
    if (!body.start_date) return res.status(400).json({ error: 'A start date is required' })

    const { data: nurse } = await supabase
      .from('nurse_profiles')
      .select('id, first_name, last_name, specialty, approved_at')
      .eq('id', nurseId)
      .maybeSingle()

    if (!nurse || !nurse.approved_at) {
      return res.status(404).json({ error: 'Nurse not found' })
    }

    // Snapshot the bill rate the employer was shown, so a later rate change is
    // detectable rather than silently re-pricing an open request.
    let quotedBillRate = null
    let markupSnapshot = null
    try {
      const settings = await getBillingSettings()
      const rateRow = await loadRateRow(nurseId)
      quotedBillRate = computeBillRate(rateRow, settings)
      markupSnapshot = resolveMarkupPct(rateRow, settings)
    } catch (rateError) {
      console.error('Could not snapshot bill rate for request:', rateError.message)
    }

    const { data, error } = await supabase
      .from('nurse_requests')
      .insert({
        employer_id: gate.profile.id,
        nurse_id: nurseId,
        engagement_type: engagementType,
        specialty: body.specialty || nurse.specialty || null,
        city: body.city || gate.profile.city || null,
        state: body.state || gate.profile.state || null,
        start_date: body.start_date,
        end_date: engagementType === 'contract' ? body.end_date || null : null,
        hours_per_week: body.hours_per_week ? Number(body.hours_per_week) : null,
        shift_type: body.shift_type || null,
        employer_note: String(body.employer_note || '').trim(),
        quoted_bill_rate: quotedBillRate,
        markup_pct_snapshot: markupSnapshot,
        created_by: req.user.id
      })
      .select('*')
      .single()

    if (error) {
      // Partial unique index on non-terminal statuses.
      if (/duplicate key|unique/i.test(error.message)) {
        return res.status(409).json({ error: 'You already have an open request for this nurse' })
      }
      return res.status(500).json({ error: error.message })
    }

    await recordEvent({
      requestId: data.id,
      actorRole: 'employer',
      actorId: req.user.id,
      fromStatus: null,
      toStatus: 'submitted'
    })

    await notifyAdmins({
      type: 'nurse_request.submitted',
      title: 'New nurse request',
      body: `${gate.profile.org_name || 'An employer'} requested ${nurse.first_name || 'a nurse'}.`,
      entityType: 'nurse_request',
      entityId: data.id
    })

    notifyInternalInbox({
      subject: `New nurse request from ${gate.profile.org_name || 'an employer'}`,
      title: 'New nurse request',
      body: `${gate.profile.org_name || 'An employer'} requested ${nurse.first_name || ''} ${nurse.last_name || ''}`.trim()
    }).catch((mailError) => console.error('Internal inbox notify failed:', mailError.message))

    dispatchPortalEvent('employer.nurse_requested', {
      requestId: data.id,
      employerId: gate.profile.id,
      nurseId
    }, { sync: { type: 'employer', id: gate.profile.id } })
      .catch((eventError) => console.error('Portal event failed:', eventError.message))

    res.status(201).json(employerRequestShape(data, nurse))
  } catch (error) {
    console.error('Nurse request create failed:', error.message)
    res.status(500).json({ error: 'Failed to submit the request' })
  }
})

// GET /api/employers/nurse-requests
router.get('/nurse-requests', requireAuth, requireRole('employer'), async (req, res) => {
  try {
    const gate = await requireFullAccessEmployer(req.user.id, 'view your requests')
    if (gate.error) return res.status(gate.status).json({ error: gate.error })

    const { data, error } = await supabase
      .from('nurse_requests')
      .select('*')
      .eq('employer_id', gate.profile.id)
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })

    const rows = data || []
    const nurses = await loadNurseSummaries(rows.map((r) => r.nurse_id))
    res.json(rows.map((r) => employerRequestShape(r, nurses.get(r.nurse_id) || null)))
  } catch (error) {
    console.error('Nurse request list failed:', error.message)
    res.status(500).json({ error: 'Failed to load your requests' })
  }
})

// POST /api/employers/nurse-requests/:id/withdraw
router.post('/nurse-requests/:id/withdraw', requireAuth, requireRole('employer'), async (req, res) => {
  try {
    const gate = await requireFullAccessEmployer(req.user.id, 'withdraw a request')
    if (gate.error) return res.status(gate.status).json({ error: gate.error })

    const request = await loadRequest(req.params.id)
    if (!request || request.employer_id !== gate.profile.id) {
      return res.status(404).json({ error: 'Request not found' })
    }

    const result = await applyTransition(request, {
      role: 'employer',
      actorId: req.user.id,
      toStatus: 'closed',
      patch: { closed_reason: String(req.body?.reason || 'Withdrawn by employer').trim() },
      note: String(req.body?.reason || '').trim()
    })
    if (result.error) return res.status(result.status).json({ error: result.error })

    await notifyAdmins({
      type: 'nurse_request.withdrawn',
      title: 'Nurse request withdrawn',
      body: `${gate.profile.org_name || 'An employer'} withdrew a nurse request.`,
      entityType: 'nurse_request',
      entityId: request.id
    })

    const nurses = await loadNurseSummaries([request.nurse_id])
    res.json(employerRequestShape(result.request, nurses.get(request.nurse_id) || null))
  } catch (error) {
    console.error('Nurse request withdraw failed:', error.message)
    res.status(500).json({ error: 'Failed to withdraw the request' })
  }
})

// GET /api/employers/:id
router.get('/:id', requireAuth, requireRole('admin', 'employer'), async (req, res) => {
  const { data, error } = await supabase
    .from('employer_profiles')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Employer not found' })
  res.json(data)
})

// PUT /api/employers/:id — employer updates own profile
router.put('/:id', requireAuth, requireRole('employer', 'admin'), async (req, res) => {
  const { id } = req.params
  const updates = req.body

  if (req.user.role !== 'admin') {
    const { data: ep } = await supabase.from('employer_profiles').select('user_id').eq('id', id).single()
    if (!ep || ep.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' })
  }

  delete updates.id
  delete updates.user_id
  delete updates.approved_at
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase.from('employer_profiles').update(updates).eq('id', id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// PUT /api/employers/applications/:id/status — employer updates application status
router.put('/applications/:id/status', requireAuth, requireRole('employer'), async (req, res) => {
  const { status } = req.body
  const allowedStatuses = ['reviewing', 'interview', 'offer', 'hired', 'rejected']

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid application status' })
  }

  const applicantGate = await requireFullAccessEmployer(req.user.id, 'update applicants')
  if (applicantGate.error) return res.status(applicantGate.status).json({ error: applicantGate.error })
  const employerProfile = applicantGate.profile

  const { data: application } = await supabase
    .from('applications')
    .select('id, employer_id, job_id, nurse_id, status')
    .eq('id', req.params.id)
    .single()

  if (!application) return res.status(404).json({ error: 'Application not found' })
  if (application.employer_id !== employerProfile.id) {
    return res.status(403).json({ error: 'Not authorized to update this application' })
  }

  const updates = {
    status,
    updated_at: new Date().toISOString()
  }

  if (status === 'hired') {
    updates.hired_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('applications')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  const statusLabels = {
    reviewing: 'reviewing',
    interview: 'interview scheduled',
    offer: 'offer extended',
    hired: 'hired',
    rejected: 'not selected'
  }

  const { data: nurseProfile } = await supabase
    .from('nurse_profiles')
    .select('user_id')
    .eq('id', data.nurse_id)
    .maybeSingle()

  if (nurseProfile?.user_id) {
    await createNotification({
      userId: nurseProfile.user_id,
      type: 'application.status_changed',
      title: 'Application updated',
      body: `Your application is now ${statusLabels[status] || status}.`,
      entityType: 'application',
      entityId: data.id,
      metadata: {
        status,
        jobId: data.job_id
      }
    })
  }

  if (status === 'interview') {
    void dispatchPortalEvent('application.interview_scheduled', {
      applicationId: data.id,
      employerId: data.employer_id,
      jobId: data.job_id,
      nurseId: data.nurse_id
    })
  }

  if (status === 'hired') {
    void dispatchPortalEvent('application.hired', {
      applicationId: data.id,
      employerId: data.employer_id,
      jobId: data.job_id,
      nurseId: data.nurse_id,
      hiredAt: data.hired_at
    })
  }

  res.json(data)
})

// POST /api/employers/self/bootstrap -- called when onboarding opens. Makes
// sure the profile row exists and applies any GHL lead for this confirmed
// email, so Step 1 opens with the details the employer already gave us.
router.post('/self/bootstrap', requireSessionUser, async (req, res) => {
  try {
    if (!isEmployerUser(req)) {
      return res.status(403).json({ error: 'Employer access required' })
    }

    const publicUser = await ensurePublicUserForAuthUser(req.authUser, 'employer')
    await claimLeadForAuthUser(req.authUser, 'employer')
    const metadata = req.authUser.user_metadata || {}
    const employer = await ensureEmployerProfileRow(publicUser.id, {
      contact_name: metadata.full_name || [metadata.first_name, metadata.last_name].filter(Boolean).join(' ')
    }, { fillEmptyOnly: true })

    res.json({ employer, prefilledFromLead: await hasClaimedLead(publicUser.id) })
  } catch (error) {
    console.error('Employer bootstrap failed:', error.message)
    res.status(500).json({ error: 'Failed to prepare employer profile' })
  }
})

router.post('/onboarding/profile', requireSessionUser, async (req, res) => {
  try {
    if (!isEmployerUser(req)) {
      return res.status(403).json({ error: 'Employer access required' })
    }

    const publicUser = await ensurePublicUserForAuthUser(req.authUser, 'employer')
    const {
      org_name,
      org_type,
      contact_name,
      contact_title,
      city,
      state,
      bed_count,
      description
    } = req.body || {}

    const employer = await ensureEmployerProfileRow(publicUser.id, {
      org_name,
      org_type,
      contact_name,
      contact_title,
      city,
      state,
      bed_count: bed_count ? parseInt(bed_count, 10) : null,
      description,
      onboarding_stage: 'contract'
    })

    void syncContactForUser(publicUser.id, 'employer')

    res.json({
      employer,
      onboardingStage: employer.onboarding_stage || 'contract'
    })
  } catch (error) {
    console.error('Employer onboarding profile save failed:', error.message)
    res.status(500).json({ error: error.message || 'Failed to save employer onboarding profile' })
  }
})

router.post('/contracts/sign', requireSessionUser, async (req, res) => {
  try {
    if (!isEmployerUser(req)) {
      return res.status(403).json({ error: 'Employer access required' })
    }

    const publicUser = await ensurePublicUserForAuthUser(req.authUser, 'employer')
    const employer = await getEmployerProfileByUserId(publicUser.id)
    if (!employer?.id) {
      return res.status(404).json({ error: 'Employer profile not found' })
    }

    const { signerName, signerTitle, signatureDataUrl, consentAccepted, agreementFields = {} } = req.body || {}
    if (!consentAccepted) {
      return res.status(400).json({ error: 'Electronic signature consent is required' })
    }
    if (!signerName || !signatureDataUrl) {
      return res.status(400).json({ error: 'Signer name and signature are required' })
    }

    const signResult = await signEmployerContracts({
      employer,
      signerName,
      signerTitle,
      signerEmail: publicUser.email || req.authUser.email,
      signatureDataUrl,
      agreementFields,
      ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '',
      userAgent: req.headers['user-agent'] || ''
    })

    await sendSignedContractEmail({
      employerEmail: publicUser.email || req.authUser.email,
      employerName: employer.contact_name || signerName,
      ccEmail: 'info@seraphyncare.com',
      contracts: signResult.contracts
    })

    void dispatchPortalEvent('employer.contract_signed', {
      employerId: employer.id,
      employerUserId: publicUser.id,
      orgName: employer.org_name,
      signedAt: signResult.signedAt
    }, {
      sync: { type: 'employer', id: employer.id }
    })

    await notifyAdmins({
      type: 'employer.contract_signed',
      title: 'Employer agreements completed',
      body: `${employer.org_name || signerName} completed all required agreements and is ready for final approval.`,
      entityType: 'employer_profile',
      entityId: employer.id,
      metadata: {
        signedAt: signResult.signedAt
      }
    })

    await notifyInternalInbox({
      subject: 'Seraphyn: employer agreements signed',
      title: 'Employer agreements completed',
      body: `${employer.org_name || signerName} completed all required agreements and signed copies were issued.`
    })

    res.json({
      message: 'Contracts signed successfully',
      signedAt: signResult.signedAt,
      contracts: signResult.contracts.map((contract) => ({
        id: contract.record.id,
        documentType: contract.documentType,
        title: contract.title,
        status: contract.record.status
      }))
    })
  } catch (error) {
    console.error('Employer contract signing failed:', error.message)
    res.status(500).json({ error: error.message || 'Failed to sign employer contracts' })
  }
})

module.exports = router
