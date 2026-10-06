// Transparent marketplace pricing (Kundayi, 2026-10-06):
//
//   nurse's desired pay + flat Seraphyn agency fee = hospital bill rate
//
// The fee and the split are public by design: hospitals see nurse pay, fee and
// bill rate; nurses see the bill rate their pay produces. What stays private is
// a hospital's own budget per job (job_budgets), which nurses only ever see as
// a fit label -- see server/lib/matching.js and docs/MARKETPLACE_PRICING.sql.
//
// Still admin-only: the audit trail (rate history, who overrode what and why)
// and raw nurse_rates rows. Routes return the shapes below, never a raw row.
//
// Scope is per-diem / contract hourly. Direct hire uses the separate
// placement-fee model described in the signed agreements.

const { supabase } = require('../config/supabase')

const SETTINGS_KEY = 'per_diem_billing'
const CACHE_TTL_MS = 60 * 1000

const FALLBACK_BOUNDS = { min_nurse_rate: 15, max_nurse_rate: 400 }
// Used only until docs/MARKETPLACE_PRICING.sql has added agency_fee to the
// settings row, so a deploy that lands first still prices at Kundayi's $17.
const DEFAULT_AGENCY_FEE = 17

let cache = { value: null, fetchedAt: 0 }

function invalidateBillingSettingsCache() {
  cache = { value: null, fetchedAt: 0 }
}

async function getBillingSettings() {
  if (cache.value && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.value
  }

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .single()

  if (error || !data?.value) {
    // Fail closed: without the settings row there is no agreed fee, and a bill
    // rate quoted without one would undercharge every placement.
    throw new Error(
      `Billing settings row "${SETTINGS_KEY}" is missing; refusing to compute a bill rate`
    )
  }

  const value = { agency_fee: DEFAULT_AGENCY_FEE, ...data.value }
  cache = { value, fetchedAt: Date.now() }
  return value
}

function validateBillingSettings(input) {
  const errors = []
  const fee = Number(input?.agency_fee)
  const min = Number(input?.min_nurse_rate)
  const max = Number(input?.max_nurse_rate)

  if (!Number.isFinite(fee) || fee <= 0 || fee > 500) {
    errors.push('agency_fee must be a dollar amount greater than 0 and no more than 500')
  }
  if (!Number.isFinite(min) || min <= 0) {
    errors.push('min_nurse_rate must be a number greater than 0')
  }
  if (!Number.isFinite(max) || max <= 0) {
    errors.push('max_nurse_rate must be a number greater than 0')
  }
  if (Number.isFinite(min) && Number.isFinite(max) && min >= max) {
    errors.push('min_nurse_rate must be less than max_nurse_rate')
  }

  if (errors.length) return { valid: false, errors }

  return {
    valid: true,
    errors: [],
    value: {
      agency_fee: round2(fee),
      min_nurse_rate: round2(min),
      max_nurse_rate: round2(max)
    }
  }
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100
}

// The admin override wins over whatever the nurse asked for.
function effectiveNurseRate(rateRow) {
  if (!rateRow) return null
  const rate = rateRow.admin_hourly ?? rateRow.desired_hourly
  return rate === null || rate === undefined ? null : Number(rate)
}

function resolveAgencyFee(settings) {
  const fee = Number(settings?.agency_fee ?? DEFAULT_AGENCY_FEE)
  if (!Number.isFinite(fee) || fee <= 0) {
    throw new Error('per_diem_billing.agency_fee must be greater than zero')
  }
  return round2(fee)
}

// Flat fee, no rounding: $65 desired pay + $17 = $82, exactly as quoted to the
// nurse on their profile.
function computeBillRate(rateRow, settings) {
  const rate = effectiveNurseRate(rateRow)
  if (rate === null) return null
  return round2(rate + resolveAgencyFee(settings))
}

// --- Response shapes -------------------------------------------------------

// The public breakdown, shown to hospitals on every nurse.
function rateBreakdown(rateRow, settings) {
  const nursePay = effectiveNurseRate(rateRow)
  const fee = resolveAgencyFee(settings)
  return {
    has_rate: nursePay !== null,
    nurse_pay: nursePay,
    agency_fee: fee,
    bill_rate: nursePay === null ? null : round2(nursePay + fee)
  }
}

