const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole, requireApproved } = require('../middleware/auth')

// GET /api/jobs — public
router.get('/', async (req, res) => {
  const { specialty, state, shift_type, pay_min, pay_max, limit = 50, offset = 0 } = req.query
  let query = supabase
    .from('jobs')
    .select('*, employer_profiles(org_name, city, state)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

  if (specialty) query = query.eq('specialty', specialty)
  if (state) query = query.eq('state', state)
  if (shift_type) query = query.eq('shift_type', shift_type)
  if (pay_min) query = query.gte('pay_rate', parseFloat(pay_min))
  if (pay_max) query = query.lte('pay_rate', parseFloat(pay_max))

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/jobs/:id — public
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, employer_profiles(org_name, city, state, description)')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Job not found' })
  res.json(data)
})

// POST /api/jobs — approved employer only
router.post('/', requireAuth, requireRole('employer'), requireApproved, async (req, res) => {
  const { data: ep } = await supabase.from('employer_profiles').select('id, onboarding_stage, approved_at').eq('user_id', req.user.id).single()
  if (!ep || ep.onboarding_stage < 3 || !ep.approved_at) {
    return res.status(403).json({ error: 'Complete onboarding before posting jobs' })
  }

  const { title, specialty, city, state, shift_type, pay_rate, contract_length, description, requirements } = req.body
  if (!title || !specialty || !city || !state) {
    return res.status(400).json({ error: 'title, specialty, city, and state are required' })
  }

  const { data, error } = await supabase.from('jobs').insert({
    employer_id: ep.id,
    title, specialty, city, state,
    location: `${city}, ${state}`,
    shift_type, pay_rate, contract_length, description, requirements,
    status: 'active',
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  }).select().single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

// PUT /api/jobs/:id — employer owns job or admin
router.put('/:id', requireAuth, requireRole('employer', 'admin'), async (req, res) => {
  const { id } = req.params

  if (req.user.role !== 'admin') {
    const { data: ep } = await supabase.from('employer_profiles').select('id').eq('user_id', req.user.id).single()
    const { data: job } = await supabase.from('jobs').select('employer_id').eq('id', id).single()
    if (!job || job.employer_id !== ep?.id) return res.status(403).json({ error: 'Not authorized' })
  }

  const updates = { ...req.body, updated_at: new Date().toISOString() }
  delete updates.id
  delete updates.employer_id

  const { data, error } = await supabase.from('jobs').update(updates).eq('id', id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
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
