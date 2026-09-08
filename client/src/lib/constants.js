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

export const NURSE_SHIFT_PREFERENCES = [
  'Per Diem',
  'Contract Travel',
  'Permanent'
]

export const NURSE_AVAILABILITY_OPTIONS = [
  'Immediate',
  '2 Weeks',
  '30 Days',
  'Not Available'
]

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
