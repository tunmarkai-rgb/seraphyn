// Nurse rate -> employer bill rate.
//
// CONFIDENTIALITY CONTRACT: no route may ever spread a raw `nurse_rates` row
// into an employer-facing response. Employers get `employerRateShape()` and
// nothing else. The nurse's own rate, the markup percentage, and the margin are
// admin-only. See docs/NURSE_RATES.sql.
//
// Scope is per-diem / contract hourly. Direct hire uses the separate
// placement-fee model described in the signed agreements.

const { supabase } = require('../config/supabase')

const SETTINGS_KEY = 'per_diem_billing'
const CACHE_TTL_MS = 60 * 1000

const FALLBACK_BOUNDS = { min_nurse_rate: 15, max_nurse_rate: 400 }

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
    // Fail closed. Defaulting the markup to zero would publish the nurse's own
    // rate to employers as the bill rate, which is the exact failure this
    // feature exists to prevent.
    throw new Error(
      `Billing settings row "${SETTINGS_KEY}" is missing; refusing to compute a bill rate`
    )
  }

  cache = { value: data.value, fetchedAt: Date.now() }
  return data.value
}

function validateBillingSettings(input) {
  const errors = []
  const markup = Number(input?.markup_pct)
  const increment = Number(input?.rounding_increment)
  const min = Number(input?.min_nurse_rate)
  const max = Number(input?.max_nurse_rate)

  if (!Number.isFinite(markup) || markup <= 0 || markup > 500) {
    errors.push('markup_pct must be a number greater than 0 and no more than 500')
  }
  if (!Number.isFinite(increment) || increment <= 0 || increment > 100) {
    errors.push('rounding_increment must be a number greater than 0 and no more than 100')
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
      markup_pct: round2(markup),
      rounding_increment: round2(increment),
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

function resolveMarkupPct(rateRow, settings) {
  const override = rateRow?.markup_pct_override
  if (override !== null && override !== undefined) return Number(override)
  return Number(settings.markup_pct)
}

// Rounds UP to the configured increment so a quoted rate never lands below the
// margin floor. Coarse rounding also widens the window an employer would have
// to guess through to recover the nurse's rate from the bill rate.
function computeBillRate(rateRow, settings) {
  const rate = effectiveNurseRate(rateRow)
  if (rate === null) return null

  const markup = resolveMarkupPct(rateRow, settings)
  if (!Number.isFinite(markup) || markup <= 0) {
    throw new Error('per_diem_billing.markup_pct must be greater than zero')
  }

  const gross = rate * (1 + markup / 100)
  const increment = Number(settings.rounding_increment)

  if (!Number.isFinite(increment) || increment <= 0) return round2(gross)
  return round2(Math.ceil(gross / increment) * increment)
}

// --- Response shapes -------------------------------------------------------

// Employer-facing. Carries the bill rate and nothing that could be worked
// backwards into the nurse's rate.
function employerRateShape(rateRow, settings) {
  const billRate = computeBillRate(rateRow, settings)
  return { bill_rate: billRate, has_rate: billRate !== null }
}

// Admin-facing. The only shape that may contain the nurse rate or the markup.
function adminRateShape(rateRow, settings) {
  const nurseRate = effectiveNurseRate(rateRow)
  const billRate = computeBillRate(rateRow, settings)

  return {
    has_rate: nurseRate !== null,
    nurse_rate: nurseRate,
    desired_hourly: rateRow?.desired_hourly ?? null,
    admin_hourly: rateRow?.admin_hourly ?? null,
    previous_hourly: rateRow?.previous_hourly ?? null,
    markup_pct: rateRow ? resolveMarkupPct(rateRow, settings) : Number(settings.markup_pct),
    markup_pct_override: rateRow?.markup_pct_override ?? null,
    bill_rate: billRate,
    margin_per_hour:
      nurseRate !== null && billRate !== null ? round2(billRate - nurseRate) : null,
    rate_source: rateRow?.rate_source ?? null,
    updated_at: rateRow?.updated_at ?? null
  }
}

// Nurse-facing. Shows the nurse their own rate and whether admin has overridden
// it. Never the bill rate, never the markup.
function nurseRateShape(rateRow, settings) {
  return {
    desired_hourly: rateRow?.desired_hourly ?? null,
    effective_hourly: effectiveNurseRate(rateRow),
    is_admin_overridden:
      rateRow?.admin_hourly !== null && rateRow?.admin_hourly !== undefined,
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
  getBillingSettings,
  invalidateBillingSettingsCache,
  validateBillingSettings,
  validateHourlyRate,
  effectiveNurseRate,
  resolveMarkupPct,
  computeBillRate,
  employerRateShape,
  adminRateShape,
  nurseRateShape,
  formatHourly,
  loadRateRow,
  loadRateRows
}
