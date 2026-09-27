const { supabase } = require('../config/supabase')
const { normalizeAvailability, normalizeShiftPreference } = require('./lead-normalize')

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

// Column defaults that mean "not chosen yet", so a fill-only seed may replace them.
const PLACEHOLDER_VALUES = {
  shift_preference: new Set(['any'])
}

function isEmptyColumn(column, value) {
  if (!hasValue(value)) return true
  if (Array.isArray(value)) return value.length === 0
  return Boolean(PLACEHOLDER_VALUES[column]?.has(value))
}

// Two write modes:
//   overwrite (default) -- a column present in the seed replaces the stored
//     value; used when the user submits a form.
//   fillEmptyOnly -- the seed only fills columns that are still empty; used for
//     signup metadata and GHL lead prefill, which must never undo a user's edit.
function mergeSeed(existing, seed, { fillEmptyOnly = false } = {}) {
  const merged = { ...(existing || {}) }
  for (const [column, value] of Object.entries(seed)) {
    if (value === undefined) continue
    if (fillEmptyOnly) {
      if (isEmptyColumn(column, merged[column]) && !isEmptyColumn(column, value)) merged[column] = value
    } else {
      merged[column] = value
    }
  }
  return merged
}

async function loadProfileRow(table, userId) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data || null
}

async function upsertProfileRow(table, payload) {
  const { data, error } = await supabase
    .from(table)
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) throw error
  return data
}

async function ensureEmployerProfileRow(userId, seed = {}, options = {}) {
  const existing = await loadProfileRow('employer_profiles', userId)
  const merged = mergeSeed(existing, seed, options)

  return upsertProfileRow('employer_profiles', {
    ...merged,
    user_id: userId,
    org_name: merged.org_name || '',
    org_type: merged.org_type || '',
    contact_name: merged.contact_name || '',
    onboarding_stage: merged.onboarding_stage || 'profile',
    updated_at: new Date().toISOString()
  })
}

async function ensureNurseProfileRow(userId, seed = {}, options = {}) {
  const existing = await loadProfileRow('nurse_profiles', userId)
  const normalizedSeed = { ...seed }
  if ('shift_preference' in normalizedSeed) {
    normalizedSeed.shift_preference = normalizeShiftPreference(normalizedSeed.shift_preference, undefined)
  }
  if ('availability' in normalizedSeed) {
    normalizedSeed.availability = normalizeAvailability(normalizedSeed.availability, undefined)
  }
  const merged = mergeSeed(existing, normalizedSeed, options)

  return upsertProfileRow('nurse_profiles', {
    ...merged,
    user_id: userId,
    first_name: merged.first_name || '',
    last_name: merged.last_name || '',
    updated_at: new Date().toISOString()
  })
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
