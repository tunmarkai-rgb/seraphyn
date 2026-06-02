const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')
const { sendContractTemplate } = require('../lib/ghl')
const { syncEmployerContactById, syncNurseContactById } = require('../lib/ghl-sync')
const { dispatchPortalEvent } = require('../lib/portal-events')
const { createNotification } = require('../lib/notifications')

// All admin routes require auth + admin role
router.use(requireAuth, requireRole('admin'))

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  const [
    { count: totalNurses },
    { count: totalEmployers },
    { count: activeJobs },
    { count: totalApplications },
    { count: pendingNurses },
    { count: pendingEmployers },
    { data: recentPayments },
    { data: recentNurses },
    { data: recentEmployers },
  ] = await Promise.all([
    supabase.from('nurse_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('employer_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('applications').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'nurse').eq('status', 'pending'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'employer').eq('status', 'pending'),
    supabase.from('payments').select('amount').eq('status', 'succeeded'),
    supabase.from('nurse_profiles').select('*, users(email, status)').order('created_at', { ascending: false }).limit(3),
    supabase.from('employer_profiles').select('*, users(email, status)').order('created_at', { ascending: false }).limit(3),
  ])

  const totalRevenue = (recentPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0)

  res.json({
    totalNurses, totalEmployers, activeJobs, totalApplications,
    pendingNurses, pendingEmployers, totalRevenue,
    recentNurses: recentNurses || [],
    recentEmployers: recentEmployers || []
  })
})

// GET /api/admin/nurses
router.get('/nurses', async (req, res) => {
  const { status } = req.query
  let query = supabase
    .from('nurse_profiles')
    .select('*, users!inner(id, email, status, full_name, created_at)')
    .order('created_at', { ascending: false })
  if (status) query = query.eq('users.status', status)
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const nurseIds = (data || []).map((nurse) => nurse.id)
  let latestApplicationsByNurse = {}

  if (nurseIds.length > 0) {
    const { data: applications } = await supabase
      .from('applications')
      .select('id, nurse_id, status, created_at, jobs(title)')
      .in('nurse_id', nurseIds)
      .order('created_at', { ascending: false })

    for (const application of applications || []) {
      if (!latestApplicationsByNurse[application.nurse_id]) {
        latestApplicationsByNurse[application.nurse_id] = application
      }
    }
  }

  res.json((data || []).map((nurse) => ({
    ...nurse,
    latest_application: latestApplicationsByNurse[nurse.id] || null
  })))
})

