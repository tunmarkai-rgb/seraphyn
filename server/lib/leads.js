const { supabase } = require('../config/supabase')
const { upsertContact } = require('./ghl')
const { sendPortalEmail } = require('./mail')
const { ensureEmployerProfileRow, ensureNurseProfileRow } = require('./user-bootstrap')
const {
  toList,
  normalizeEmail,
  normalizeSpecialty,
  normalizeState,
  normalizeOrgType,
  normalizeYearsExperience,
  normalizeShiftPreference
} = require('./lead-normalize')

// GHL lead intake. A GHL funnel form submission lands here (via a GHL workflow
// webhook) and is kept in `leads` until the person creates a portal account.
// Lead data reaches a profile only once Supabase has confirmed the account's
// email -- that confirmation is the proof the signup belongs to the person who
// filled in the form.

const INVITE_COOLDOWN_MS = 24 * 60 * 60 * 1000

function flattenKey(key) {
  return String(key || '')
    .toLowerCase()
    .replace(/^contact\./, '')
    .replace(/[^a-z0-9]/g, '')
}

// A GHL workflow webhook puts standard contact fields at the top level, custom
// fields under their display name, and anything configured on the action under
// `customData`. Flatten every source into one case/punctuation-insensitive map
// so "Primary Specialty", "primary_specialty" and "contact.primary_specialty"
// all resolve to the same value.
function buildLookup(body = {}) {
  const lookup = new Map()
  const add = (key, value) => {
    const flat = flattenKey(key)
    if (!flat || value === undefined || value === null) return
    if (typeof value === 'string' && /^\{\{.*\}\}$/.test(value.trim())) return // unresolved merge field
    if (typeof value === 'object' && !Array.isArray(value)) return
    if (!lookup.has(flat) || lookup.get(flat) === '') lookup.set(flat, value)
  }

  const addObject = (object) => {
    if (!object || typeof object !== 'object') return
    for (const [key, value] of Object.entries(object)) add(key, value)
  }

  addObject(body.customData)
  addObject(body.custom_data)
  addObject(body)
  addObject(body.contact)

  const customFields = body.customFields || body.custom_fields || body.contact?.customFields
  if (Array.isArray(customFields)) {
    for (const field of customFields) add(field?.key || field?.fieldKey || field?.name || field?.id, field?.value ?? field?.field_value)
  } else {
    addObject(customFields)
  }

  return lookup
}

function pick(lookup, ...keys) {
  for (const key of keys) {
    const value = lookup.get(flattenKey(key))
    if (Array.isArray(value) ? value.length > 0 : value !== undefined && String(value).trim() !== '') {
      return value
    }
  }
  return ''
}

function text(value) {
  return Array.isArray(value) ? value.join(', ') : String(value ?? '').trim()
}

function parseGhlLeadPayload(body = {}) {
  const lookup = buildLookup(body)

  const email = normalizeEmail(pick(lookup, 'email', 'email_address'))
  const orgName = text(pick(lookup, 'organization_name', 'company_name', 'companyName'))

  const explicitRole = text(pick(lookup, 'role', 'lead_role', 'portal_role')).toLowerCase()
  const role = ['nurse', 'employer'].includes(explicitRole)
    ? explicitRole
    : orgName || pick(lookup, 'organization_type') ? 'employer' : 'nurse'

  let firstName = text(pick(lookup, 'first_name', 'firstName'))
  let lastName = text(pick(lookup, 'last_name', 'lastName'))
  if (!firstName && !lastName) {
    const [first = '', ...rest] = text(pick(lookup, 'full_name', 'name')).split(/\s+/)
    firstName = first
    lastName = rest.join(' ')
  }

  const lead = {
    email,
    role,
    source: role === 'employer' ? 'ghl-employer-form' : 'ghl-nurse-form',
    ghl_contact_id: text(pick(lookup, 'contact_id', 'ghl_contact_id', 'contactId')) || text(body.contact?.id) || null,
    ghl_opportunity_id: text(pick(lookup, 'opportunity_id', 'ghl_opportunity_id', 'opportunityId')) || null,
    first_name: firstName || null,
    last_name: lastName || null,
    phone: text(pick(lookup, 'phone', 'phone_number')) || null
  }

  if (role === 'nurse') {
    Object.assign(lead, {
      license_state: normalizeState(pick(lookup, 'nursing_license_state', 'license_state', 'licenseState', 'state')) || null,
      specialty: normalizeSpecialty(text(pick(lookup, 'primary_specialty', 'specialty'))) || null,
      years_experience: normalizeYearsExperience(text(pick(lookup, 'whats_your_years_of_experience', 'years_of_experience', 'years_experience', 'yearsExperience'))),
      shift_preference: normalizeShiftPreference(
        toList(pick(lookup, 'whats_your_shift_preference', 'shift_preferences', 'shift_preference', 'shiftPreference')),
        null
      )
    })
  } else {
    Object.assign(lead, {
      org_name: orgName || null,
      org_type: normalizeOrgType(text(pick(lookup, 'organization_type', 'org_type'))) || null,
      state: normalizeState(pick(lookup, 'organization_state', 'state')) || null,
      looking_for: text(pick(lookup, 'what_are_you_looking_for', 'looking_for')) || null,
      nurses_needed_per_month: text(pick(lookup, 'nurses_needed_per_month')) || null
    })
  }

  return lead
}

