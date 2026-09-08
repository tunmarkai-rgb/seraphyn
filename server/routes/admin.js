const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')
const { sendContractTemplate } = require('../lib/ghl')
const { syncEmployerContactById, syncNurseContactById } = require('../lib/ghl-sync')
const { dispatchPortalEvent } = require('../lib/portal-events')
const { createNotification } = require('../lib/notifications')
const {
  SETTINGS_KEY,
  getBillingSettings,
  invalidateBillingSettingsCache,
  validateBillingSettings,
  validateHourlyRate,
  adminRateShape,
  effectiveNurseRate,
  resolveMarkupPct,
  loadRateRow,
  loadRateRows
} = require('../lib/rates')
const { setAdminRate, readRateHistory } = require('../lib/nurse-rates')
const {
  adminRequestShape,
  loadRequest,
  applyTransition,
  loadNurseSummaries,
  loadEmployerSummaries,
  EMPLOYER_STATUS_LABELS
} = require('../lib/nurse-requests')

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

  // Attach rates in one batch rather than a query per nurse.
  let rateRows = new Map()
  let settings = null
  try {
    settings = await getBillingSettings()
    rateRows = await loadRateRows(nurseIds)
  } catch (rateError) {
    console.error('Failed to load nurse rates for admin list:', rateError.message)
  }

  res.json((data || []).map((nurse) => ({
    ...nurse,
    latest_application: latestApplicationsByNurse[nurse.id] || null,
    rate: settings ? adminRateShape(rateRows.get(nurse.id) || null, settings) : null
  })))
})

