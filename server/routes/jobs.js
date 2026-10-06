const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole, requireApproved } = require('../middleware/auth')
const { requireFullAccessEmployer } = require('../lib/employer-access')
const {
  readBudgetInput,
  readUrgencyInput,
  saveBudget,
  loadBudgets,
  publicJobShape
} = require('../lib/job-budgets')

// Columns an employer (or admin) may change through PUT. An allowlist: the old
// spread of req.body let an employer write any column, e.g. created_at or the
// deprecated pay_rate that nurses can read.
const JOB_UPDATABLE_FIELDS = [
  'title', 'specialty', 'city', 'state', 'shift_type', 'contract_length',
  'description', 'requirements', 'status', 'expires_at'
]
const JOB_STATUSES = ['active', 'filled', 'closed', 'paused']

// GET /api/jobs — public
router.get('/', async (req, res) => {
  const { specialty, state, shift_type, urgency, limit = 50, offset = 0 } = req.query
  let query = supabase
    .from('jobs')
    .select('*, employer_profiles(org_name, city, state)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

  if (specialty) query = query.eq('specialty', specialty)
  if (state) query = query.eq('state', state)
  if (shift_type) query = query.eq('shift_type', shift_type)
  if (urgency) query = query.eq('urgency', urgency)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json((data || []).map(publicJobShape))
})

// GET /api/jobs/mine -- the employer's own jobs with their budgets, for the
// post-job page and the directory's "compare against a job" picker.
router.get('/mine', requireAuth, requireRole('employer'), async (req, res) => {
  try {
    const { data: ep } = await supabase.from('employer_profiles').select('id').eq('user_id', req.user.id).maybeSingle()
    if (!ep) return res.json([])

    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, title, specialty, city, state, shift_type, contract_length, requirements, urgency, status, created_at')
      .eq('employer_id', ep.id)
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })

    const budgets = await loadBudgets((jobs || []).map((job) => job.id))
    res.json((jobs || []).map((job) => ({
      ...job,
      target_bill_rate: budgets.get(job.id)?.target_bill_rate ?? null,
      max_bill_rate: budgets.get(job.id)?.max_bill_rate ?? null
    })))
  } catch (error) {
    console.error('Load own jobs failed:', error.message)
    res.status(500).json({ error: 'Failed to load your jobs' })
  }
})

// GET /api/jobs/:id — public
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, employer_profiles(org_name, city, state, description)')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Job not found' })
  res.json(publicJobShape(data))
})

// POST /api/jobs — approved employer only
router.post('/', requireAuth, requireRole('employer'), requireApproved, async (req, res) => {
  const gate = await requireFullAccessEmployer(req.user.id, 'post jobs')
  if (gate.error) return res.status(gate.status).json({ error: gate.error })
  const ep = gate.profile

  const { title, specialty, city, state, shift_type, contract_length, description, requirements } = req.body || {}
  if (!title || !specialty || !city || !state) {
    return res.status(400).json({ error: 'title, specialty, city, and state are required' })
  }

  const budgetInput = readBudgetInput(req.body || {})
  if (budgetInput.error) return res.status(400).json({ error: budgetInput.error })
  if (budgetInput.budget.max_bill_rate == null && budgetInput.budget.target_bill_rate == null) {
    return res.status(400).json({ error: 'Enter at least a maximum bill rate so we can match nurses to your budget' })
  }

  const { data, error } = await supabase.from('jobs').insert({
    employer_id: ep.id,
    title, specialty, city, state,
    location: `${city}, ${state}`,
    shift_type, contract_length, description, requirements,
    urgency: readUrgencyInput(req.body || {}) || 'standard',
    status: 'active',
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  }).select().single()

  if (error) return res.status(500).json({ error: error.message })

  try {
    const budget = await saveBudget(data.id, budgetInput.budget)
    res.status(201).json({ ...data, target_bill_rate: budget?.target_bill_rate ?? null, max_bill_rate: budget?.max_bill_rate ?? null })
  } catch (budgetError) {
    // A job without its budget would be matched as "no budget"; take it down
    // rather than leave it live in that state.
    await supabase.from('jobs').delete().eq('id', data.id)
    console.error('Saving job budget failed:', budgetError.message)
    res.status(500).json({ error: 'Failed to save the job budget' })
  }
})

