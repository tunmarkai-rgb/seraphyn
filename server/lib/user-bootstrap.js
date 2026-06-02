const { supabase } = require('../config/supabase')

function hasValue(value) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function normalizeShiftPreference(value, fallback = null) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return fallback
  if (raw === 'per diem') return 'Per Diem'
  if (raw === 'contract travel') return 'Contract Travel'
  if (raw === 'permanent') return 'Permanent'
  return fallback
}

function normalizeAvailability(value, fallback = null) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return fallback
  if (raw === 'immediate' || raw === 'immediately' || raw === 'available now') return 'Immediate'
  if (raw === '2 weeks') return '2 Weeks'
  if (raw === '30 days' || raw === '1 month') return '30 Days'
  if (raw === 'not available') return 'Not Available'
  return fallback
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

async function ensureNurseProfileRow(userId, seed = {}) {
  const { data: existing, error: existingError } = await supabase
    .from('nurse_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingError) throw existingError

  const payload = {
    ...(existing || {}),
    user_id: userId,
    first_name: hasValue(seed.first_name) ? seed.first_name : (existing?.first_name || ''),
    last_name: hasValue(seed.last_name) ? seed.last_name : (existing?.last_name || ''),
    specialty: hasValue(seed.specialty) ? seed.specialty : (existing?.specialty || ''),
    license_number: hasValue(seed.license_number) ? seed.license_number : (existing?.license_number || ''),
    license_state: hasValue(seed.license_state) ? seed.license_state : (existing?.license_state || ''),
    years_experience: hasValue(seed.years_experience) ? seed.years_experience : (existing?.years_experience ?? null),
    availability: normalizeAvailability(
      hasValue(seed.availability) ? seed.availability : null,
      existing?.availability ?? null
    ),
    shift_preference: normalizeShiftPreference(
      hasValue(seed.shift_preference) ? seed.shift_preference : null,
      existing?.shift_preference ?? null
    ),
    bio: hasValue(seed.bio) ? seed.bio : (existing?.bio || ''),
    certifications: Array.isArray(seed.certifications) && seed.certifications.length > 0
      ? seed.certifications
      : (existing?.certifications || []),
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('nurse_profiles')
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
  ensureNurseProfileRow,
  getPublicUserById,
  normalizeAvailability,
  normalizeShiftPreference,
  resolveRoleFromProfileTables
}