// PUT /api/admin/nurses/:id/status
router.put('/nurses/:id/status', async (req, res) => {
  const { status } = req.body || {}
  if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Invalid nurse status' })
  }

  const { data: nurse } = await supabase
    .from('nurse_profiles')
    .select('id, user_id')
    .eq('id', req.params.id)
    .single()

  if (!nurse) {
    return res.status(404).json({ error: 'Nurse not found' })
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('users')
    .update({ status, updated_at: now })
    .eq('id', nurse.user_id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Nurse status updated', status })
})

// PUT /api/admin/nurses/:id/approve
router.put('/nurses/:id/approve', async (req, res) => {
  const { data: np } = await supabase.from('nurse_profiles').select('user_id').eq('id', req.params.id).single()
  if (!np) return res.status(404).json({ error: 'Nurse not found' })

  const now = new Date().toISOString()

  await Promise.all([
    supabase.from('users').update({ status: 'approved', updated_at: now }).eq('id', np.user_id),
    supabase.from('nurse_profiles').update({ approved_at: now }).eq('id', req.params.id)
  ])

  try {
    await syncNurseContactById(req.params.id)
  } catch (syncError) {
    console.error('Failed to sync nurse contact during approval:', syncError.response?.data || syncError.message)
  }

  void dispatchPortalEvent('nurse.approved', {
    nurseId: req.params.id,
    nurseUserId: np.user_id,
    approvedAt: now
  }, {
    sync: { type: 'nurse', id: req.params.id }
  })

  res.json({ message: 'Nurse approved' })
})

// PUT /api/admin/nurses/:id/reject
router.put('/nurses/:id/reject', async (req, res) => {
  const { data: np } = await supabase.from('nurse_profiles').select('user_id').eq('id', req.params.id).single()
  if (!np) return res.status(404).json({ error: 'Nurse not found' })

  await supabase.from('users').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', np.user_id)
  res.json({ message: 'Nurse rejected' })
})

// GET /api/admin/employers
router.get('/employers', async (req, res) => {
  const { status } = req.query
  let query = supabase
    .from('employer_profiles')
    .select('*, users!inner(id, email, status, full_name, created_at), contracts(*)')
    .order('created_at', { ascending: false })
  if (status) query = query.eq('users.status', status)
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// PUT /api/admin/employers/:id/status
router.put('/employers/:id/status', async (req, res) => {
  const { status } = req.body || {}
  if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Invalid employer status' })
  }

  const { data: employer } = await supabase
    .from('employer_profiles')
    .select('id, user_id')
    .eq('id', req.params.id)
    .single()

  if (!employer) {
    return res.status(404).json({ error: 'Employer not found' })
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('users')
    .update({ status, updated_at: now })
    .eq('id', employer.user_id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Employer status updated', status })
})

// PUT /api/admin/employers/:id/approve
router.put('/employers/:id/approve', async (req, res) => {
  const { data: ep } = await supabase
    .from('employer_profiles')
    .select('user_id, contract_signed, contract_signed_at, org_name')
    .eq('id', req.params.id)
    .single()
  if (!ep) return res.status(404).json({ error: 'Employer not found' })
  if (!ep.contract_signed) {
    return res.status(400).json({ error: 'Contract must be signed before approval' })
  }

  const now = new Date().toISOString()
  await Promise.all([
    supabase.from('users').update({ status: 'approved', updated_at: now }).eq('id', ep.user_id),
    supabase.from('employer_profiles').update({ approved_at: now, onboarding_stage: 'approved', updated_at: now }).eq('id', req.params.id)
  ])

  void dispatchPortalEvent('employer.approved', {
    employerId: req.params.id,
    employerUserId: ep.user_id,
    orgName: ep.org_name,
    approvedAt: now,
    contractSignedAt: ep.contract_signed_at
  }, {
    sync: { type: 'employer', id: req.params.id }
  })

  res.json({ message: 'Employer approved' })
})

// POST /api/admin/employers/:id/send-contract
router.post('/employers/:id/send-contract', async (req, res) => {
  let { data: employer, error } = await supabase
    .from('employer_profiles')
    .select('id, user_id, org_name, contact_name, ghl_contact_id, contract_signed, users!inner(email)')
    .eq('id', req.params.id)
    .single()

  if (error || !employer) return res.status(404).json({ error: 'Employer not found' })
  if (employer.contract_signed) {
    return res.status(400).json({ error: 'Contract already signed for this employer' })
  }
  if (!employer.ghl_contact_id) {
    try {
      const syncResult = await syncEmployerContactById(employer.id)
      employer = { ...employer, ghl_contact_id: syncResult.contactId }
    } catch (syncError) {
      console.error('Failed to sync employer contact before sending contract:', syncError.response?.data || syncError.message)
      return res.status(400).json({ error: 'Employer is not synced to GHL yet and automatic sync failed.' })
    }
  }

  const contractName = `${employer.org_name || employer.contact_name || 'Employer'} Staffing Agreement`

  try {
    const sendResult = await sendContractTemplate({
      contactId: employer.ghl_contact_id,
      contractName
    })

    const now = new Date().toISOString()
    const contractPayload = {
      employer_id: employer.id,
      template_url: `ghl-template:${process.env.GHL_DOCUMENT_TEMPLATE_ID}`,
      status: 'sent',
      sent_at: now,
      ...(sendResult.referenceId ? { docuseal_submission_id: sendResult.referenceId } : {})
    }

    const { data: existingContract } = await supabase
      .from('contracts')
      .select('id')
      .eq('employer_id', employer.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingContract?.id) {
      await supabase
        .from('contracts')
        .update(contractPayload)
        .eq('id', existingContract.id)
    } else {
      await supabase
        .from('contracts')
        .insert(contractPayload)
    }

    await supabase
      .from('employer_profiles')
      .update({
        onboarding_stage: 'contract',
        updated_at: now
      })
      .eq('id', employer.id)

    void dispatchPortalEvent('employer.contract_sent', {
      employerId: employer.id,
      employerUserId: employer.user_id,
      orgName: employer.org_name,
      email: employer.users?.email,
      ghlContactId: employer.ghl_contact_id,
      contractReferenceId: sendResult.referenceId
    }, {
      sync: { type: 'employer', id: employer.id }
    })

    res.json({
      message: 'Contract sent successfully',
      contractReferenceId: sendResult.referenceId || null
    })
  } catch (sendError) {
    console.error('Failed to send GHL contract:', sendError.response?.data || sendError.message)
    res.status(502).json({
      error: 'Failed to send contract through GHL Documents',
      details: sendError.response?.data || sendError.message
    })
  }
})

router.post('/employers/:id/sync-contact', async (req, res) => {
  try {
    const result = await syncEmployerContactById(req.params.id)
    res.json({ message: 'Employer synced to GHL successfully', ...result })
  } catch (error) {
    console.error('Employer GHL sync failed:', error.response?.data || error.message)
    res.status(502).json({
      error: 'Failed to sync employer to GHL',
      details: error.response?.data || error.message
    })
  }
})

router.post('/nurses/:id/sync-contact', async (req, res) => {
  try {
    const result = await syncNurseContactById(req.params.id)
    res.json({ message: 'Nurse synced to GHL successfully', ...result })
  } catch (error) {
    console.error('Nurse GHL sync failed:', error.response?.data || error.message)
    res.status(502).json({
      error: 'Failed to sync nurse to GHL',
      details: error.response?.data || error.message
    })
  }
})

// GET /api/admin/applications
router.get('/applications', async (req, res) => {
  const { status } = req.query
  let query = supabase
    .from('applications')
    .select('*, jobs(title, city, state, specialty), nurse_profiles(id, first_name, last_name), employer_profiles(org_name)')
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/admin/payments
router.get('/payments', async (req, res) => {
  const { type = 'all', status = 'all' } = req.query
  let query = supabase
    .from('payments')
    .select('*, employer_profiles(org_name)')
    .order('created_at', { ascending: false })

  if (type !== 'all') query = query.eq('type', type)
  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const payments = data || []
  const succeeded = payments.filter((payment) => payment.status === 'succeeded')
  const monthly = {}

  for (const payment of succeeded) {
    const key = new Date(payment.created_at).toISOString().slice(0, 7)
    monthly[key] = (monthly[key] || 0) + (Number(payment.amount) || 0)
  }

  res.json({
    payments,
    analytics: {
      totalRevenue: succeeded.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
      subscriptionRevenue: succeeded
        .filter((payment) => payment.type === 'subscription')
        .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
      placementRevenue: succeeded
        .filter((payment) => payment.type === 'placement_fee')
        .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
      succeededCount: payments.filter((payment) => payment.status === 'succeeded').length,
      pendingCount: payments.filter((payment) => payment.status === 'pending').length,
      failedCount: payments.filter((payment) => payment.status === 'failed').length,
      refundedCount: payments.filter((payment) => payment.status === 'refunded').length,
      monthlyRevenue: Object.entries(monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount }))
    }
  })
})

// POST /api/admin/payments
router.post('/payments', async (req, res) => {
  const {
    employer_id,
    type,
    amount,
    currency = 'usd',
    placement_percentage = null,
    job_id = null,
    application_id = null,
    status = 'pending',
    notes = ''
  } = req.body || {}

  if (!employer_id || !type || amount === undefined || amount === null) {
    return res.status(400).json({ error: 'employer_id, type, and amount are required' })
  }

  if (!['subscription', 'placement_fee'].includes(type)) {
    return res.status(400).json({ error: 'Invalid payment type' })
  }

  if (!['pending', 'succeeded', 'failed', 'refunded'].includes(status)) {
    return res.status(400).json({ error: 'Invalid payment status' })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('payments')
    .insert({
      employer_id,
      type,
      amount,
      currency,
      placement_percentage,
      job_id,
      application_id,
      status,
      notes,
      created_at: now,
      updated_at: now
    })
    .select('*, employer_profiles(org_name)')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// PUT /api/admin/payments/:id
router.put('/payments/:id', async (req, res) => {
  const allowed = [
    'employer_id',
    'type',
    'amount',
    'currency',
    'placement_percentage',
    'job_id',
    'application_id',
    'status',
    'notes'
  ]

  const updates = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) {
      updates[key] = req.body[key]
    }
  }

  const { data, error } = await supabase
    .from('payments')
    .update(updates)
    .eq('id', req.params.id)
    .select('*, employer_profiles(org_name)')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// DELETE /api/admin/payments/:id
router.delete('/payments/:id', async (req, res) => {
  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Payment deleted' })
})

// GET /api/admin/shifts
router.get('/shifts', async (req, res) => {
  const { status = 'all' } = req.query
  let query = supabase
    .from('per_diem_shifts')
    .select('*, employer_profiles(org_name, city, state), nurse_profiles(first_name, last_name)')
    .order('shift_date', { ascending: true })

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// PUT /api/admin/shifts/:id
router.put('/shifts/:id', async (req, res) => {
  const updates = { updated_at: new Date().toISOString() }
  if (req.body?.status !== undefined) updates.status = req.body.status
  if (req.body?.admin_notes !== undefined) updates.admin_notes = req.body.admin_notes

  const { data, error } = await supabase
    .from('per_diem_shifts')
    .update(updates)
    .eq('id', req.params.id)
    .select('*, employer_profiles(org_name, city, state), nurse_profiles(first_name, last_name)')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/admin/jobs
router.get('/jobs', async (req, res) => {
  const { status } = req.query
  let query = supabase
    .from('jobs')
    .select('*, employer_profiles(org_name, city, state)')
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// PUT /api/admin/jobs/:id/status
router.put('/jobs/:id/status', async (req, res) => {
  const { status } = req.body || {}
  if (!['active', 'paused', 'filled', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid job status' })
  }

  const { data, error } = await supabase
    .from('jobs')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select('*')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// PUT /api/admin/applications/:id
router.put('/applications/:id', async (req, res) => {
  const { admin_notes, placement_fee_pct, status } = req.body
  const updates = { updated_at: new Date().toISOString() }
  if (admin_notes !== undefined) updates.admin_notes = admin_notes
  if (placement_fee_pct !== undefined) updates.placement_fee_pct = placement_fee_pct
  if (status) updates.status = status
  if (status === 'hired') updates.hired_at = new Date().toISOString()

  const { data, error } = await supabase.from('applications').update(updates).eq('id', req.params.id).select().single()
  if (error) return res.status(500).json({ error: error.message })

  const { data: nurseProfile } = await supabase
    .from('nurse_profiles')
    .select('user_id')
    .eq('id', data.nurse_id)
    .maybeSingle()

  if (nurseProfile?.user_id && status) {
    await createNotification({
      userId: nurseProfile.user_id,
      type: 'application.status_changed',
      title: 'Application updated',
      body: `Your application status is now ${status}.`,
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

router.post('/nurses/:id/job-matched', async (req, res) => {
  const { data: nurse } = await supabase
    .from('nurse_profiles')
    .select('id, user_id, specialty')
    .eq('id', req.params.id)
    .single()

  if (!nurse) {
    return res.status(404).json({ error: 'Nurse not found' })
  }

  await dispatchPortalEvent('nurse.job_matched', {
    nurseId: nurse.id,
    nurseUserId: nurse.user_id,
    specialty: nurse.specialty,
    jobId: req.body?.jobId || null
  }, {
    sync: { type: 'nurse', id: nurse.id }
  })

  if (nurse.user_id) {
    await createNotification({
      userId: nurse.user_id,
      type: 'nurse.job_matched',
      title: 'A new job match is ready',
      body: 'Seraphyn found a new job match for your profile.',
      entityType: 'nurse_profile',
      entityId: nurse.id,
      metadata: {
        jobId: req.body?.jobId || null
      }
    })
  }

  res.json({ message: 'Job matched event dispatched' })
})

module.exports = router
