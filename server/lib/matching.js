// Marketplace matching (Kundayi, 2026-10-06).
//
// Rate is a matching variable, not an automatic rejection: a nurse whose bill
// rate is above a hospital's maximum still appears, just lower down and marked
// "above budget" -- and higher up when the hospital says the need is urgent.
//
// Pure functions only, so the scoring is unit-tested without a database.

const URGENCY_LEVELS = ['standard', 'urgent', 'critical']

const FIT = {
  WITHIN_TARGET: 'within_target',
  WITHIN_MAX: 'within_max',
  ABOVE_MAX: 'above_max',
  NO_RATE: 'no_rate',
  NO_BUDGET: 'no_budget'
}

// Weights add up to 100. Rate compatibility is one input among several.
const WEIGHTS = {
  specialty: 30,
  rate: 20,
  location: 15,
  certifications: 10,
  availability: 10,
  experience: 10,
  urgency: 5
}

// Certification names the job's free-text requirements are scanned for.
const KNOWN_CERTIFICATIONS = [
  'BLS', 'ACLS', 'PALS', 'NRP', 'TNCC', 'CCRN', 'CEN', 'CNOR', 'NIHSS', 'AWHONN', 'STABLE'
]

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : null
}

function normalizeUrgency(value) {
  const raw = String(value || '').trim().toLowerCase()
  return URGENCY_LEVELS.includes(raw) ? raw : 'standard'
}

// A hospital may give a target, a maximum, or both. One alone serves as both.
function normalizeBudget(budget = {}) {
  let target = toNumber(budget.target_bill_rate ?? budget.target)
  let max = toNumber(budget.max_bill_rate ?? budget.max)
  if (target === null && max === null) return null
  if (target === null) target = max
  if (max === null) max = target
  if (target > max) [target, max] = [max, target]
  return { target, max }
}

function rateFit(billRate, budget) {
  const bill = toNumber(billRate)
  const normalized = normalizeBudget(budget || {})
  if (!normalized) return FIT.NO_BUDGET
  if (bill === null) return FIT.NO_RATE
  if (bill <= normalized.target) return FIT.WITHIN_TARGET
  if (bill <= normalized.max) return FIT.WITHIN_MAX
  return FIT.ABOVE_MAX
}

// Dollars per hour above the hospital's maximum, or 0.
function amountOverMax(billRate, budget) {
  const bill = toNumber(billRate)
  const normalized = normalizeBudget(budget || {})
  if (bill === null || !normalized) return 0
  return Math.max(0, Math.round((bill - normalized.max) * 100) / 100)
}

function rateScore(fit, urgency) {
  switch (fit) {
    case FIT.WITHIN_TARGET: return WEIGHTS.rate
    case FIT.WITHIN_MAX: return WEIGHTS.rate * 0.7
    // Above budget is still a candidate. Urgency is what makes it a good one.
    case FIT.ABOVE_MAX:
      return urgency === 'critical' ? WEIGHTS.rate * 0.5 : urgency === 'urgent' ? WEIGHTS.rate * 0.25 : 0
    case FIT.NO_RATE: return WEIGHTS.rate * 0.3
    default: return WEIGHTS.rate * 0.5 // no budget given: rate can't count for or against
  }
}

function certificationScore(nurseCerts, requirementsText) {
  const text = String(requirementsText || '').toUpperCase()
  const required = KNOWN_CERTIFICATIONS.filter((cert) => new RegExp(`\\b${cert}\\b`).test(text))
  if (required.length === 0) return WEIGHTS.certifications
  const held = new Set((nurseCerts || []).map((c) => String(c).toUpperCase()))
  const matched = required.filter((cert) => held.has(cert)).length
  return (WEIGHTS.certifications * matched) / required.length
}

