const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')

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
  ] = await Promise.all([
    supabase.from('nurse_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('employer_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('applications').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'nurse').eq('status', 'pending'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'employer').eq('status', 'pending'),
    supabase.from('payments').select('amount').eq('status', 'succeeded'),
  ])

  const totalRevenue = (recentPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0)

  res.json({
    totalNurses, totalEmployers, activeJobs, totalApplications,
    pendingNurses, pendingEmployers, totalRevenue
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
  res.json(data)
})

// PUT /api/admin/nurses/:id/approve
router.put('/nurses/:id/approve', async (req, res) => {
  const { data: np } = await supabase.from('nurse_profiles').select('user_id').eq('id', req.params.id).single()
  if (!np) return res.status(404).json({ error: 'Nurse not found' })

  await Promise.all([
    supabase.from('users').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', np.user_id),
    supabase.from('nurse_profiles').update({ approved_at: new Date().toISOString() }).eq('id', req.params.id)
  ])
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
    .select('*, users!inner(id, email, status, full_name, created_at)')
    .order('created_at', { ascending: false })
  if (status) query = query.eq('users.status', status)
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// PUT /api/admin/employers/:id/approve
router.put('/employers/:id/approve', async (req, res) => {
  const { data: ep } = await supabase.from('employer_profiles').select('user_id').eq('id', req.params.id).single()
  if (!ep) return res.status(404).json({ error: 'Employer not found' })

  await Promise.all([
    supabase.from('users').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', ep.user_id),
    supabase.from('employer_profiles').update({ approved_at: new Date().toISOString(), onboarding_stage: 3 }).eq('id', req.params.id)
  ])
  res.json({ message: 'Employer approved' })
})

// GET /api/admin/applications
router.get('/applications', async (req, res) => {
  const { data, error } = await supabase
    .from('applications')
    .select('*, jobs(title, city, state, specialty), nurse_profiles(first_name, last_name), employer_profiles(org_name)')
    .order('created_at', { ascending: false })
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
  res.json(data)
})

module.exports = router
