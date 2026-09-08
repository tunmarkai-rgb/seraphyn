// Employer-initiated nurse requests: state machine and per-role response shapes.
//
// CONFIDENTIALITY CONTRACT: no route may return a raw nurse_requests row.
//   * employerRequestShape -- never quoted internals beyond what the employer
//     was already shown, never offered_nurse_rate, and a COARSE status.
//   * nurseRequestShape    -- never quoted_bill_rate, never markup_pct_snapshot.
//   * adminRequestShape    -- everything.
// See docs/NURSE_REQUESTS.sql.

const { supabase } = require('../config/supabase')

const STATUSES = [
  'submitted', 'reviewing', 'presented', 'nurse_accepted',
  'nurse_declined', 'placed', 'rejected', 'closed'
]

const TERMINAL = ['nurse_declined', 'placed', 'rejected', 'closed']

// Legal transitions keyed by the actor's role. A client-supplied status is
// never trusted; it is looked up here or refused.
const TRANSITIONS = {
  admin: {
    submitted: ['reviewing', 'presented', 'rejected', 'closed'],
    reviewing: ['presented', 'rejected', 'closed'],
    presented: ['reviewing', 'rejected', 'closed'],
    nurse_accepted: ['placed', 'closed'],
    nurse_declined: ['reviewing', 'closed'],
    placed: [],
    rejected: [],
    closed: []
  },
  employer: {
    submitted: ['closed'],
    reviewing: ['closed'],
    presented: ['closed'],
    nurse_accepted: ['closed'],
    nurse_declined: [],
    placed: [],
    rejected: [],
    closed: []
  },
  nurse: {
    // A nurse can only answer a request that has actually been presented.
    presented: ['nurse_accepted', 'nurse_declined'],
    submitted: [],
    reviewing: [],
    nurse_accepted: [],
    nurse_declined: [],
    placed: [],
    rejected: [],
    closed: []
  }
}

// Employers must not learn whether the nurse has been asked yet -- that turns
// into "why hasn't she answered". Internal states collapse to these labels.
const EMPLOYER_STATUS_LABELS = {
  submitted: 'In Review',
  reviewing: 'In Review',
  presented: 'Confirming Availability',
  nurse_accepted: 'Confirming Availability',
  placed: 'Placed',
  nurse_declined: 'Not Available',
  rejected: 'Not Available',
  closed: 'Withdrawn'
}

function canTransition(role, from, to) {
  return Boolean(TRANSITIONS[role]?.[from]?.includes(to))
}

function isTerminal(status) {
  return TERMINAL.includes(status)
}

const ASSIGNMENT_FIELDS = [
  'engagement_type', 'specialty', 'city', 'state',
  'start_date', 'end_date', 'hours_per_week', 'shift_type'
]

function assignmentFields(row) {
  const out = {}
  for (const f of ASSIGNMENT_FIELDS) out[f] = row[f] ?? null
  return out
}

// --- Response shapes ------------------------------------------------------