// Scores one nurse against one staffing need. `job` may be a real job (with
// specialty, state, requirements) or just a typed-in budget, in which case
// the clinical criteria it doesn't specify score neutrally.
//
// Returns { score 0-100, fit, over_max_by, reasons[] }.
function scoreMatch({ nurse = {}, billRate = null, job = {}, budget = null, urgency }) {
  const level = normalizeUrgency(urgency ?? job.urgency)
  const fit = rateFit(billRate, budget)
  const reasons = []
  let score = 0

  if (job.specialty) {
    if (nurse.specialty && nurse.specialty === job.specialty) {
      score += WEIGHTS.specialty
      reasons.push('Specialty match')
    } else if (nurse.specialty === 'Float Pool') {
      score += WEIGHTS.specialty * 0.4
      reasons.push('Float pool nurse')
    }
  } else {
    score += WEIGHTS.specialty * 0.5
  }

  score += rateScore(fit, level)
  if (fit === FIT.WITHIN_TARGET) reasons.push('Within target rate')
  else if (fit === FIT.WITHIN_MAX) reasons.push('Within maximum rate')
  else if (fit === FIT.ABOVE_MAX) reasons.push('Above budget')

  if (job.state) {
    if (nurse.license_state && nurse.license_state === job.state) {
      score += WEIGHTS.location
      reasons.push(`Licensed in ${job.state}`)
    }
  } else {
    score += WEIGHTS.location * 0.5
  }

  score += certificationScore(nurse.certifications, job.requirements)

  if (!nurse.availability || nurse.availability === 'available') {
    score += WEIGHTS.availability
  }

  const years = Number.parseInt(nurse.years_experience, 10)
  if (Number.isFinite(years) && years > 0) {
    score += (WEIGHTS.experience * Math.min(years, 10)) / 10
  }

  // Urgent needs favour whoever can start: available nurses get the bonus.
  if (level !== 'standard' && (!nurse.availability || nurse.availability === 'available')) {
    score += level === 'critical' ? WEIGHTS.urgency : WEIGHTS.urgency * 0.6
  }

  return {
    score: Math.round(Math.min(score, 100)),
    fit,
    over_max_by: amountOverMax(billRate, budget),
    reasons
  }
}

// How the hospital's urgency decides what it sees first. Nobody is hidden;
// this only orders and groups.
//   standard -- within target first, then within max, above budget last
//   urgent   -- everyone within budget together by score, above budget last
//   critical -- everyone together by score
function groupForUrgency(fit, urgency) {
  const level = normalizeUrgency(urgency)
  if (fit === FIT.ABOVE_MAX) return level === 'critical' ? 'primary' : 'above_budget'
  if (level === 'standard' && fit === FIT.WITHIN_MAX) return 'secondary'
  return 'primary'
}

// The nurse dashboard's "market response": how the nurse's bill rate sits
// against open jobs. Counts only -- a hospital's actual budget is never shown
// to a nurse.
//   fits         -- bill rate within the job's maximum
//   urgent_above -- above the maximum, but the job is urgent or critical, so
//                   the hospital may consider it anyway
//   below        -- above the maximum on a standard-urgency job
function marketResponse(billRate, jobs = []) {
  const counts = { fits: 0, urgent_above: 0, below: 0, total: 0 }
  if (toNumber(billRate) === null) return counts

  for (const job of jobs) {
    const fit = rateFit(billRate, job.budget)
    if (fit === FIT.NO_BUDGET) continue
    counts.total += 1
    if (fit === FIT.WITHIN_TARGET || fit === FIT.WITHIN_MAX) counts.fits += 1
    else if (normalizeUrgency(job.urgency) !== 'standard') counts.urgent_above += 1
    else counts.below += 1
  }

  return counts
}

// Nurse-facing fit label for one job. Deliberately coarse: it says whether the
// nurse's desired pay fits, never by how much, so the job's budget can't be
// worked out from it.
function nurseFitLabel(billRate, job) {
  const fit = rateFit(billRate, job.budget)
  if (fit === FIT.WITHIN_TARGET || fit === FIT.WITHIN_MAX) return 'fits'
  if (fit === FIT.ABOVE_MAX) {
    return normalizeUrgency(job.urgency) === 'standard' ? 'above_budget' : 'may_consider'
  }
  return null
}

module.exports = {
  URGENCY_LEVELS,
  FIT,
  WEIGHTS,
  normalizeUrgency,
  normalizeBudget,
  rateFit,
  amountOverMax,
  scoreMatch,
  groupForUrgency,
  marketResponse,
  nurseFitLabel
}
