const { supabase } = require('../config/supabase')

function hasValue(value) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

async function getPublicUserById(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, role, status, full_name, email, phone')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

async function ensurePublicUserForAuthUser(authUser, roleOverride = '') {
  if (!authUser?.id) {
    throw new Error('Missing authenticated user')
  }

  const existing = await getPublicUserById(authUser.id)
  const role = roleOverride || authUser.user_metadata?.role || existing?.role || ''
  const fullName = authUser.user_metadata?.full_name || existing?.full_name || ''
  const email = authUser.email || existing?.email || ''
  const phone = authUser.phone || existing?.phone || null

  if (existing) {
    const patch = {}
    if (!hasValue(existing.role) && hasValue(role)) patch.role = role
    if (!hasValue(existing.full_name) && hasValue(fullName)) patch.full_name = fullName
    if (!hasValue(existing.email) && hasValue(email)) patch.email = email
    if (!hasValue(existing.phone) && hasValue(phone)) patch.phone = phone

    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString()
      const { data, error } = await supabase
        .from('users')
        .update(patch)
        .eq('id', authUser.id)
        .select('id, role, status, full_name, email, phone')
        .single()

      if (error) throw error
      return data
    }

    return existing
  }

  const now = new Date().toISOString()
  const payload = {
    id: authUser.id,
    role: role || 'employer',
    status: 'pending',
    full_name: fullName,
    email,
    phone,
    created_at: now,
    updated_at: now
  }

  const { data, error } = await supabase
    .from('users')
    .insert(payload)
    .select('id, role, status, full_name, email, phone')
    .single()

  if (error) throw error
  return data
}

async function ensureEmployerProfileRow(userId, seed = {}) {
  const payload = {
    user_id: userId,
    org_name: seed.org_name || '',
    org_type: seed.org_type || '',
    contact_name: seed.contact_name || '',
    contact_title: seed.contact_title || '',
    city: seed.city || '',
    state: seed.state || '',
    bed_count: seed.bed_count ?? null,
    description: seed.description || '',
    onboarding_stage: seed.onboarding_stage || 'profile',
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('employer_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) throw error
  return data
}

async function resolveRoleFromProfileTables(userId) {
  const [{ data: nurseProfile }, { data: employerProfile }] = await Promise.all([
    supabase.from('nurse_profiles').select('user_id').eq('user_id', userId).maybeSingle(),
    supabase.from('employer_profiles').select('user_id').eq('user_id', userId).maybeSingle()
  ])

  if (nurseProfile?.user_id) return 'nurse'
  if (employerProfile?.user_id) return 'employer'
  return ''
}

module.exports = {
  ensurePublicUserForAuthUser,
  ensureEmployerProfileRow,
  getPublicUserById,
  resolveRoleFromProfileTables
}
