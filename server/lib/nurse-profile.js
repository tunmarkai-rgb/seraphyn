const REQUIRED_PROFILE_FIELDS = [
  'first_name',
  'last_name',
  'specialty',
  'license_number',
  'license_state',
  'years_experience',
  'availability',
  'shift_preference',
  'bio',
  'resume_url',
  'license_url'
]

function hasValue(value) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

function evaluateNurseProfileCompletion(profile = {}) {
  const completedFields = REQUIRED_PROFILE_FIELDS.filter((field) => hasValue(profile[field]))
  const missingFields = REQUIRED_PROFILE_FIELDS.filter((field) => !completedFields.includes(field))
  const percent = Math.round((completedFields.length / REQUIRED_PROFILE_FIELDS.length) * 100)

  return {
    percent,
    isComplete: missingFields.length === 0,
    completedFields,
    missingFields,
    requiredFields: [...REQUIRED_PROFILE_FIELDS]
  }
}

module.exports = {
  REQUIRED_PROFILE_FIELDS,
  evaluateNurseProfileCompletion
}