// GET /api/admin/nurses/:id/rate
router.get('/nurses/:id/rate', async (req, res) => {
  try {
    const settings = await getBillingSettings()
    const rateRow = await loadRateRow(req.params.id)
    res.json(adminRateShape(rateRow, settings))
  } catch (error) {
    console.error('Admin rate read failed:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/admin/nurses/:id/rate/history
router.get('/nurses/:id/rate/history', async (req, res) => {
  try {
    res.json(await readRateHistory(req.params.id))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/admin/nurses/:id/rate
// body { admin_hourly?: number|null, markup_pct_override?: number|null, reason?: string }
router.put('/nurses/:id/rate', async (req, res) => {
  try {
    const { data: nurse } = await supabase
      .from('nurse_profiles')
      .select('id')
      .eq('id', req.params.id)
      .single()

    if (!nurse) return res.status(404).json({ error: 'Nurse not found' })

    const settings = await getBillingSettings()
    const body = req.body || {}
    const patch = {}

    if (Object.prototype.hasOwnProperty.call(body, 'admin_hourly')) {
      const check = validateHourlyRate(body.admin_hourly, settings)
      if (!check.valid) return res.status(400).json({ error: check.error })
      patch.adminHourly = check.value
    }

    if (Object.prototype.hasOwnProperty.call(body, 'markup_pct_override')) {
      const raw = body.markup_pct_override
      if (raw === null || raw === undefined || raw === '') {
        patch.markupPctOverride = null
      } else {
        const pct = Number(raw)
        if (!Number.isFinite(pct) || pct <= 0 || pct > 500) {
          return res.status(400).json({ error: 'Markup override must be between 0 and 500' })
        }
        patch.markupPctOverride = Math.round(pct * 100) / 100
      }
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'Nothing to update' })
    }

    // An override without a reason leaves no trail for a later rate dispute.
    if (patch.adminHourly !== undefined && patch.adminHourly !== null && !String(body.reason || '').trim()) {
      return res.status(400).json({ error: 'A reason is required when overriding a nurse rate' })
    }

    const updated = await setAdminRate(req.params.id, patch, req.user.id, String(body.reason || '').trim())
    res.json(adminRateShape(updated, settings))
  } catch (error) {
    console.error('Admin rate update failed:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/admin/settings/per-diem-billing
router.get('/settings/per-diem-billing', async (req, res) => {
  try {
    res.json(await getBillingSettings())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/admin/settings/per-diem-billing
// Bill rates are computed on read, so a markup change takes effect everywhere
// immediately -- there is no backfill step.
router.put('/settings/per-diem-billing', async (req, res) => {
  try {
    const check = validateBillingSettings(req.body || {})
    if (!check.valid) return res.status(400).json({ error: check.errors.join('; ') })

    const { data: existing } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key: SETTINGS_KEY, value: check.value, updated_by: req.user.id, updated_at: now },
        { onConflict: 'key' }
      )

    if (error) return res.status(500).json({ error: error.message })

    await supabase.from('app_settings_history').insert({
      key: SETTINGS_KEY,
      old_value: existing?.value || null,
      new_value: check.value,
      changed_by: req.user.id,
      note: String(req.body?.note || '').trim()
    })

    invalidateBillingSettingsCache()
    res.json(check.value)
  } catch (error) {
    console.error('Billing settings update failed:', error.message)
    res.status(500).json({ error: error.message })
  }
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

  const employerIds = (data || []).map((employer) => employer.id)
  let latestApplicationsByEmployer = {}

  if (employerIds.length > 0) {
    const { data: applications } = await supabase
      .from('applications')
      .select('id, employer_id, status, created_at, jobs(title), nurse_profiles(first_name, last_name)')
      .in('employer_id', employerIds)
      .order('created_at', { ascending: false })

    for (const application of applications || []) {
      if (!latestApplicationsByEmployer[application.employer_id]) {
        latestApplicationsByEmployer[application.employer_id] = application
      }
    }
  }

  res.json((data || []).map((employer) => ({
    ...employer,
    latest_application: latestApplicationsByEmployer[employer.id] || null
  })))
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
// hourly_rate is the employer's bill rate and is NOT editable here -- the
// employer set it when posting the shift. Admin controls nurse pay and
// assignment.
const SHIFT_UPDATABLE_FIELDS = [
  'status', 'admin_notes', 'nurse_id', 'nurse_pay_rate', 'markup_pct_snapshot'
]

router.put('/shifts/:id', async (req, res) => {
  try {
    const { data: shift } = await supabase
      .from('per_diem_shifts')
      .select('id, hourly_rate, nurse_id, nurse_pay_rate')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!shift) return res.status(404).json({ error: 'Shift not found' })

    const body = req.body || {}
    const updates = { updated_at: new Date().toISOString() }

    for (const field of SHIFT_UPDATABLE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(body, field)) continue

      if (field === 'nurse_pay_rate' || field === 'markup_pct_snapshot') {
        const raw = body[field]
        if (raw === null || raw === undefined || raw === '') {
          updates[field] = null
        } else {
          const num = Number(raw)
          if (!Number.isFinite(num) || num <= 0) {
            return res.status(400).json({ error: `${field} must be greater than zero` })
          }
          updates[field] = Math.round(num * 100) / 100
        }
      } else {
        updates[field] = body[field]
      }
    }

    // Assigning a nurse prefills their pay from their current rate, snapshotting
    // it onto the shift so a later rate change cannot re-price this booking.
    const assigningNurse = updates.nurse_id && updates.nurse_id !== shift.nurse_id
    if (assigningNurse && updates.nurse_pay_rate === undefined) {
      try {
        const settings = await getBillingSettings()
        const rateRow = await loadRateRow(updates.nurse_id)
        const nurseRate = effectiveNurseRate(rateRow)
        if (nurseRate !== null) {
          updates.nurse_pay_rate = nurseRate
          updates.markup_pct_snapshot = resolveMarkupPct(rateRow, settings)
        }
      } catch (rateError) {
        console.error('Could not prefill nurse pay for shift:', rateError.message)
      }
    }

    if (Object.keys(updates).length === 1) {
      return res.status(400).json({ error: 'Nothing to update' })
    }

    const { data, error } = await supabase
      .from('per_diem_shifts')
      .update(updates)
      .eq('id', req.params.id)
      .select('*, employer_profiles(org_name, city, state), nurse_profiles(first_name, last_name)')
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Thin or negative margin is a deliberate business call sometimes, so warn
    // rather than refuse -- but make it impossible to miss.
    const billRate = Number(data.hourly_rate)
    const payRate = Number(data.nurse_pay_rate)
    let rateWarning = null
    if (Number.isFinite(billRate) && Number.isFinite(payRate) && payRate > 0) {
      if (payRate >= billRate) {
        rateWarning = `Nurse pay ${payRate} is at or above the ${billRate} bill rate — this shift loses money.`
      } else if (billRate < payRate * 1.15) {
        rateWarning = `Margin is under 15% on this shift.`
      }
    }

    res.json({ ...data, rate_warning: rateWarning })
  } catch (error) {
    console.error('Shift update failed:', error.message)
    res.status(500).json({ error: 'Failed to update the shift' })
  }
})

// GET /api/admin/shifts/nurse-options — approved nurses for the assignment
// picker, with their current rate so admin can see cost before assigning.
router.get('/shifts/nurse-options', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('nurse_profiles')
      .select('id, first_name, last_name, specialty')
      .not('approved_at', 'is', null)
      .order('first_name', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })

    const nurses = data || []
    try {
      const settings = await getBillingSettings()
      const rateRows = await loadRateRows(nurses.map((n) => n.id))
      return res.json(nurses.map((n) => ({
        ...n,
        current_rate: effectiveNurseRate(rateRows.get(n.id) || null),
        markup_pct: resolveMarkupPct(rateRows.get(n.id) || null, settings)
      })))
    } catch (rateError) {
      console.error('Could not attach rates to nurse options:', rateError.message)
      return res.json(nurses)
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to load nurse options' })
  }
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

// Notifies the nurse and/or the employer after an admin moves a request.
// The employer only ever receives the COARSE label, so they cannot infer
// whether the nurse has been asked yet.
async function notifyParticipants(request, fromStatus) {
  try {
    const [{ data: nurse }, { data: employer }] = await Promise.all([
      supabase.from('nurse_profiles').select('id, user_id, first_name').eq('id', request.nurse_id).maybeSingle(),
      supabase.from('employer_profiles').select('id, user_id, org_name').eq('id', request.employer_id).maybeSingle()
    ])

    const coarse = EMPLOYER_STATUS_LABELS[request.status] || 'In Review'

    if (request.status === 'presented' && nurse?.user_id) {
      await createNotification({
        userId: nurse.user_id,
        type: 'nurse_request.presented',
        title: 'A Seraphyn client is requesting you',
        body: 'Review the assignment details and let us know if you are available.',
        entityType: 'nurse_request',
        entityId: request.id
      })
    }

    if (['placed', 'rejected', 'closed', 'nurse_accepted', 'nurse_declined'].includes(request.status) && employer?.user_id) {
      await createNotification({
        userId: employer.user_id,
        type: `nurse_request.${request.status}`,
        title: `Nurse request: ${coarse}`,
        body: `Your request for ${nurse?.first_name || 'a nurse'} is now marked ${coarse}.`,
        entityType: 'nurse_request',
        entityId: request.id
      })
    }

    if (request.status === 'placed' && nurse?.user_id) {
      await createNotification({
        userId: nurse.user_id,
        type: 'nurse_request.placed',
        title: 'You have been placed',
        body: 'Your coordinator will follow up with assignment details.',
        entityType: 'nurse_request',
        entityId: request.id
      })
    }

    dispatchPortalEvent(`nurse_request.${request.status}`, {
      requestId: request.id,
      fromStatus,
      toStatus: request.status,
      nurseId: request.nurse_id,
      employerId: request.employer_id
    }).catch((eventError) => console.error('Portal event failed:', eventError.message))
  } catch (error) {
    // Notification failure must never roll back a completed transition.
    console.error('notifyParticipants failed:', error.message)
  }
}

// --- Nurse requests -------------------------------------------------------

// GET /api/admin/nurse-requests?status=
router.get('/nurse-requests', async (req, res) => {
  try {
    let query = supabase.from('nurse_requests').select('*').order('created_at', { ascending: false })
    if (req.query.status) query = query.eq('status', req.query.status)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    const rows = data || []
    const [nurses, employers] = await Promise.all([
      loadNurseSummaries(rows.map((r) => r.nurse_id)),
      loadEmployerSummaries(rows.map((r) => r.employer_id))
    ])

    res.json(rows.map((r) => adminRequestShape(r, {
      nurse: nurses.get(r.nurse_id) || null,
      employer: employers.get(r.employer_id) || null
    })))
  } catch (error) {
    console.error('Admin nurse request list failed:', error.message)
    res.status(500).json({ error: 'Failed to load nurse requests' })
  }
})

async function shapeOne(row) {
  const [nurses, employers] = await Promise.all([
    loadNurseSummaries([row.nurse_id]),
    loadEmployerSummaries([row.employer_id])
  ])
  return adminRequestShape(row, {
    nurse: nurses.get(row.nurse_id) || null,
    employer: employers.get(row.employer_id) || null
  })
}

// PUT /api/admin/nurse-requests/:id
// Editable: status (via the transition map), offered_nurse_rate, admin_notes,
// employer_visible_to_nurse. Allowlisted rather than spreading req.body.
router.put('/nurse-requests/:id', async (req, res) => {
  try {
    const request = await loadRequest(req.params.id)
    if (!request) return res.status(404).json({ error: 'Request not found' })

    const body = req.body || {}
    const patch = {}

    if (Object.prototype.hasOwnProperty.call(body, 'offered_nurse_rate')) {
      const raw = body.offered_nurse_rate
      if (raw === null || raw === undefined || raw === '') {
        patch.offered_nurse_rate = null
      } else {
        const rate = Number(raw)
        if (!Number.isFinite(rate) || rate <= 0) {
          return res.status(400).json({ error: 'Offered nurse rate must be greater than zero' })
        }
        patch.offered_nurse_rate = Math.round(rate * 100) / 100
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'admin_notes')) {
      patch.admin_notes = String(body.admin_notes || '')
    }
    if (Object.prototype.hasOwnProperty.call(body, 'employer_visible_to_nurse')) {
      patch.employer_visible_to_nurse = Boolean(body.employer_visible_to_nurse)
    }

    // A status change goes through the transition map; a plain field edit does not.
    if (body.status && body.status !== request.status) {
      const result = await applyTransition(request, {
        role: 'admin',
        actorId: req.user.id,
        toStatus: body.status,
        patch,
        note: String(body.note || '').trim()
      })
      if (result.error) return res.status(result.status).json({ error: result.error })

      await notifyParticipants(result.request, request.status)
      return res.json(await shapeOne(result.request))
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'Nothing to update' })
    }

    const { data, error } = await supabase
      .from('nurse_requests')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', request.id)
      .select('*')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    res.json(await shapeOne(data))
  } catch (error) {
    console.error('Admin nurse request update failed:', error.message)
    res.status(500).json({ error: 'Failed to update the request' })
  }
})

// POST /api/admin/nurse-requests/:id/present
// Reveals the request to the nurse. Requires an offered rate first -- the nurse
// cannot make an informed decision without one.
router.post('/nurse-requests/:id/present', async (req, res) => {
  try {
    const request = await loadRequest(req.params.id)
    if (!request) return res.status(404).json({ error: 'Request not found' })

    const offered = Object.prototype.hasOwnProperty.call(req.body || {}, 'offered_nurse_rate')
      ? Number(req.body.offered_nurse_rate)
      : request.offered_nurse_rate

    if (!offered || !Number.isFinite(Number(offered)) || Number(offered) <= 0) {
      return res.status(400).json({ error: 'Set the offered nurse rate before presenting this request' })
    }

    const patch = { offered_nurse_rate: Math.round(Number(offered) * 100) / 100 }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'employer_visible_to_nurse')) {
      patch.employer_visible_to_nurse = Boolean(req.body.employer_visible_to_nurse)
    }

    const result = await applyTransition(request, {
      role: 'admin',
      actorId: req.user.id,
      toStatus: 'presented',
      patch,
      note: 'Presented to nurse'
    })
    if (result.error) return res.status(result.status).json({ error: result.error })

    await notifyParticipants(result.request, request.status)
    res.json(await shapeOne(result.request))
  } catch (error) {
    console.error('Present nurse request failed:', error.message)
    res.status(500).json({ error: 'Failed to present the request' })
  }
})

// GET /api/admin/nurse-requests/:id/events
router.get('/nurse-requests/:id/events', async (req, res) => {
  const { data, error } = await supabase
    .from('nurse_request_events')
    .select('*')
    .eq('request_id', req.params.id)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

module.exports = router
