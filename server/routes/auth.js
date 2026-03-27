const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth } = require('../middleware/auth')

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { email, password, role, full_name } = req.body
  if (!email || !password || !role || !full_name) {
    return res.status(400).json({ error: 'email, password, role, and full_name are required' })
  }
  if (!['nurse', 'employer'].includes(role)) {
    return res.status(400).json({ error: 'Role must be nurse or employer' })
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name, role } }
  })
  if (error) return res.status(400).json({ error: error.message })
  res.json({ user: data.user, session: data.session })
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return res.status(401).json({ error: error.message })

  // Update last_login_at
  await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', data.user.id)

  res.json({ user: data.user, session: data.session })
})

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  const { error } = await supabase.auth.signOut()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Logged out successfully' })
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.user.id)
    .single()
  res.json({ user: req.user, profile })
})

module.exports = router
