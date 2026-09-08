const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const assert = require('node:assert/strict')

// Stub the Supabase client so the pure rate math can be tested without env vars
// or a network call, matching the pattern in auth.middleware.test.js.
const originalLoad = Module._load
Module._load = function loadWithRateStubs(request, parent, isMain) {
  if (request === '../config/supabase' || request === './../config/supabase') {
    return { supabase: {} }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const rates = require(path.resolve(__dirname, '../lib/rates'))
Module._load = originalLoad

const SETTINGS = {
  markup_pct: 30,
  rounding_increment: 0.5,
  min_nurse_rate: 15,
  max_nurse_rate: 400
}

test('bill rate applies the markup and rounds up to the increment', () => {
  // 60 * 1.30 = 78 exactly
  assert.equal(rates.computeBillRate({ desired_hourly: 60 }, SETTINGS), 78)
  // 65 * 1.30 = 84.5 exactly
  assert.equal(rates.computeBillRate({ desired_hourly: 65 }, SETTINGS), 84.5)
  // 63 * 1.30 = 81.9 -> rounds UP to 82.0, never down
  assert.equal(rates.computeBillRate({ desired_hourly: 63 }, SETTINGS), 82)
})

test('bill rate is null when the nurse has set no rate', () => {
  assert.equal(rates.computeBillRate(null, SETTINGS), null)
  assert.equal(rates.computeBillRate({ desired_hourly: null }, SETTINGS), null)
})

test('admin override wins over the nurse-requested rate', () => {
  const row = { desired_hourly: 60, admin_hourly: 72 }
  assert.equal(rates.effectiveNurseRate(row), 72)
  assert.equal(rates.computeBillRate(row, SETTINGS), 94) // 72 * 1.30 = 93.6 -> rounds up to 94
})

test('per-nurse markup override beats the platform default', () => {
  assert.equal(rates.resolveMarkupPct({ markup_pct_override: 45 }, SETTINGS), 45)
  assert.equal(rates.resolveMarkupPct({ markup_pct_override: null }, SETTINGS), 30)
  assert.equal(rates.computeBillRate({ desired_hourly: 60, markup_pct_override: 50 }, SETTINGS), 90)
})

test('a zero or negative markup is refused rather than silently publishing the nurse rate', () => {
  assert.throws(
    () => rates.computeBillRate({ desired_hourly: 60 }, { ...SETTINGS, markup_pct: 0 }),
    /greater than zero/
  )
})

test('employer shape leaks neither the nurse rate nor the markup', () => {
  const shape = rates.employerRateShape(
    { desired_hourly: 60, admin_hourly: 72, markup_pct_override: 45 },
    SETTINGS
  )
  assert.deepEqual(Object.keys(shape).sort(), ['bill_rate', 'has_rate'])
  const serialized = JSON.stringify(shape)
  for (const forbidden of ['desired_hourly', 'admin_hourly', 'markup', 'nurse_rate', '60', '72', '45']) {
    assert.equal(serialized.includes(forbidden), false, `employer shape leaked ${forbidden}`)
  }
})

test('nurse shape shows the nurse their own rate but never the bill rate or markup', () => {
  const shape = rates.nurseRateShape({ desired_hourly: 60, admin_hourly: 72 }, SETTINGS)
  assert.equal(shape.desired_hourly, 60)
  assert.equal(shape.effective_hourly, 72)
  assert.equal(shape.is_admin_overridden, true)
  assert.equal('bill_rate' in shape, false)
  assert.equal('markup_pct' in shape, false)
})

test('admin shape carries the full picture including margin', () => {
  const shape = rates.adminRateShape({ desired_hourly: 60 }, SETTINGS)
  assert.equal(shape.nurse_rate, 60)
  assert.equal(shape.markup_pct, 30)
  assert.equal(shape.bill_rate, 78)
  assert.equal(shape.margin_per_hour, 18)
})

test('rate validation enforces the configured bounds and allows clearing', () => {
  assert.equal(rates.validateHourlyRate(null, SETTINGS).valid, true)
  assert.equal(rates.validateHourlyRate('', SETTINGS).value, null)
  assert.equal(rates.validateHourlyRate(65, SETTINGS).value, 65)
  assert.equal(rates.validateHourlyRate(10, SETTINGS).valid, false)
  assert.equal(rates.validateHourlyRate(500, SETTINGS).valid, false)
  assert.equal(rates.validateHourlyRate('abc', SETTINGS).valid, false)
})

test('billing settings validation rejects an inverted or zero configuration', () => {
  assert.equal(rates.validateBillingSettings({ ...SETTINGS }).valid, true)
  assert.equal(rates.validateBillingSettings({ ...SETTINGS, markup_pct: 0 }).valid, false)
  assert.equal(rates.validateBillingSettings({ ...SETTINGS, rounding_increment: 0 }).valid, false)
  assert.equal(
    rates.validateBillingSettings({ ...SETTINGS, min_nurse_rate: 500, max_nurse_rate: 20 }).valid,
    false
  )
})

test('formatHourly renders whole and fractional rates cleanly', () => {
  assert.equal(rates.formatHourly(78), '$78/hr')
  assert.equal(rates.formatHourly(78.5), '$78.50/hr')
  assert.equal(rates.formatHourly(null), 'Rate on request')
})
