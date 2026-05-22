const { supabase } = require('../config/supabase')
const { getPublicUserById } = require('../lib/user-bootstrap')

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' })

    // Fetch user role/status from public.users
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, role, status, full_name, email')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) return res.status(401).json({ error: 'User profile not found' })
    if (profile.status === 'suspended') return res.status(403).json({ error: 'Account suspended' })

    req.user = {
      ...user,
      role: profile.role,
      status: profile.status,
      full_name: profile.full_name,
      email: profile.email
    }
    next()
  } catch (err) {
    return res.status(500).json({ error: 'Authentication error' })
  }
}

async function requireSessionUser(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' })

    const profile = await getPublicUserById(user.id)

    req.authUser = user
    req.user = profile
      ? {
          ...user,
          role: profile.role,
          status: profile.status,
          full_name: profile.full_name,
          email: profile.email
        }
      : {
          ...user,
          role: user.user_metadata?.role || '',
          status: 'pending',
          full_name: user.user_metadata?.full_name || '',
          email: user.email || ''
        }

    next()
  } catch (err) {
    return res.status(500).json({ error: 'Authentication error' })
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` })
    }
    next()
  }
}

function requireApproved(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
  if (req.user.status !== 'approved') {
    return res.status(403).json({ error: 'Account pending approval' })
  }
  next()
}

module.exports = { requireAuth, requireSessionUser, requireRole, requireApproved }
