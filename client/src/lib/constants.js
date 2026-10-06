export const SPECIALTIES = [
  'ICU / Critical Care',
  'Emergency Department',
  'Operating Room',
  'Pediatrics',
  'NICU',
  'Telemetry',
  'Medical-Surgical',
  'Labor & Delivery',
  'Psychiatric',
  'Oncology',
  'Step-Down / PCU',
  'Float Pool',
  'Home Health',
  'Long-Term Care',
  'Other',
]

// Values are the live Postgres enums (public.shift_preference and
// public.nurse_availability); labels are what people see.
export const NURSE_SHIFT_PREFERENCES = [
  { value: 'per_diem', label: 'Per Diem' },
  { value: 'contract_travel', label: 'Contract Travel' },
  { value: 'permanent', label: 'Permanent' },
  { value: 'any', label: 'Open to Any' }
]

export const NURSE_AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Not Available' }
]

const PLACED_AVAILABILITY = { value: 'placed', label: 'Placed' }

export function shiftPreferenceLabel(value) {
  return NURSE_SHIFT_PREFERENCES.find((option) => option.value === value)?.label || value || ''
}

export function availabilityLabel(value) {
  return [...NURSE_AVAILABILITY_OPTIONS, PLACED_AVAILABILITY].find((option) => option.value === value)?.label || value || ''
}

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

export const SHIFT_TYPE_OPTIONS = [
  { value: 'day', label: 'Day Shift' },
  { value: 'night', label: 'Night Shift' },
  { value: 'evening', label: 'Evening Shift' },
  { value: 'mixed', label: 'Mixed Shifts' }
]

// Employer-facing labels for nurse requests. Deliberately coarser than the
// internal status: employers must not learn whether the nurse has been asked
// yet, because that becomes "why hasn't she answered". The server sends only
// these labels; this map exists so the two employer screens cannot drift.
export const NURSE_REQUEST_STATUS_LABELS = [
  'In Review',
  'Confirming Availability',
  'Placed',
  'Not Available',
  'Withdrawn'
]

// How urgently a hospital needs a role filled. Drives how the nurse directory
// groups candidates against the job's budget (server/lib/matching.js).
export const URGENCY_OPTIONS = [
  { value: 'standard', label: 'Standard', help: "We'll prioritize nurses within your preferred rate." },
  { value: 'urgent', label: 'Urgent', help: "We'll expand the matching pool to everyone within your maximum." },
  { value: 'critical', label: 'Critical', help: 'Show qualified nurses above our preferred rate too.' }
]

export function urgencyLabel(value) {
  return URGENCY_OPTIONS.find((option) => option.value === value)?.label || 'Standard'
}
