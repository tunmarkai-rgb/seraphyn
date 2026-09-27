const { supabase } = require('../config/supabase')
const { upsertContact, updateContact, addContactTags, removeContactTags } = require('./ghl')
const {
  specialtyToGhl,
  orgTypeToGhl,
  yearsExperienceToGhl,
  shiftPreferenceToGhl,
  availabilityToGhl
} = require('./lead-normalize')

// Custom-field keys are the ones the GHL funnel forms write, so a contact that
// came in through a form and later signed up on the portal keeps one set of
// fields instead of two. Keys are checked against the live location with
// `node scripts/ghl-custom-fields.js`.

function splitName(fullName = '') {
  const trimmed = String(fullName || '').trim()
  if (!trimmed) return { firstName: '', lastName: '' }

  const [firstName, ...rest] = trimmed.split(/\s+/)
  return {
    firstName,
    lastName: rest.join(' ')
  }
}

function compactCustomFields(fields) {
  return fields.filter(field => {
    if (!field || (!field.id && !field.key)) return false
    const value = field.field_value
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && value !== ''
  })
}

// Portal contacts get the "registered" tags, which end the GHL nurture
// sequences (NRS-01/02, ELS-01/02) whose whole purpose is getting the person
// onto the portal. They never get `nurse-lead` / `staffing-lead`: those tags
// START those sequences, and because tags are added on every sync, re-adding
// one would restart the nurture after GHL had already removed it.
function compactTags(tags) {
  return [...new Set(tags.filter(Boolean))]
}

function buildEmployerContactPayload(employer) {
  const fallbackName = splitName(employer.contact_name || employer.users?.full_name || '')

  return {
    firstName: fallbackName.firstName || employer.contact_name || employer.org_name || 'Employer',
    lastName: fallbackName.lastName || undefined,
    email: employer.users?.email || undefined,
    phone: employer.users?.phone || undefined,
    companyName: employer.org_name || undefined,
    city: employer.city || undefined,
    state: employer.state || undefined,
    source: 'seraphyn-portal',
    tags: compactTags([
      'employer-portal-registered',
      'portal-employer',
      'portal-account',
      employer.contract_signed ? 'contract-signed' : 'contract-pending'
    ]),
    removeTags: employer.contract_signed ? ['contract-pending'] : [],
    customFields: compactCustomFields([
      { key: 'organization_name', field_value: employer.org_name || '' },
      { key: 'organization_type', field_value: orgTypeToGhl(employer.org_type) },
      { key: 'organization_state', field_value: employer.state || '' },
      { key: 'decision_maker_role', field_value: employer.contact_title || '' },
      { key: 'bed_size', field_value: employer.bed_count ? String(employer.bed_count) : '' },
      { key: 'portal_onboarding_stage', field_value: employer.onboarding_stage || 'profile' }
    ])
  }
}

function buildNurseContactPayload(nurse) {
  const derivedName = splitName(nurse.users?.full_name || `${nurse.first_name || ''} ${nurse.last_name || ''}`)

  return {
    firstName: nurse.first_name || derivedName.firstName || 'Nurse',
    lastName: nurse.last_name || derivedName.lastName || undefined,
    email: nurse.users?.email || undefined,
    phone: nurse.users?.phone || undefined,
    state: nurse.license_state || undefined,
    source: 'seraphyn-portal',
    tags: compactTags([
      'nurse-portal-registered',
      'portal-nurse',
      'portal-account',
      nurse.specialty || null
    ]),
    removeTags: [],
    customFields: compactCustomFields([
      { key: 'primary_specialty', field_value: specialtyToGhl(nurse.specialty) },
      { key: 'nursing_license_state', field_value: nurse.license_state || '' },
      { key: 'whats_your_years_of_experience', field_value: yearsExperienceToGhl(nurse.years_experience) },
      { key: 'whats_your_shift_preference', field_value: shiftPreferenceToGhl(nurse.shift_preference) },
      { key: 'license_number', field_value: nurse.license_number || '' },
      { key: 'availability', field_value: availabilityToGhl(nurse.availability) },
      { key: 'certifications', field_value: Array.isArray(nurse.certifications) ? nurse.certifications : [] }
    ])
  }
}

