// All writes to `nurse_rates` go through here so the audit row in
// `nurse_rate_history` is never forgotten. See docs/NURSE_RATES.sql.

const { supabase } = require('./../config/supabase')
const {
  getBillingSettings,
  computeBillRate,
  resolveAgencyFee,
  loadRateRow
} = require('./rates')

async function recordRateHistory({
  nurseId,
  source,
  field,
  oldValue,
  newValue,
  rateRow,
  settings,
  changedBy,
  reason = ''
}) {
  let agencyFee = null
  let billRate = null

  try {
    agencyFee = resolveAgencyFee(settings)
    billRate = computeBillRate(rateRow, settings)
  } catch {
    // A history row is worth writing even if the derived figures can't be
    // computed (e.g. the rate was just cleared).
  }

  const { error } = await supabase.from('nurse_rate_history').insert({
    nurse_id: nurseId,
    source,
    field,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
    agency_fee_at_change: agencyFee,
    bill_rate_at_change: billRate,
    changed_by: changedBy || null,
    reason
  })

  if (error) {
    // Never fail the caller's write because the audit insert failed.
    console.error('Failed to record nurse rate history:', error.message)
  }
}

async function upsertRate(nurseId, patch) {
  const { data, error } = await supabase
    .from('nurse_rates')
    .upsert(
      { nurse_id: nurseId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'nurse_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

// A nurse sets or clears their own desired rate.
async function setNurseDesiredRate(nurseId, hourlyRate, changedBy) {
  const settings = await getBillingSettings()
  const existing = await loadRateRow(nurseId)
  const oldValue = existing?.desired_hourly ?? null

  const updated = await upsertRate(nurseId, {
    desired_hourly: hourlyRate,
    previous_hourly: oldValue,
    rate_source: 'nurse',
    updated_by: changedBy || null
  })

  await recordRateHistory({
    nurseId,
    source: 'nurse',
    field: 'desired_hourly',
    oldValue,
    newValue: hourlyRate,
    rateRow: updated,
    settings,
    changedBy
  })

  return updated
}

// Admin overrides the nurse's pay. (There is no per-nurse fee: the Seraphyn
// fee is one public amount for everyone.)
async function setAdminRate(nurseId, { adminHourly }, changedBy, reason = '') {
  const settings = await getBillingSettings()
  const existing = await loadRateRow(nurseId)

  const updated = await upsertRate(nurseId, {
    rate_source: 'admin',
    updated_by: changedBy || null,
    admin_hourly: adminHourly,
    previous_hourly: existing?.admin_hourly ?? existing?.desired_hourly ?? null
  })

  await recordRateHistory({
    nurseId,
    source: 'admin',
    field: 'admin_hourly',
    oldValue: existing?.admin_hourly ?? null,
    newValue: adminHourly,
    rateRow: updated,
    settings,
    changedBy,
    reason
  })

  return updated
}

async function readRateHistory(nurseId, limit = 25) {
  const { data, error } = await supabase
    .from('nurse_rate_history')
    .select('*')
    .eq('nurse_id', nurseId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

module.exports = {
  setNurseDesiredRate,
  setAdminRate,
  readRateHistory
}