// PUT /api/jobs/:id — employer owns job or admin
router.put('/:id', requireAuth, requireRole('employer', 'admin'), async (req, res) => {
  const { id } = req.params

  if (req.user.role !== 'admin') {
    const { data: ep } = await supabase.from('employer_profiles').select('id').eq('user_id', req.user.id).single()
    const { data: job } = await supabase.from('jobs').select('employer_id').eq('id', id).single()
    if (!job || job.employer_id !== ep?.id) return res.status(403).json({ error: 'Not authorized' })
  }

  const body = req.body || {}
  const updates = { updated_at: new Date().toISOString() }
  for (const field of JOB_UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) updates[field] = body[field]
  }
  if (updates.status !== undefined && !JOB_STATUSES.includes(updates.status)) {
    return res.status(400).json({ error: 'Invalid job status' })
  }
  const urgency = readUrgencyInput(body)
  if (urgency) updates.urgency = urgency
  if (updates.city || updates.state) {
    const { data: current } = await supabase.from('jobs').select('city, state').eq('id', id).single()
    updates.location = `${updates.city || current?.city || ''}, ${updates.state || current?.state || ''}`
  }

  const budgetInput = readBudgetInput(body)
  if (budgetInput.error) return res.status(400).json({ error: budgetInput.error })

  const { data, error } = await supabase.from('jobs').update(updates).eq('id', id).select().single()
  if (error) return res.status(500).json({ error: error.message })

  try {
    await saveBudget(id, budgetInput.budget)
    const budgets = await loadBudgets([id])
    res.json({
      ...data,
      target_bill_rate: budgets.get(id)?.target_bill_rate ?? null,
      max_bill_rate: budgets.get(id)?.max_bill_rate ?? null
    })
  } catch (budgetError) {
    console.error('Updating job budget failed:', budgetError.message)
    res.status(500).json({ error: 'The job was updated but its budget was not' })
  }
})

// DELETE /api/jobs/:id — close the job (soft delete)
router.delete('/:id', requireAuth, requireRole('employer', 'admin'), async (req, res) => {
  const { id } = req.params

  if (req.user.role !== 'admin') {
    const { data: ep } = await supabase.from('employer_profiles').select('id').eq('user_id', req.user.id).single()
    const { data: job } = await supabase.from('jobs').select('employer_id').eq('id', id).single()
    if (!job || job.employer_id !== ep?.id) return res.status(403).json({ error: 'Not authorized' })
  }

  const { error } = await supabase.from('jobs').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Job closed successfully' })
})

// POST /api/jobs/:id/apply — nurse applies to job
router.post('/:id/apply', requireAuth, requireRole('nurse'), async (req, res) => {
  const { data: np } = await supabase.from('nurse_profiles').select('id').eq('user_id', req.user.id).single()
  if (!np) return res.status(404).json({ error: 'Nurse profile not found' })

  const { data: nurseUser } = await supabase.from('users').select('status').eq('id', req.user.id).single()
  if (!nurseUser || nurseUser.status !== 'approved') {
    return res.status(403).json({ error: 'Your account must be approved before applying to jobs' })
  }

  const { data: job } = await supabase.from('jobs').select('id, employer_id, status').eq('id', req.params.id).single()
  if (!job || job.status !== 'active') return res.status(400).json({ error: 'Job is not available' })

  // Check for existing application
  const { data: existing } = await supabase.from('applications').select('id').eq('job_id', job.id).eq('nurse_id', np.id).single()
  if (existing) return res.status(409).json({ error: 'Already applied to this job' })

  const { data, error } = await supabase.from('applications').insert({
    job_id: job.id,
    nurse_id: np.id,
    employer_id: job.employer_id,
    status: 'submitted',
    cover_note: req.body.cover_note || null
  }).select().single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

module.exports = router