function employerRequestShape(row, nurse = null) {
  return {
    id: row.id,
    nurse_id: row.nurse_id,
    // First name plus last initial, matching the directory's gating.
    nurse_name: nurse
      ? `${nurse.first_name || ''} ${nurse.last_name ? nurse.last_name[0] + '.' : ''}`.trim()
      : null,
    nurse_specialty: nurse?.specialty || null,
    ...assignmentFields(row),
    employer_note: row.employer_note,
    // The bill rate the employer was quoted -- they have already seen this.
    quoted_bill_rate: row.quoted_bill_rate,
    status_label: EMPLOYER_STATUS_LABELS[row.status] || 'In Review',
    // Coarse flag so the UI can enable Withdraw without exposing raw status.
    can_withdraw: !isTerminal(row.status),
    is_closed: isTerminal(row.status),
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function nurseRequestShape(row, employer = null) {
  return {
    id: row.id,
    ...assignmentFields(row),
    // Identity only once an admin has chosen to reveal it.
    facility_name: row.employer_visible_to_nurse ? employer?.org_name || null : null,
    employer_note: row.employer_note,
    // What the nurse is paid. quoted_bill_rate and markup_pct_snapshot are
    // deliberately absent.
    offered_nurse_rate: row.offered_nurse_rate,
    status: row.status,
    awaiting_response: row.status === 'presented',
    nurse_response_note: row.nurse_response_note,
    presented_at: row.presented_at,
    responded_at: row.responded_at,
    placed_at: row.placed_at
  }
}

function adminRequestShape(row, { nurse = null, employer = null } = {}) {
  const nurseRate = row.offered_nurse_rate
  const billRate = row.quoted_bill_rate
  return {
    ...row,
    nurse_name: nurse ? `${nurse.first_name || ''} ${nurse.last_name || ''}`.trim() : null,
    nurse_specialty: nurse?.specialty || null,
    employer_org: employer?.org_name || null,
    employer_status_label: EMPLOYER_STATUS_LABELS[row.status] || null,
    margin_per_hour:
      nurseRate != null && billRate != null
        ? Math.round((Number(billRate) - Number(nurseRate)) * 100) / 100
        : null,
    allowed_transitions: TRANSITIONS.admin[row.status] || []
  }
}

// --- Persistence ----------------------------------------------------------

async function recordEvent({ requestId, actorRole, actorId, fromStatus, toStatus, note = '' }) {
  const { error } = await supabase.from('nurse_request_events').insert({
    request_id: requestId,
    actor_role: actorRole,
    actor_id: actorId || null,
    from_status: fromStatus || null,
    to_status: toStatus,
    note
  })
  // Never fail the caller's write because the audit insert failed.
  if (error) console.error('Failed to record nurse request event:', error.message)
}

async function loadRequest(id) {
  const { data, error } = await supabase
    .from('nurse_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data || null
}

// Applies a status change through the transition map, stamping the lifecycle
// timestamp that goes with the target state.
async function applyTransition(request, { role, actorId, toStatus, patch = {}, note = '' }) {
  if (!STATUSES.includes(toStatus)) {
    return { error: `Unknown status "${toStatus}"`, status: 400 }
  }
  if (!canTransition(role, request.status, toStatus)) {
    return {
      error: `Cannot move a request from ${request.status} to ${toStatus}`,
      status: 409
    }
  }

  const now = new Date().toISOString()
  const stamps = {
    presented: { presented_at: now },
    nurse_accepted: { responded_at: now },
    nurse_declined: { responded_at: now },
    placed: { placed_at: now },
    rejected: { closed_at: now },
    closed: { closed_at: now }
  }[toStatus] || {}

  const { data, error } = await supabase
    .from('nurse_requests')
    .update({ ...patch, ...stamps, status: toStatus, updated_at: now })
    .eq('id', request.id)
    .select('*')
    .single()

  if (error) return { error: error.message, status: 500 }

  await recordEvent({
    requestId: request.id,
    actorRole: role,
    actorId,
    fromStatus: request.status,
    toStatus,
    note
  })

  return { request: data }
}

async function loadNurseSummaries(nurseIds) {
  const ids = [...new Set((nurseIds || []).filter(Boolean))]
  if (!ids.length) return new Map()
  const { data } = await supabase
    .from('nurse_profiles')
    .select('id, first_name, last_name, specialty')
    .in('id', ids)
  return new Map((data || []).map((n) => [n.id, n]))
}

async function loadEmployerSummaries(employerIds) {
  const ids = [...new Set((employerIds || []).filter(Boolean))]
  if (!ids.length) return new Map()
  const { data } = await supabase
    .from('employer_profiles')
    .select('id, org_name, city, state')
    .in('id', ids)
  return new Map((data || []).map((e) => [e.id, e]))
}

module.exports = {
  STATUSES,
  TERMINAL,
  TRANSITIONS,
  EMPLOYER_STATUS_LABELS,
  canTransition,
  isTerminal,
  employerRequestShape,
  nurseRequestShape,
  adminRequestShape,
  loadRequest,
  applyTransition,
  recordEvent,
  loadNurseSummaries,
  loadEmployerSummaries
}
