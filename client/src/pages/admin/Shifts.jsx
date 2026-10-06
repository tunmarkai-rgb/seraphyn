import { useState, useEffect } from 'react'
import { apiRequest } from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { formatHourly } from '../../lib/format'
import { usePricing } from '../../lib/pricing'

const STATUS_COLORS = {
  open:       { label: 'Open',       bg: 'rgba(45,122,79,0.1)',    color: 'var(--success)' },
  filled:     { label: 'Filled',     bg: 'rgba(126,181,200,0.12)', color: 'var(--sky-blue)' },
  completed:  { label: 'Completed',  bg: 'rgba(90,107,122,0.1)',   color: 'var(--text-muted)' },
  cancelled:  { label: 'Cancelled',  bg: 'rgba(180,60,60,0.1)',    color: '#B43C3C' },
}

export default function AdminShifts() {
  const pricing = usePricing()
  const [shifts, setShifts] = useState([])
  const [filter, setFilter] = useState('open')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [nurseOptions, setNurseOptions] = useState([])
  const [payDrafts, setPayDrafts] = useState({})
  const [warning, setWarning] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { void loadShifts() }, [filter])
  useEffect(() => { void loadNurseOptions() }, [])

  async function loadNurseOptions() {
    try {
      setNurseOptions(await apiRequest('/api/admin/shifts/nurse-options') || [])
    } catch (loadError) {
      console.error('Failed to load nurse options:', loadError.message)
    }
  }

  function applyUpdate(updated) {
    setShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    setWarning(updated.rate_warning || '')
    setPayDrafts((prev) => {
      const next = { ...prev }
      delete next[updated.id]
      return next
    })
  }

  async function patchShift(shiftId, body) {
    setActionLoading(shiftId)
    setError('')
    try {
      applyUpdate(await apiRequest(`/api/admin/shifts/${shiftId}`, { method: 'PUT', body }))
    } catch (patchError) {
      setError(patchError.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function loadShifts() {
    setLoading(true)
    const data = await apiRequest(`/api/admin/shifts?status=${encodeURIComponent(filter)}`)
    setShifts(data || [])
    setLoading(false)
  }

  // Both go through patchShift so a margin warning surfaces on any edit, and
  // so a failed write reports instead of silently doing nothing.
  async function updateStatus(shiftId, status) {
    await patchShift(shiftId, { status })
  }

  async function updateAdminNote(shiftId, note) {
    await patchShift(shiftId, { admin_notes: note })
  }

  return (
    <AdminLayout title="Per Diem Shifts">
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(180,60,60,0.08)', border: '1px solid rgba(180,60,60,0.3)', borderRadius: '2px', fontSize: '13px', color: '#B43C3C', marginBottom: '16px' }}>
          {error}
        </div>
      )}
      {warning && (
        <div style={{ padding: '12px 16px', background: 'rgba(201,169,110,0.15)', border: '1px solid var(--warm-gold)', borderRadius: '2px', fontSize: '13px', color: 'var(--deep-navy)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span>{warning}</span>
          <button type="button" onClick={() => setWarning('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>dismiss</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {[['all','All'],['open','Open'],['filled','Filled'],['completed','Completed'],['cancelled','Cancelled']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            style={{ padding: '7px 16px', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer', border: filter === val ? '1px solid var(--deep-navy)' : '1px solid var(--border)', background: filter === val ? 'var(--deep-navy)' : 'white', color: filter === val ? 'white' : 'var(--text-muted)' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : shifts.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '60px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>No shifts found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {shifts.map(shift => {
            const s = STATUS_COLORS[shift.status] || STATUS_COLORS.open
            const date = shift.shift_date ? new Date(shift.shift_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'
            return (
              <div key={shift.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '4px' }}>
                      {shift.specialty} · {shift.employer_profiles?.org_name}
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      📅 {date} · {shift.start_time} – {shift.end_time}
                    </p>
                    {shift.nurse_profiles && (
                      <p style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px' }}>
                        👤 Assigned: {shift.nurse_profiles.first_name} {shift.nurse_profiles.last_name}
                      </p>
                    )}
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: '2px', fontSize: '10px', fontWeight: '500', background: s.bg, color: s.color }}>{s.label}</span>
                </div>

                {/* Rate panel. hourly_rate is the employer's BILL rate; nurse pay
                    is admin-set and snapshotted so a later rate change cannot
                    re-price a shift that has already been booked. */}
                {(() => {
                  const draft = payDrafts[shift.id]
                  const payValue = draft !== undefined
                    ? draft
                    : (shift.nurse_pay_rate != null ? String(shift.nurse_pay_rate) : '')
                  const pay = payValue === '' ? null : Number(payValue)
                  const bill = shift.hourly_rate != null ? Number(shift.hourly_rate) : null
                  const margin = pay != null && bill != null ? Math.round((bill - pay) * 100) / 100 : null
                  // Below the fee in force at booking (or today's fee) is "thin".
                  const fee = shift.agency_fee_snapshot != null ? Number(shift.agency_fee_snapshot) : Number(pricing.agency_fee)
                  const belowCost = margin != null && margin <= 0
                  const thin = margin != null && !belowCost && fee > 0 && margin < fee

                  return (
                    <div style={{ padding: '14px 16px', background: 'var(--warm-white)', border: '1px solid var(--border)', borderRadius: '2px', marginBottom: '12px' }}>
                      <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warm-gold)', fontWeight: '600', marginBottom: '12px' }}>
                        Rate
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '12px' }}>
                        <div>
                          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Nurse Pay</p>
                          <input
                            type="number" min="0" step="0.50" value={payValue}
                            onChange={(e) => setPayDrafts((prev) => ({ ...prev, [shift.id]: e.target.value }))}
                            onBlur={() => {
                              if (draft === undefined) return
                              patchShift(shift.id, { nurse_pay_rate: draft === '' ? null : Number(draft) })
                            }}
                            placeholder="not set"
                            style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '13px', outline: 'none', fontFamily: 'DM Sans', color: 'var(--deep-navy)', background: 'white' }}
                          />
                        </div>
                        <div>
                          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Seraphyn Fee</p>
                          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: '500', color: 'var(--deep-navy)' }}>
                            {formatHourly(fee, { empty: '—' })}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Bill Rate (Employer Pays)</p>
                          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: '500', color: 'var(--deep-navy)' }}>
                            {formatHourly(bill, { empty: '—' })}
                          </p>
                          {margin != null && (
                            <p style={{ fontSize: '10px', marginTop: '2px', fontWeight: belowCost ? '600' : '400', color: belowCost ? '#B43C3C' : thin ? 'var(--warm-gold)' : 'var(--success)' }}>
                              {belowCost
                                ? `⚠ Below cost (${formatHourly(margin)})`
                                : thin
                                  ? `Seraphyn earns ${formatHourly(margin)}, under the ${formatHourly(fee)} fee`
                                  : `Seraphyn earns ${formatHourly(margin)}`}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Assigned Nurse</p>
                        <select
                          value={shift.nurse_id || ''}
                          onChange={(e) => patchShift(shift.id, { nurse_id: e.target.value || null })}
                          style={{ width: '100%', maxWidth: '380px', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '13px', outline: 'none', fontFamily: 'DM Sans', color: 'var(--deep-navy)', background: 'white' }}
                        >
                          <option value="">Unassigned</option>
                          {nurseOptions.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.first_name} {n.last_name}
                              {n.specialty ? ` — ${n.specialty}` : ''}
                              {n.current_rate != null ? ` (${formatHourly(n.current_rate)})` : ' (no rate set)'}
                            </option>
                          ))}
                        </select>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '5px' }}>
                          Assigning a nurse prefills their pay from their current rate and snapshots it onto this shift.
                        </p>
                      </div>
                    </div>
                  )
                })()}

                {shift.notes && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', fontStyle: 'italic' }}>"{shift.notes}"</p>
                )}

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {shift.status === 'open' && (
                    <>
                      <button onClick={() => updateStatus(shift.id, 'filled')} disabled={actionLoading === shift.id}
                        style={{ padding: '6px 12px', background: 'rgba(126,181,200,0.12)', color: 'var(--sky-blue)', border: 'none', borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontWeight: '500' }}>
                        Mark Filled
                      </button>
                      <button onClick={() => updateStatus(shift.id, 'cancelled')} disabled={actionLoading === shift.id}
                        style={{ padding: '6px 12px', background: 'rgba(180,60,60,0.1)', color: '#B43C3C', border: 'none', borderRadius: '2px', fontSize: '11px', cursor: 'pointer' }}>
                        Cancel Shift
                      </button>
                    </>
                  )}
                  {shift.status === 'filled' && (
                    <button onClick={() => updateStatus(shift.id, 'completed')} disabled={actionLoading === shift.id}
                      style={{ padding: '6px 12px', background: 'rgba(45,122,79,0.1)', color: 'var(--success)', border: 'none', borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontWeight: '500' }}>
                      ✓ Mark Completed
                    </button>
                  )}
                  <input
                    defaultValue={shift.admin_notes || ''}
                    onBlur={e => updateAdminNote(shift.id, e.target.value)}
                    placeholder="Admin note..."
                    style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '12px', outline: 'none', fontFamily: 'DM Sans', color: 'var(--deep-navy)', flex: 1, minWidth: '160px' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