// Consulting-only employer enquiries belong to the consulting pipeline, not the
// staffing portal, so they are stored but not invited.
function wantsPortalAccount(lead) {
  if (lead.role !== 'employer') return true
  return !/^consulting/i.test(String(lead.looking_for || '').trim())
}

function getPortalBaseUrl() {
  return (process.env.CLIENT_URL || process.env.VITE_APP_URL || 'https://staffing.seraphyncare.com').replace(/\/+$/, '')
}

function buildSignupUrl(lead) {
  const params = new URLSearchParams({ role: lead.role, email: lead.email })
  return `${getPortalBaseUrl()}/signup?${params.toString()}`
}

async function upsertLead(lead, raw = {}) {
  const { data: existing, error: existingError } = await supabase
    .from('leads')
    .select('*')
    .eq('email', lead.email)
    .maybeSingle()

  if (existingError) throw existingError

  // A re-submission refreshes the answers but never blanks one that the new
  // payload left out.
  const patch = {}
  for (const [key, value] of Object.entries(lead)) {
    if (value !== null && value !== undefined && value !== '') patch[key] = value
  }

  const now = new Date().toISOString()
  const payload = {
    ...(existing || {}),
    ...patch,
    raw,
    updated_at: now
  }
  if (!existing) payload.created_at = now

  const { data, error } = await supabase
    .from('leads')
    .upsert(payload, { onConflict: 'email' })
    .select('*')
    .single()

  if (error) throw error
  return data
}

async function findPublicUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('id, role, email, phone')
    // ilike for case-insensitivity; escape its wildcards, since "_" is common in emails
    .ilike('email', email.replace(/[\\%_]/g, (char) => `\\${char}`))
    .maybeSingle()

  if (error) throw error
  return data || null
}

function nurseSeedFromLead(lead) {
  return {
    first_name: lead.first_name || undefined,
    last_name: lead.last_name || undefined,
    specialty: lead.specialty || undefined,
    license_state: lead.license_state || undefined,
    years_experience: lead.years_experience ?? undefined,
    shift_preference: lead.shift_preference || undefined,
    ghl_contact_id: lead.ghl_contact_id || undefined
  }
}

function employerSeedFromLead(lead) {
  const contactName = [lead.first_name, lead.last_name].filter(Boolean).join(' ')
  return {
    org_name: lead.org_name || undefined,
    org_type: lead.org_type || undefined,
    state: lead.state || undefined,
    contact_name: contactName || undefined,
    ghl_contact_id: lead.ghl_contact_id || undefined
  }
}

