const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')

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

module.exports = router
