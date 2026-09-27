// Value mapping between the GHL funnel forms and the portal's columns. The GHL
// option labels below are copied from the live location's custom fields
// (GET /locations/:id/customFields) -- a label GHL does not recognise is
// silently dropped on a contact write, so keep these in step with GHL.

const PORTAL_SPECIALTIES = [
  'ICU / Critical Care', 'Emergency Department', 'Operating Room', 'Pediatrics',
  'NICU', 'Telemetry', 'Medical-Surgical', 'Labor & Delivery', 'Psychiatric',
  'Oncology', 'Step-Down / PCU', 'Float Pool', 'Home Health', 'Long-Term Care', 'Other'
]

// GHL `primary_specialty` (plus the older `specialty` field's labels) -> portal.
const GHL_SPECIALTY_TO_PORTAL = {
  icu: 'ICU / Critical Care',
  er: 'Emergency Department',
  or: 'Operating Room',
  pediatrics: 'Pediatrics',
  nicu: 'NICU',
  telemetry: 'Telemetry',
  'med-surg': 'Medical-Surgical',
  'l&d': 'Labor & Delivery',
  ob: 'Labor & Delivery',
  pacu: 'Operating Room',
  other: 'Other'
}

// Portal -> the GHL `primary_specialty` single-option labels.
const PORTAL_SPECIALTY_TO_GHL = {
  'ICU / Critical Care': 'ICU',
  'Emergency Department': 'ER',
  'Operating Room': 'OR',
  Pediatrics: 'Pediatrics',
  NICU: 'NICU',
  Telemetry: 'Telemetry',
  'Medical-Surgical': 'Med-Surg',
  'Labor & Delivery': 'L&D'
}

const PORTAL_ORG_TYPES = [
  'Hospital', 'Urgent Care', 'Outpatient Clinic', 'Long-Term Care Facility',
  'Home Health Agency', 'Rehabilitation Center', 'Surgical Center',
  'Behavioral Health', 'School Health', 'Other'
]

const GHL_ORG_TYPE_TO_PORTAL = {
  hospital: 'Hospital',
  'long-term care': 'Long-Term Care Facility',
  'rehab center': 'Rehabilitation Center',
  'outpatient clinic': 'Outpatient Clinic',
  other: 'Other'
}

const PORTAL_ORG_TYPE_TO_GHL = {
  Hospital: 'Hospital',
  'Long-Term Care Facility': 'Long-Term Care',
  'Rehabilitation Center': 'Rehab Center',
  'Outpatient Clinic': 'Outpatient Clinic'
}

const US_STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia'
}

const STATE_NAME_TO_CODE = Object.fromEntries(
  Object.entries(US_STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code])
)

// Live Postgres enums: public.shift_preference and public.nurse_availability.
const SHIFT_PREFERENCE_VALUES = ['per_diem', 'contract_travel', 'permanent', 'any']
const AVAILABILITY_VALUES = ['available', 'placed', 'unavailable']

const SHIFT_LABEL_TO_VALUE = {
  'per diem': 'per_diem',
  per_diem: 'per_diem',
  'contract travel': 'contract_travel',
  contract_travel: 'contract_travel',
  permanent: 'permanent',
  any: 'any'
}

const SHIFT_VALUE_TO_GHL = {
  per_diem: 'Per Diem',
  contract_travel: 'Contract Travel',
  permanent: 'Permanent'
}

function clean(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function lower(value) {
  return clean(value).toLowerCase()
}

// GHL sends checkbox answers as an array, a comma-joined string, or a JSON
// array string depending on where the value came from.
function toList(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean)
  const raw = clean(value)
  if (!raw) return []
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean)
    } catch {
      // fall through to comma splitting
    }
  }
  return raw.split(',').map(clean).filter(Boolean)
}

function normalizeSpecialty(value) {
  const raw = clean(value)
  if (!raw) return ''
  const exact = PORTAL_SPECIALTIES.find((option) => option.toLowerCase() === raw.toLowerCase())
  if (exact) return exact
  return GHL_SPECIALTY_TO_PORTAL[raw.toLowerCase()] || 'Other'
}

function specialtyToGhl(value) {
  const raw = clean(value)
  if (!raw) return ''
  return PORTAL_SPECIALTY_TO_GHL[raw] || 'Other'
}

function normalizeState(value) {
  const raw = clean(value)
  if (!raw) return ''
  const upper = raw.toUpperCase()
  if (US_STATE_NAMES[upper]) return upper
  return STATE_NAME_TO_CODE[raw.toLowerCase().replace(/\s+/g, ' ')] || ''
}

function normalizeOrgType(value) {
  const raw = clean(value)
  if (!raw) return ''
  const exact = PORTAL_ORG_TYPES.find((option) => option.toLowerCase() === raw.toLowerCase())
  if (exact) return exact
  return GHL_ORG_TYPE_TO_PORTAL[raw.toLowerCase()] || 'Other'
}

function orgTypeToGhl(value) {
  const raw = clean(value)
  if (!raw) return ''
  return PORTAL_ORG_TYPE_TO_GHL[raw] || 'Other'
}

// GHL bands ("1-2", "3-5", "6-10", "11-15", "15+") and older portal bands
// ("10-15 years") -> the lower bound, which is what the portal stores.
function normalizeYearsExperience(value) {
  const raw = clean(value)
  if (!raw) return null
  const match = raw.match(/\d+/)
  if (!match) return null
  const years = Number.parseInt(match[0], 10)
  return Number.isFinite(years) && years >= 0 && years <= 60 ? years : null
}

function yearsExperienceToGhl(value) {
  const years = Number.parseInt(clean(value), 10)
  if (!Number.isFinite(years)) return ''
  if (years <= 2) return '1-2'
  if (years <= 5) return '3-5'
  if (years <= 10) return '6-10'
  if (years < 15) return '11-15'
  return '15+'
}

// One choice maps to that value; several (or none recognised) means "any".
function normalizeShiftPreference(value, fallback = null) {
  const values = [...new Set(toList(value).map((item) => SHIFT_LABEL_TO_VALUE[item.toLowerCase()]).filter(Boolean))]
  if (values.length === 0) return fallback
  if (values.length === 1) return values[0]
  return 'any'
}

function shiftPreferenceToGhl(value) {
  const label = SHIFT_VALUE_TO_GHL[clean(value)]
  return label ? [label] : []
}

function normalizeAvailability(value, fallback = null) {
  const raw = lower(value)
  if (!raw) return fallback
  if (AVAILABILITY_VALUES.includes(raw)) return raw
  if (['immediate', 'immediately', 'available now', '2 weeks', '30 days', '1 month'].includes(raw)) return 'available'
  if (raw === 'not available') return 'unavailable'
  return fallback
}

function availabilityToGhl(value) {
  if (value === 'available') return 'Immediate'
  if (value === 'unavailable' || value === 'placed') return 'Not Available'
  return ''
}

function normalizeEmail(value) {
  return lower(value)
}

module.exports = {
  PORTAL_SPECIALTIES,
  PORTAL_ORG_TYPES,
  SHIFT_PREFERENCE_VALUES,
  AVAILABILITY_VALUES,
  toList,
  normalizeEmail,
  normalizeSpecialty,
  specialtyToGhl,
  normalizeState,
  normalizeOrgType,
  orgTypeToGhl,
  normalizeYearsExperience,
  yearsExperienceToGhl,
  normalizeShiftPreference,
  shiftPreferenceToGhl,
  normalizeAvailability,
  availabilityToGhl
}
