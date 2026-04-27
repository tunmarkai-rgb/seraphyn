const { supabase } = require('../config/supabase')
const { upsertContact } = require('./ghl')

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
      'staffing-lead',
      'portal-employer',
      employer.contract_signed ? 'contract-signed' : 'contract-pending'
    ]),
    customFields: compactCustomFields([
      { key: 'facility_name', field_value: employer.org_name || '' },
      { key: 'organization_type', field_value: employer.org_type || '' },
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
      'nurse-lead',
      'portal-nurse',
      nurse.specialty || null
    ]),
    customFields: compactCustomFields([
      { key: 'specialty', field_value: nurse.specialty || '' },
      { key: 'years_of_experience', field_value: nurse.years_experience ? String(nurse.years_experience) : '' },
      { key: 'license_number', field_value: nurse.license_number || '' },
      { key: 'preferred_location', field_value: nurse.license_state || '' },
      { key: 'availability', field_value: nurse.availability || '' },
      { key: 'shift_preference', field_value: nurse.shift_preference || '' },
      { key: 'certifications', field_value: Array.isArray(nurse.certifications) ? nurse.certifications : [] }
    ])
  }
}

async function syncEmployerContactById(employerId) {
  const { data: employer, error } = await supabase
    .from('employer_profiles')
    .select('id, user_id, org_name, org_type, contact_name, contact_title, city, state, bed_count, onboarding_stage, contract_signed, users!inner(email, full_name, phone)')
    .eq('id', employerId)
    .single()

  if (error || !employer) {
    throw new Error('Employer not found for GHL sync')
  }

  const result = await upsertContact(buildEmployerContactPayload(employer))
  if (!result.contactId) {
    throw new Error('GHL contact sync succeeded but no contact ID was returned')
  }

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
    .select('id, user_id, first_name, last_name, specialty, license_number, license_state, years_experience, availability, shift_preference, certifications, users!inner(email, full_name, phone)')
    .eq('id', nurseId)
    .single()

  if (error || !nurse) {
    throw new Error('Nurse not found for GHL sync')
  }

  const result = await upsertContact(buildNurseContactPayload(nurse))
  if (!result.contactId) {
    throw new Error('GHL contact sync succeeded but no contact ID was returned')
  }

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

module.exports = {
  syncEmployerContactById,
  syncNurseContactById,
  buildEmployerContactPayload,
  buildNurseContactPayload
}
