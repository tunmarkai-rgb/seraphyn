const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')

// GET /api/nurses — admin gets all fields, employer gets limited fields
router.get('/', requireAuth, requireRole('admin', 'employer'), async (req, res) => {
  const isAdmin = req.user.role === 'admin'
  const isApprovedEmployer = req.user.role === 'employer' && req.user.status === 'approved'

  let select = isAdmin
    ? '*'
    : 'id, first_name, specialty, years_experience, availability, shift_preference, certifications, profile_photo_url, approved_at'

  // Approved employers with signed contracts get more fields
  if (isApprovedEmployer) {
    const { data: ep } = await supabase
      .from('employer_profiles')
      .select('onboarding_stage, approved_at')
      .eq('user_id', req.user.id)
      .single()

    if (ep?.onboarding_stage >= 3 && ep?.approved_at) {
      select = 'id, first_name, last_name, specialty, years_experience, availability, shift_preference, certifications, bio, profile_photo_url, approved_at'
    }
  }

  const { data, error } = await supabase
    .from('nurse_profiles')
    .select(select)
    .not('approved_at', 'is', null)
    .order('approved_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/nurses/:id
router.get('/:id', requireAuth, requireRole('admin', 'employer'), async (req, res) => {
  const isAdmin = req.user.role === 'admin'
  let select = isAdmin ? '*' : 'id, first_name, specialty, years_experience, availability'

  if (req.user.role === 'employer') {
    const { data: ep } = await supabase
      .from('employer_profiles')
      .select('onboarding_stage, approved_at')
      .eq('user_id', req.user.id)
      .single()
    if (ep?.onboarding_stage >= 3 && ep?.approved_at) {
      select = 'id, first_name, last_name, specialty, years_experience, availability, shift_preference, certifications, bio, profile_photo_url'
    }
  }

  const { data, error } = await supabase
    .from('nurse_profiles')
    .select(select)
    .eq('id', req.params.id)
    .single()

  if (error) return res.status(404).json({ error: 'Nurse not found' })
  res.json(data)
})

// PUT /api/nurses/:id — nurse updates own profile
router.put('/:id', requireAuth, requireRole('nurse', 'admin'), async (req, res) => {
  const { id } = req.params
  const updates = req.body

  // Verify ownership unless admin
  if (req.user.role !== 'admin') {
    const { data: np } = await supabase.from('nurse_profiles').select('user_id').eq('id', id).single()
    if (!np || np.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' })
  }

  // Remove fields that shouldn't be updated via API
  delete updates.id
  delete updates.user_id
  delete updates.approved_at
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase.from('nurse_profiles').update(updates).eq('id', id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

module.exports = router
