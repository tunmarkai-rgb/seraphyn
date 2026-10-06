const path = require('node:path')
const { test } = require('node:test')
const assert = require('node:assert/strict')

const matching = require(path.resolve(__dirname, '../lib/matching'))
const { FIT } = matching

// Kundayi's example: an ICU need with a $90 maximum.
const BUDGET_90 = { max_bill_rate: 90 }
const RANGE = { target_bill_rate: 85, max_bill_rate: 95 }

test('nurses are categorised against the target and maximum', () => {
  assert.equal(matching.rateFit(82, BUDGET_90), FIT.WITHIN_TARGET)
  assert.equal(matching.rateFit(89, BUDGET_90), FIT.WITHIN_TARGET)
  assert.equal(matching.rateFit(112, BUDGET_90), FIT.ABOVE_MAX)

  assert.equal(matching.rateFit(85, RANGE), FIT.WITHIN_TARGET)
  assert.equal(matching.rateFit(92, RANGE), FIT.WITHIN_MAX)
  assert.equal(matching.rateFit(96, RANGE), FIT.ABOVE_MAX)
  assert.equal(matching.rateFit(null, RANGE), FIT.NO_RATE)
  assert.equal(matching.rateFit(80, {}), FIT.NO_BUDGET)
})

test('the "above your maximum" amount matches the hospital message', () => {
  // "This nurse's requested rate is $22/hr above your stated maximum."
  assert.equal(matching.amountOverMax(112, BUDGET_90), 22)
  assert.equal(matching.amountOverMax(82, BUDGET_90), 0)
})

test('a target alone or a maximum alone serves as both', () => {
  assert.deepEqual(matching.normalizeBudget({ max: 90 }), { target: 90, max: 90 })
  assert.deepEqual(matching.normalizeBudget({ target: 85 }), { target: 85, max: 85 })
  assert.deepEqual(matching.normalizeBudget({ target: 95, max: 85 }), { target: 85, max: 95 })
  assert.equal(matching.normalizeBudget({}), null)
})

test('urgency decides grouping, and nobody is hidden', () => {
  assert.equal(matching.groupForUrgency(FIT.WITHIN_TARGET, 'standard'), 'primary')
  assert.equal(matching.groupForUrgency(FIT.WITHIN_MAX, 'standard'), 'secondary')
  assert.equal(matching.groupForUrgency(FIT.ABOVE_MAX, 'standard'), 'above_budget')
  assert.equal(matching.groupForUrgency(FIT.WITHIN_MAX, 'urgent'), 'primary')
  assert.equal(matching.groupForUrgency(FIT.ABOVE_MAX, 'urgent'), 'above_budget')
  assert.equal(matching.groupForUrgency(FIT.ABOVE_MAX, 'critical'), 'primary')
})

test('rate is one matching variable, not an automatic rejection', () => {
  const job = { specialty: 'ICU / Critical Care', state: 'CA', requirements: 'BLS and ACLS required', urgency: 'standard' }
  const strongClinical = {
    specialty: 'ICU / Critical Care', license_state: 'CA', certifications: ['BLS', 'ACLS'],
    availability: 'available', years_experience: '8'
  }
  const weakClinical = { specialty: 'Pediatrics', license_state: 'TX', certifications: [], availability: 'available', years_experience: '1' }

  const aboveBudgetButStrong = matching.scoreMatch({ nurse: strongClinical, billRate: 112, job, budget: BUDGET_90 })
  const inBudgetButWeak = matching.scoreMatch({ nurse: weakClinical, billRate: 82, job, budget: BUDGET_90 })

  assert.equal(aboveBudgetButStrong.fit, FIT.ABOVE_MAX)
  assert.ok(aboveBudgetButStrong.score > inBudgetButWeak.score, 'a strong clinical match outranks a cheap weak one')
})

test('urgency raises an above-budget nurse but never above an equal in-budget one', () => {
  const nurse = { specialty: 'ICU / Critical Care', availability: 'available', years_experience: '5' }
  const job = { specialty: 'ICU / Critical Care' }
  const standard = matching.scoreMatch({ nurse, billRate: 112, job, budget: BUDGET_90, urgency: 'standard' }).score
  const critical = matching.scoreMatch({ nurse, billRate: 112, job, budget: BUDGET_90, urgency: 'critical' }).score
  const inBudget = matching.scoreMatch({ nurse, billRate: 82, job, budget: BUDGET_90, urgency: 'critical' }).score
  assert.ok(critical > standard)
  assert.ok(inBudget > critical)
})

test('missing certifications cost points, unmentioned ones do not', () => {
  const nurse = { certifications: ['BLS'] }
  const needsTwo = matching.scoreMatch({ nurse, job: { requirements: 'Must hold BLS and ACLS' } }).score
  const needsNone = matching.scoreMatch({ nurse, job: { requirements: 'Friendly team' } }).score
  assert.ok(needsNone > needsTwo)
})

test('market response counts jobs without exposing any budget', () => {
  const jobs = [
    { budget: { max_bill_rate: 120 }, urgency: 'standard' },
    { budget: { max_bill_rate: 115 }, urgency: 'standard' },
    { budget: { max_bill_rate: 100 }, urgency: 'critical' },
    { budget: { max_bill_rate: 90 }, urgency: 'standard' },
    { budget: null, urgency: 'standard' }
  ]
  assert.deepEqual(matching.marketResponse(112, jobs), { fits: 2, urgent_above: 1, below: 1, total: 4 })
  assert.deepEqual(matching.marketResponse(null, jobs), { fits: 0, urgent_above: 0, below: 0, total: 0 })
})

test('nurse fit labels are coarse', () => {
  assert.equal(matching.nurseFitLabel(82, { budget: BUDGET_90, urgency: 'standard' }), 'fits')
  assert.equal(matching.nurseFitLabel(112, { budget: BUDGET_90, urgency: 'standard' }), 'above_budget')
  assert.equal(matching.nurseFitLabel(112, { budget: BUDGET_90, urgency: 'urgent' }), 'may_consider')
  assert.equal(matching.nurseFitLabel(112, { budget: null }), null)
})
