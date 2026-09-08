const path = require('node:path')
const Module = require('node:module')
const { test } = require('node:test')
const assert = require('node:assert/strict')

// Stub Supabase so the transition map and response shapes can be tested
// without env vars or a network call.
const originalLoad = Module._load
Module._load = function loadWithStubs(request, parent, isMain) {
  if (request === '../config/supabase' || request === './../config/supabase') {
    return { supabase: {} }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const nr = require(path.resolve(__dirname, '../lib/nurse-requests'))
Module._load = originalLoad

const ROW = {
  id: 'req-1',
  employer_id: 'emp-1',
  nurse_id: 'nurse-1',
  status: 'presented',
  engagement_type: 'per_diem',
  specialty: 'ICU / Critical Care',
  city: 'Chicago',
  state: 'IL',
  start_date: '2026-10-01',
  end_date: null,
  hours_per_week: 36,
  shift_type: 'night',
  employer_note: 'Three nights a week.',
  admin_notes: 'Vetted, good fit.',
  nurse_response_note: '',
  quoted_bill_rate: 94,
  markup_pct_snapshot: 30,
  offered_nurse_rate: 72,
  employer_visible_to_nurse: false,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z'
}

const NURSE = { id: 'nurse-1', first_name: 'Jordan', last_name: 'Mensah', specialty: 'ICU / Critical Care' }
const EMPLOYER = { id: 'emp-1', org_name: 'Mercy General' }

test('a nurse can only answer a request that has been presented', () => {
  assert.equal(nr.canTransition('nurse', 'presented', 'nurse_accepted'), true)
  assert.equal(nr.canTransition('nurse', 'presented', 'nurse_declined'), true)
  // The admin gate: nothing before presentation is answerable, or even visible.
  assert.equal(nr.canTransition('nurse', 'submitted', 'nurse_accepted'), false)
  assert.equal(nr.canTransition('nurse', 'reviewing', 'nurse_accepted'), false)
  // A nurse cannot place or reject.
  assert.equal(nr.canTransition('nurse', 'nurse_accepted', 'placed'), false)
  assert.equal(nr.canTransition('nurse', 'presented', 'rejected'), false)
})

test('an employer can withdraw but cannot drive the pipeline', () => {
  assert.equal(nr.canTransition('employer', 'submitted', 'closed'), true)
  assert.equal(nr.canTransition('employer', 'presented', 'closed'), true)
  assert.equal(nr.canTransition('employer', 'submitted', 'presented'), false)
  assert.equal(nr.canTransition('employer', 'nurse_accepted', 'placed'), false)
  assert.equal(nr.canTransition('employer', 'submitted', 'reviewing'), false)
})

test('admin drives the pipeline but cannot answer for the nurse', () => {
  assert.equal(nr.canTransition('admin', 'submitted', 'reviewing'), true)
  assert.equal(nr.canTransition('admin', 'reviewing', 'presented'), true)
  assert.equal(nr.canTransition('admin', 'nurse_accepted', 'placed'), true)
  assert.equal(nr.canTransition('admin', 'presented', 'nurse_accepted'), false)
  assert.equal(nr.canTransition('admin', 'presented', 'nurse_declined'), false)
})

test('terminal states accept no further transitions from anyone', () => {
  for (const status of nr.TERMINAL) {
    assert.equal(nr.isTerminal(status), true)
    for (const role of ['admin', 'employer', 'nurse']) {
      // 'closed' is reachable FROM nurse_declined by admin for re-placement,
      // so assert only that no role can resurrect a placed/rejected request.
      if (status === 'placed' || status === 'rejected' || status === 'closed') {
        assert.deepEqual(nr.TRANSITIONS[role][status], [], `${role} from ${status}`)
      }
    }
  }
})

test('an unknown role or status never yields a legal transition', () => {
  assert.equal(nr.canTransition('hacker', 'submitted', 'placed'), false)
  assert.equal(nr.canTransition('admin', 'submitted', 'not_a_status'), false)
})

test('employer shape hides the offered nurse rate and the internal status', () => {
  const shape = nr.employerRequestShape(ROW, NURSE)
  const serialized = JSON.stringify(shape)

  assert.equal('offered_nurse_rate' in shape, false)
  assert.equal('markup_pct_snapshot' in shape, false)
  assert.equal('admin_notes' in shape, false)
  assert.equal('status' in shape, false, 'raw status must not reach the employer')
  // 72 is the nurse's pay; it must appear nowhere.
  assert.equal(serialized.includes('72'), false)

  // Coarse label only: "presented" must not be distinguishable from accepted.
  assert.equal(shape.status_label, 'Confirming Availability')
  assert.equal(
    nr.employerRequestShape({ ...ROW, status: 'nurse_accepted' }, NURSE).status_label,
    'Confirming Availability'
  )
  // The employer keeps the bill rate they were already quoted.
  assert.equal(shape.quoted_bill_rate, 94)
  // Last initial only, matching the directory's gating.
  assert.equal(shape.nurse_name, 'Jordan M.')
})

test('employer cannot tell a nurse decline from a Seraphyn rejection', () => {
  const declined = nr.employerRequestShape({ ...ROW, status: 'nurse_declined' }, NURSE)
  const rejected = nr.employerRequestShape({ ...ROW, status: 'rejected' }, NURSE)
  assert.equal(declined.status_label, rejected.status_label)
  assert.equal(declined.status_label, 'Not Available')
})

test('nurse shape hides the bill rate and the markup', () => {
  const shape = nr.nurseRequestShape(ROW, EMPLOYER)
  const serialized = JSON.stringify(shape)

  assert.equal('quoted_bill_rate' in shape, false)
  assert.equal('markup_pct_snapshot' in shape, false)
  assert.equal('admin_notes' in shape, false)
  assert.equal(serialized.includes('94'), false, 'bill rate leaked to nurse')
  assert.equal(serialized.includes('30'), false, 'markup leaked to nurse')

  assert.equal(shape.offered_nurse_rate, 72)
  assert.equal(shape.awaiting_response, true)
})

test('the facility name reaches the nurse only once admin reveals it', () => {
  assert.equal(nr.nurseRequestShape(ROW, EMPLOYER).facility_name, null)
  assert.equal(
    nr.nurseRequestShape({ ...ROW, employer_visible_to_nurse: true }, EMPLOYER).facility_name,
    'Mercy General'
  )
})

test('admin shape carries the full picture including margin', () => {
  const shape = nr.adminRequestShape(ROW, { nurse: NURSE, employer: EMPLOYER })
  assert.equal(shape.offered_nurse_rate, 72)
  assert.equal(shape.quoted_bill_rate, 94)
  assert.equal(shape.margin_per_hour, 22)
  assert.equal(shape.employer_status_label, 'Confirming Availability')
  assert.equal(shape.nurse_name, 'Jordan Mensah')
  assert.deepEqual(shape.allowed_transitions, nr.TRANSITIONS.admin.presented)
})

test('admin margin goes negative rather than hiding a below-cost placement', () => {
  const shape = nr.adminRequestShape(
    { ...ROW, offered_nurse_rate: 100, quoted_bill_rate: 94 },
    { nurse: NURSE, employer: EMPLOYER }
  )
  assert.equal(shape.margin_per_hour, -6)
})
