const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole, requireSessionUser } = require('../middleware/auth')
const { dispatchPortalEvent } = require('../lib/portal-events')
const { createNotification } = require('../lib/notifications')
const { ensureEmployerProfileRow, ensurePublicUserForAuthUser } = require('../lib/user-bootstrap')
const { signEmployerContracts, sendSignedContractEmail } = require('../lib/contracts')

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

  const { data: employerProfile } = await supabase
    .from('employer_profiles')
    .select('id, onboarding_stage, approved_at')
    .eq('user_id', req.user.id)
    .single()

  if (!employerProfile || employerProfile.onboarding_stage !== 'approved' || !employerProfile.approved_at) {
    return res.status(403).json({ error: 'Complete onboarding before updating applicants' })
  }

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

    const { signerName, signerTitle, signatureDataUrl, consentAccepted } = req.body || {}
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
