const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const assert = require('node:assert/strict')

// Stub Supabase so payload parsing and value mapping can be tested without env
// vars or a network call.
const originalLoad = Module._load
Module._load = function loadWithStubs(request, parent, isMain) {
  if (request === '../config/supabase') {
    return { supabase: {} }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const { parseGhlLeadPayload, wantsPortalAccount, buildSignupUrl } = require(path.resolve(__dirname, '../lib/leads'))
const normalize = require(path.resolve(__dirname, '../lib/lead-normalize'))
const { buildNurseContactPayload, buildEmployerContactPayload } = require(path.resolve(__dirname, '../lib/ghl-sync'))
Module._load = originalLoad

test('parses a GHL nurse form webhook with custom fields under display names', () => {
  const lead = parseGhlLeadPayload({
    contact_id: 'abc123',
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'Ada@Example.com ',
    phone: '+15555550100',
    'Nursing License State': 'California',
    'Primary Specialty': 'Med-Surg',
    "What's your years of experience": '6-10',
    "What's your Shift Preference": 'Per Diem',
    customData: { role: 'nurse' }
  })

  assert.equal(lead.role, 'nurse')
  assert.equal(lead.email, 'ada@example.com')
  assert.equal(lead.ghl_contact_id, 'abc123')
  assert.equal(lead.license_state, 'CA')
  assert.equal(lead.specialty, 'Medical-Surgical')
  assert.equal(lead.years_experience, 6)
  assert.equal(lead.shift_preference, 'per_diem')
  assert.equal(lead.phone, '+15555550100')
})

test('parses merge-field keys from customData and collapses several shifts to any', () => {
  const lead = parseGhlLeadPayload({
    customData: {
      role: 'nurse',
      email: 'n@example.com',
      'contact.primary_specialty': 'ICU',
      'contact.whats_your_shift_preference': 'Per Diem, Permanent',
      'contact.nursing_license_state': 'tx'
    }
  })

  assert.equal(lead.specialty, 'ICU / Critical Care')
  assert.equal(lead.shift_preference, 'any')
  assert.equal(lead.license_state, 'TX')
})

test('ignores unresolved GHL merge fields', () => {
  const lead = parseGhlLeadPayload({
    email: 'n@example.com',
    customData: { role: 'nurse', specialty: '{{contact.primary_specialty}}' }
  })
  assert.equal(lead.specialty, null)
})

test('parses an employer form and infers the role from the organization', () => {
  const lead = parseGhlLeadPayload({
    email: 'ops@hospital.org',
    full_name: 'Grace Hopper',
    organization_name: 'Mercy General',
    organization_type: 'Long-Term Care',
    organization_state: 'New York',
    what_are_you_looking_for: 'Both',
    nurses_needed_per_month: '6–15'
  })

  assert.equal(lead.role, 'employer')
  assert.equal(lead.first_name, 'Grace')
  assert.equal(lead.last_name, 'Hopper')
  assert.equal(lead.org_name, 'Mercy General')
  assert.equal(lead.org_type, 'Long-Term Care Facility')
  assert.equal(lead.state, 'NY')
  assert.equal(wantsPortalAccount(lead), true)
})

test('consulting-only employer enquiries are not invited to the portal', () => {
  const lead = parseGhlLeadPayload({
    email: 'ceo@clinic.org',
    organization_name: 'Clinic',
    what_are_you_looking_for: 'Consulting Services'
  })
  assert.equal(wantsPortalAccount(lead), false)
})

test('signup URL carries role and email', () => {
  process.env.CLIENT_URL = 'https://staffing.example.com/'
  assert.equal(
    buildSignupUrl({ role: 'nurse', email: 'a+b@example.com' }),
    'https://staffing.example.com/signup?role=nurse&email=a%2Bb%40example.com'
  )
})

test('shift preference and availability map to the live Postgres enums', () => {
  assert.equal(normalize.normalizeShiftPreference('Contract Travel'), 'contract_travel')
  assert.equal(normalize.normalizeShiftPreference(['Per Diem', 'Contract Travel']), 'any')
  assert.equal(normalize.normalizeShiftPreference('Day', null), null)
  assert.equal(normalize.normalizeAvailability('2 Weeks'), 'available')
  assert.equal(normalize.normalizeAvailability('Not Available'), 'unavailable')
  assert.equal(normalize.normalizeAvailability('placed'), 'placed')
})

test('years of experience round-trips through the GHL bands', () => {
  for (const band of ['1-2', '3-5', '6-10', '11-15', '15+']) {
    assert.equal(normalize.yearsExperienceToGhl(normalize.normalizeYearsExperience(band)), band)
  }
})

test('nurse contact payload writes the GHL form field keys', () => {
  const payload = buildNurseContactPayload({
    first_name: 'Ada',
    last_name: 'Lovelace',
    specialty: 'Operating Room',
    license_state: 'CA',
    years_experience: '3',
    shift_preference: 'any',
    availability: 'available',
    certifications: ['BLS'],
    users: { email: 'ada@example.com', phone: '+15555550100' }
  })

  const fields = Object.fromEntries(payload.customFields.map((field) => [field.key, field.field_value]))
  assert.equal(fields.primary_specialty, 'OR')
  assert.equal(fields.nursing_license_state, 'CA')
  assert.equal(fields.whats_your_years_of_experience, '3-5')
  assert.equal(fields.whats_your_shift_preference, undefined, '"any" is the default, not a choice')
  assert.equal(fields.availability, 'Immediate')
  assert.equal(payload.phone, '+15555550100')
  assert.ok(payload.tags.includes('portal-account'))
  assert.ok(payload.tags.includes('nurse-portal-registered'))
  assert.ok(!payload.tags.includes('nurse-lead'), 'nurse-lead would restart the GHL nurture sequence')
})

test('employer contact payload writes the GHL form field keys', () => {
  const payload = buildEmployerContactPayload({
    org_name: 'Mercy General',
    org_type: 'Rehabilitation Center',
    state: 'NY',
    contact_name: 'Grace Hopper',
    onboarding_stage: 'contract',
    contract_signed: true,
    users: { email: 'ops@hospital.org' }
  })

  const fields = Object.fromEntries(payload.customFields.map((field) => [field.key, field.field_value]))
  assert.equal(fields.organization_name, 'Mercy General')
  assert.equal(fields.organization_type, 'Rehab Center')
  assert.equal(fields.organization_state, 'NY')
  assert.equal(fields.portal_onboarding_stage, 'contract')
  assert.deepEqual(payload.removeTags, ['contract-pending'])
})