// Fill-only: nothing the user has already entered on the portal is replaced.
async function applyLeadToUser(lead, userId, role) {
  if (role === 'employer') {
    await ensureEmployerProfileRow(userId, employerSeedFromLead(lead), { fillEmptyOnly: true })
  } else {
    await ensureNurseProfileRow(userId, nurseSeedFromLead(lead), { fillEmptyOnly: true })
  }

  if (lead.phone) {
    await supabase
      .from('users')
      .update({ phone: lead.phone, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .is('phone', null)
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('leads')
    .update({ claimed_by: userId, claimed_at: now, updated_at: now })
    .eq('id', lead.id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

function isMissingLeadsTable(error) {
  return /relation .*leads.* does not exist|Could not find the table 'public\.leads'/i.test(error?.message || '')
}

// Called once a signed-in user's session is known. Applies an unclaimed lead
// with the same (confirmed) email and matching role. Never throws.
async function claimLeadForAuthUser(authUser, role) {
  try {
    const email = normalizeEmail(authUser?.email)
    if (!authUser?.id || !email || !authUser.email_confirmed_at) return null

    const { data: lead, error } = await supabase
      .from('leads')
      .select('*')
      .eq('email', email)
      .is('claimed_by', null)
      .maybeSingle()

    if (error) throw error
    if (!lead || lead.role !== role) return null

    return await applyLeadToUser(lead, authUser.id, role)
  } catch (error) {
    if (!isMissingLeadsTable(error)) {
      console.error('Lead claim failed:', error.message)
    }
    return null
  }
}

// True when this user's profile was seeded from a GHL lead -- drives the
// "we've filled in what you told us" banner.
async function hasClaimedLead(userId) {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('id')
      .eq('claimed_by', userId)
      .limit(1)
    if (error) throw error
    return (data || []).length > 0
  } catch (error) {
    if (!isMissingLeadsTable(error)) console.error('Lead lookup failed:', error.message)
    return false
  }
}

function buildInviteEmail(lead, signupUrl) {
  const name = lead.first_name || 'there'
  const intro = lead.role === 'employer'
    ? `Thanks for telling us about ${lead.org_name || 'your organization'}. We've saved your details, so setting up your staffing portal account only takes a minute.`
    : "Thanks for applying to Seraphyn Care. We've saved your details, so creating your portal account only takes a minute."

  const text = [
    `Hi ${name},`,
    '',
    intro,
    'Create your login with this email address and your profile will be waiting for you:',
    signupUrl,
    '',
    'Seraphyn Care Solutions'
  ].join('\n')

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1F3145; max-width: 560px;">
      <p>Hi ${escapeHtml(name)},</p>
      <p>${escapeHtml(intro)}</p>
      <p>Create your login with this email address and your profile will be waiting for you.</p>
      <p style="margin: 28px 0;">
        <a href="${signupUrl}" style="background: #1F3145; color: #ffffff; padding: 12px 22px; text-decoration: none; border-radius: 2px;">Finish creating your account</a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">Or paste this link into your browser:<br/>${signupUrl}</p>
      <p>Seraphyn Care Solutions</p>
    </div>`

  return { text, html }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function sendLeadInvite(lead, signupUrl) {
  const sentRecently = lead.invite_sent_at && Date.now() - new Date(lead.invite_sent_at).getTime() < INVITE_COOLDOWN_MS
  if (sentRecently) return { skipped: true, reason: 'Invite sent within the last 24 hours' }

  const { text, html } = buildInviteEmail(lead, signupUrl)
  const result = await sendPortalEmail({
    to: lead.email,
    subject: 'Finish creating your Seraphyn account',
    text,
    html
  })

  if (result.success) {
    await supabase
      .from('leads')
      .update({ invite_sent_at: new Date().toISOString() })
      .eq('id', lead.id)
  }

  return result
}

// Lets GHL SMS/email sequences reuse the same link. Best effort.
async function writeSignupUrlToGhl(lead, signupUrl) {
  try {
    const result = await upsertContact({
      email: lead.email,
      customFields: [{ key: 'portal_signup_url', field_value: signupUrl }]
    })
    return result.contactId
  } catch (error) {
    console.error('Failed to write portal_signup_url to GHL:', error.response?.data || error.message)
    return null
  }
}

async function getConfirmedAuthUser(userId) {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data?.user) return null
  return data.user.email_confirmed_at ? data.user : null
}

// Entry point for POST /api/leads/ghl.
async function ingestGhlLead(body = {}) {
  const parsed = parseGhlLeadPayload(body)
  if (!parsed.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.email)) {
    const error = new Error('A valid email is required')
    error.status = 400
    throw error
  }

  const lead = await upsertLead(parsed, body)
  const signupUrl = buildSignupUrl(lead)

  // Already has a portal account: fill any gaps now if that account's email is
  // confirmed. An unconfirmed account is left alone -- it claims the lead when
  // it confirms, which proves it belongs to the person who filled in the form.
  const existingUser = await findPublicUserByEmail(lead.email)
  if (existingUser) {
    const sameOwner = !lead.claimed_by || lead.claimed_by === existingUser.id
    const confirmed = existingUser.role === lead.role && sameOwner
      ? await getConfirmedAuthUser(existingUser.id)
      : null
    if (confirmed) {
      await applyLeadToUser(lead, existingUser.id, lead.role)
    }
    return { lead, signupUrl, status: confirmed ? 'merged' : 'existing-account' }
  }

  if (!wantsPortalAccount(lead)) {
    return { lead, signupUrl: null, status: 'stored' }
  }

  await writeSignupUrlToGhl(lead, signupUrl)
  const invite = await sendLeadInvite(lead, signupUrl)
  return { lead, signupUrl, status: invite.success ? 'invited' : 'stored', invite }
}

module.exports = {
  parseGhlLeadPayload,
  wantsPortalAccount,
  buildSignupUrl,
  ingestGhlLead,
  claimLeadForAuthUser,
  hasClaimedLead
}
