// Checks that every GHL custom-field key the portal writes exists on the live
// location. GHL silently drops a write to an unknown key, so a typo here means
// data quietly never arrives.
//
//   node scripts/ghl-custom-fields.js           report only
//   node scripts/ghl-custom-fields.js --create  also create the portal-owned fields
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true })
const { getCustomFields, createCustomField } = require('../lib/ghl')

// Keys the portal writes. Portal-owned fields may be created by this script;
// form fields must already exist because the GHL forms define them.
const REQUIRED = [
  { key: 'primary_specialty', form: true },
  { key: 'nursing_license_state', form: true },
  { key: 'whats_your_years_of_experience', form: true },
  { key: 'whats_your_shift_preference', form: true },
  { key: 'organization_name', form: true },
  { key: 'organization_type', form: true },
  { key: 'organization_state', form: true },
  { key: 'license_number' },
  { key: 'availability' },
  { key: 'certifications' },
  { key: 'decision_maker_role' },
  { key: 'bed_size' },
  { key: 'portal_onboarding_stage', create: { name: 'Portal Onboarding Stage', dataType: 'TEXT' } },
  { key: 'portal_signup_url', create: { name: 'Portal Signup URL', dataType: 'TEXT' } }
]

async function main() {
  const shouldCreate = process.argv.includes('--create')
  const fields = await getCustomFields()
  const existing = new Set(fields.map((field) => String(field.fieldKey || '').replace(/^contact\./, '')))

  let missing = 0
  for (const field of REQUIRED) {
    if (existing.has(field.key)) {
      console.log(`ok       ${field.key}`)
      continue
    }

    if (shouldCreate && field.create) {
      const created = await createCustomField(field.create)
      console.log(`created  ${field.key} -> ${created?.fieldKey || '(check GHL for the generated key)'}`)
      continue
    }

    missing += 1
    console.log(`MISSING  ${field.key}${field.form ? '  (defined by a GHL form -- check the form)' : field.create ? '  (run with --create)' : ''}`)
  }

  process.exitCode = missing ? 1 : 0
}

main().catch((error) => {
  console.error(error.response?.data || error.message)
  process.exitCode = 1
})
