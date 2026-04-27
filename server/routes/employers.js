const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')
const { dispatchPortalEvent } = require('../lib/portal-events')

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

module.exports = router
