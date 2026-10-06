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
  agency_fee: 17,
  min_nurse_rate: 15,
  max_nurse_rate: 400
}

test("bill rate is the nurse's desired pay plus the flat fee, unrounded", () => {
  // Kundayi's worked examples.
  assert.equal(rates.computeBillRate({ desired_hourly: 65 }, SETTINGS), 82)
  assert.equal(rates.computeBillRate({ desired_hourly: 72 }, SETTINGS), 89)
  assert.equal(rates.computeBillRate({ desired_hourly: 95 }, SETTINGS), 112)
  assert.equal(rates.computeBillRate({ desired_hourly: 63.5 }, SETTINGS), 80.5)
})

test('bill rate is null when the nurse has set no rate', () => {
  assert.equal(rates.computeBillRate(null, SETTINGS), null)
  assert.equal(rates.computeBillRate({ desired_hourly: null }, SETTINGS), null)
})

test('admin override wins over the nurse-requested rate', () => {
  const row = { desired_hourly: 60, admin_hourly: 72 }
  assert.equal(rates.effectiveNurseRate(row), 72)
  assert.equal(rates.computeBillRate(row, SETTINGS), 89)
})

test('a legacy per-nurse markup override no longer changes the price', () => {
  assert.equal(rates.computeBillRate({ desired_hourly: 60, markup_pct_override: 50 }, SETTINGS), 77)
})

test('the fee falls back to $17 until the settings row carries one', () => {
  assert.equal(rates.computeBillRate({ desired_hourly: 65 }, { min_nurse_rate: 15, max_nurse_rate: 400 }), 82)
})

test('a zero or negative fee is refused', () => {
  assert.throws(() => rates.computeBillRate({ desired_hourly: 60 }, { ...SETTINGS, agency_fee: 0 }), /greater than zero/)
})

test('employers see the full breakdown: nurse pay + fee = bill rate', () => {
  const shape = rates.employerRateShape({ desired_hourly: 72 }, SETTINGS)
  assert.deepEqual(shape, { has_rate: true, nurse_pay: 72, agency_fee: 17, bill_rate: 89 })
})

test('the employer shape carries no admin audit fields', () => {
  const shape = rates.employerRateShape(
    { desired_hourly: 60, admin_hourly: 72, previous_hourly: 45, rate_source: 'admin', updated_by: 'admin-1' },
    SETTINGS
  )
  assert.deepEqual(Object.keys(shape).sort(), ['agency_fee', 'bill_rate', 'has_rate', 'nurse_pay'])
  assert.ok(!JSON.stringify(shape).includes('45'), 'previous rate must not leak')
})

test("nurses see their desired pay and the hospital bill rate it produces", () => {
  const shape = rates.nurseRateShape({ desired_hourly: 95 }, SETTINGS)
  assert.equal(shape.desired_hourly, 95)
  assert.equal(shape.effective_hourly, 95)
  assert.equal(shape.agency_fee, 17)
  assert.equal(shape.bill_rate, 112)
  assert.equal(shape.is_admin_overridden, false)
})

test('admin shape carries the breakdown, source and the fee as margin', () => {
  const shape = rates.adminRateShape({ desired_hourly: 60, rate_source: 'nurse' }, SETTINGS)
  assert.equal(shape.nurse_rate, 60)
  assert.equal(shape.agency_fee, 17)
  assert.equal(shape.bill_rate, 77)
  assert.equal(shape.margin_per_hour, 17)
  assert.equal(shape.rate_source, 'nurse')
})

test('rate validation enforces the configured bounds and allows clearing', () => {
  assert.equal(rates.validateHourlyRate(null, SETTINGS).valid, true)
  assert.equal(rates.validateHourlyRate('', SETTINGS).value, null)
  assert.equal(rates.validateHourlyRate(65, SETTINGS).value, 65)
  assert.equal(rates.validateHourlyRate(10, SETTINGS).valid, false)
  assert.equal(rates.validateHourlyRate(500, SETTINGS).valid, false)
  assert.equal(rates.validateHourlyRate('abc', SETTINGS).valid, false)
})

test('billing settings validation rejects a missing fee or inverted bounds', () => {
  assert.deepEqual(rates.validateBillingSettings({ ...SETTINGS }).value, SETTINGS)
  assert.equal(rates.validateBillingSettings({ ...SETTINGS, agency_fee: 0 }).valid, false)
  assert.equal(rates.validateBillingSettings({ min_nurse_rate: 15, max_nurse_rate: 400 }).valid, false)
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