// Employer-facing.
function employerRateShape(rateRow, settings) {
  return rateBreakdown(rateRow, settings)
}

// Admin-facing: the breakdown plus where the rate came from.
function adminRateShape(rateRow, settings) {
  const breakdown = rateBreakdown(rateRow, settings)

  return {
    ...breakdown,
    nurse_rate: breakdown.nurse_pay,
    desired_hourly: rateRow?.desired_hourly ?? null,
    admin_hourly: rateRow?.admin_hourly ?? null,
    previous_hourly: rateRow?.previous_hourly ?? null,
    margin_per_hour: breakdown.has_rate ? breakdown.agency_fee : null,
    rate_source: rateRow?.rate_source ?? null,
    updated_at: rateRow?.updated_at ?? null
  }
}

// Nurse-facing: their desired pay and the hospital bill rate it produces.
function nurseRateShape(rateRow, settings) {
  const breakdown = rateBreakdown(rateRow, settings)
  return {
    desired_hourly: rateRow?.desired_hourly ?? null,
    effective_hourly: breakdown.nurse_pay,
    is_admin_overridden:
      rateRow?.admin_hourly !== null && rateRow?.admin_hourly !== undefined,
    agency_fee: breakdown.agency_fee,
    bill_rate: breakdown.bill_rate,
    min_rate: Number(settings?.min_nurse_rate ?? FALLBACK_BOUNDS.min_nurse_rate),
    max_rate: Number(settings?.max_nurse_rate ?? FALLBACK_BOUNDS.max_nurse_rate),
    updated_at: rateRow?.updated_at ?? null
  }
}

// Validates a rate a nurse or admin submitted. Returns { valid, error, value }.
// `null` is valid and means "clear the rate".
function validateHourlyRate(input, settings) {
  if (input === null || input === undefined || input === '') {
    return { valid: true, value: null }
  }

  const rate = Number(input)
  if (!Number.isFinite(rate) || rate <= 0) {
    return { valid: false, error: 'Enter a valid hourly rate.' }
  }

  const min = Number(settings.min_nurse_rate)
  const max = Number(settings.max_nurse_rate)

  if (rate < min) {
    return { valid: false, error: `Rate must be at least $${min.toFixed(2)}/hr.` }
  }
  if (rate > max) {
    return { valid: false, error: `Rate must be $${max.toFixed(2)}/hr or less.` }
  }

  return { valid: true, value: round2(rate) }
}

// Duplicated in client/src/lib/format.js. The two package roots have no shared
// workspace (Vercel frontend, DigitalOcean backend), so this cannot be imported
// across them. Keep the two in sync.
function formatHourly(value, empty = 'Rate on request') {
  if (value === null || value === undefined || value === '') return empty
  const amount = Number(value)
  if (!Number.isFinite(amount)) return empty
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount)
  return `${formatted}/hr`
}

// Loads rate rows for many nurses at once, keyed by nurse id, so list routes
// don't fan out into one query per nurse.
async function loadRateRows(nurseIds) {
  const ids = (nurseIds || []).filter(Boolean)
  if (!ids.length) return new Map()

  const { data, error } = await supabase
    .from('nurse_rates')
    .select('*')
    .in('nurse_id', ids)

  if (error) throw error
  return new Map((data || []).map((row) => [row.nurse_id, row]))
}

async function loadRateRow(nurseId) {
  if (!nurseId) return null
  const { data, error } = await supabase
    .from('nurse_rates')
    .select('*')
    .eq('nurse_id', nurseId)
    .maybeSingle()

  if (error) throw error
  return data || null
}

module.exports = {
  SETTINGS_KEY,
  DEFAULT_AGENCY_FEE,
  round2,
  getBillingSettings,
  invalidateBillingSettingsCache,
  validateBillingSettings,
  validateHourlyRate,
  effectiveNurseRate,
  resolveAgencyFee,
  computeBillRate,
  rateBreakdown,
  employerRateShape,
  adminRateShape,
  nurseRateShape,
  formatHourly,
  loadRateRow,
  loadRateRows
}