// Writes one contact. When the profile already knows its GHL contact (from an
// earlier sync or from the GHL form that created the lead), that exact contact
// is updated; otherwise upsert matches or creates by email. Tags go through
// the additive tag endpoint so tags applied by GHL workflows are never wiped.
async function pushContact(existingContactId, { tags, removeTags, ...contact }) {
  let result = null

  if (existingContactId) {
    try {
      result = await updateContact(existingContactId, contact)
    } catch (error) {
      const status = error.response?.status
      if (status !== 400 && status !== 404 && status !== 422) throw error
      console.warn(`GHL contact ${existingContactId} could not be updated (${status}); falling back to upsert`)
    }
  }

  if (!result) {
    result = await upsertContact(contact)
  }

  if (!result.contactId) {
    throw new Error('GHL contact sync succeeded but no contact ID was returned')
  }

  try {
    await addContactTags(result.contactId, tags)
    if (removeTags?.length) await removeContactTags(result.contactId, removeTags)
  } catch (tagError) {
    console.error('GHL tag update failed:', tagError.response?.data || tagError.message)
  }

  return result
}

async function syncEmployerContactById(employerId) {
  const { data: employer, error } = await supabase
    .from('employer_profiles')
    .select('id, user_id, org_name, org_type, contact_name, contact_title, city, state, bed_count, onboarding_stage, contract_signed, ghl_contact_id, users!inner(email, full_name, phone)')
    .eq('id', employerId)
    .single()

  if (error || !employer) {
    throw new Error('Employer not found for GHL sync')
  }

  const result = await pushContact(employer.ghl_contact_id, buildEmployerContactPayload(employer))

  const syncedAt = new Date().toISOString()
  await supabase
    .from('employer_profiles')
    .update({
      ghl_contact_id: result.contactId,
      ghl_synced_at: syncedAt,
      updated_at: syncedAt
    })
    .eq('id', employer.id)

  return {
    employerId: employer.id,
    userId: employer.user_id,
    contactId: result.contactId,
    syncedAt,
    isNew: result.isNew
  }
}

async function syncNurseContactById(nurseId) {
  const { data: nurse, error } = await supabase
    .from('nurse_profiles')
    .select('id, user_id, first_name, last_name, specialty, license_number, license_state, years_experience, availability, shift_preference, certifications, ghl_contact_id, users!inner(email, full_name, phone)')
    .eq('id', nurseId)
    .single()

  if (error || !nurse) {
    throw new Error('Nurse not found for GHL sync')
  }

  const result = await pushContact(nurse.ghl_contact_id, buildNurseContactPayload(nurse))

  const syncedAt = new Date().toISOString()
  await supabase
    .from('nurse_profiles')
    .update({
      ghl_contact_id: result.contactId,
      ghl_synced_at: syncedAt,
      updated_at: syncedAt
    })
    .eq('id', nurse.id)

  return {
    nurseId: nurse.id,
    userId: nurse.user_id,
    contactId: result.contactId,
    syncedAt,
    isNew: result.isNew
  }
}

// Convenience for routes that know the user, not the profile row. Never
// throws: a GHL outage must not fail the portal action that triggered it.
async function syncContactForUser(userId, role) {
  try {
    const table = role === 'employer' ? 'employer_profiles' : 'nurse_profiles'
    const { data: profile } = await supabase
      .from(table)
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!profile?.id) return null
    return role === 'employer'
      ? await syncEmployerContactById(profile.id)
      : await syncNurseContactById(profile.id)
  } catch (error) {
    console.error(`GHL ${role} contact sync failed:`, error.response?.data || error.message)
    return null
  }
}

module.exports = {
  syncEmployerContactById,
  syncNurseContactById,
  syncContactForUser,
  buildEmployerContactPayload,
  buildNurseContactPayload
}
