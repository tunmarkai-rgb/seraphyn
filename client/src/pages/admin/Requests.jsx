import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { apiRequest } from '../../lib/api'
import { formatHourly } from '../../lib/format'

const STATUS_TONE = {
  submitted: { bg: 'rgba(126,181,200,0.12)', fg: 'var(--sky-blue)', label: 'Submitted' },
  reviewing: { bg: 'rgba(126,181,200,0.18)', fg: 'var(--sky-blue)', label: 'Reviewing' },
  presented: { bg: 'rgba(201,169,110,0.16)', fg: 'var(--warm-gold)', label: 'Presented' },
  nurse_accepted: { bg: 'rgba(45,122,79,0.1)', fg: 'var(--success)', label: 'Nurse Accepted' },
  nurse_declined: { bg: 'rgba(180,60,60,0.08)', fg: '#B43C3C', label: 'Nurse Declined' },
  placed: { bg: 'rgba(45,122,79,0.16)', fg: 'var(--success)', label: 'Placed' },
  rejected: { bg: 'rgba(180,60,60,0.08)', fg: '#B43C3C', label: 'Rejected' },
  closed: { bg: 'rgba(44,62,80,0.06)', fg: 'var(--text-muted)', label: 'Closed' }
}

const FILTERS = ['all', 'submitted', 'reviewing', 'presented', 'nurse_accepted', 'placed', 'closed']

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(null)
  const [drafts, setDrafts] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRequests(await apiRequest('/api/admin/nurse-requests') || [])
    } catch (loadError) {
      setError(loadError.message)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(
    () => (filter === 'all' ? requests : requests.filter((r) => r.status === filter)),
    [requests, filter]
  )

  function draftFor(request) {
    return drafts[request.id] || {
      offered_nurse_rate: request.offered_nurse_rate != null ? String(request.offered_nurse_rate) : '',
      admin_notes: request.admin_notes || '',
      employer_visible_to_nurse: Boolean(request.employer_visible_to_nurse)
    }
  }

  function setDraft(id, patch) {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }))
  }

  function replace(updated) {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[updated.id]
      return next
    })
  }

  async function call(id, path, options) {
    setBusy(id)
    setError('')
    try {
      replace(await apiRequest(path, options))
    } catch (callError) {
      setError(callError.message)
    } finally {
      setBusy(null)
    }
  }

  async function saveFields(request) {
    const d = draftFor(request)
    await call(request.id, `/api/admin/nurse-requests/${request.id}`, {
      method: 'PUT',
      body: {
        offered_nurse_rate: d.offered_nurse_rate === '' ? null : Number(d.offered_nurse_rate),
        admin_notes: d.admin_notes,
        employer_visible_to_nurse: d.employer_visible_to_nurse
      }
    })
  }

  async function changeStatus(request, status) {
    await call(request.id, `/api/admin/nurse-requests/${request.id}`, {
      method: 'PUT',
      body: { status }
    })
  }

  async function present(request) {
    const d = draftFor(request)
    await call(request.id, `/api/admin/nurse-requests/${request.id}/present`, {
      method: 'POST',
      body: {
        offered_nurse_rate: d.offered_nurse_rate === '' ? null : Number(d.offered_nurse_rate),
        employer_visible_to_nurse: d.employer_visible_to_nurse
      }
    })
  }

  const cellLabel = { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }
  const cellValue = { fontFamily: 'Cormorant Garamond, serif', fontSize: '19px', fontWeight: '500', color: 'var(--deep-navy)', lineHeight: 1.2 }
  const inputStyle = { width: '100%', padding: '8px 10px', background: 'white', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '13px', color: 'var(--deep-navy)', outline: 'none', fontFamily: 'DM Sans, sans-serif' }

  return (
    <AdminLayout title="Nurse Requests">
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(180,60,60,0.08)', border: '1px solid rgba(180,60,60,0.3)', borderRadius: '2px', fontSize: '13px', color: '#B43C3C', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
        {FILTERS.map((option) => {
          const active = filter === option
          const count = option === 'all' ? requests.length : requests.filter((r) => r.status === option).length
          return (
            <button
              key={option} type="button" onClick={() => setFilter(option)}
              style={{ padding: '7px 14px', background: active ? 'var(--deep-navy)' : 'white', color: active ? 'white' : 'var(--text-muted)', border: `1px solid ${active ? 'var(--deep-navy)' : 'var(--border)'}`, borderRadius: '999px', fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              {option === 'all' ? 'All' : STATUS_TONE[option]?.label || option} ({count})
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '56px', textAlign: 'center' }}>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)' }}>No nurse requests here yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filtered.map((request) => {
            const tone = STATUS_TONE[request.status] || STATUS_TONE.submitted
            const d = draftFor(request)
            const isBusy = busy === request.id
            const nurseRate = d.offered_nurse_rate === '' ? null : Number(d.offered_nurse_rate)
            const quoted = request.quoted_bill_rate
            const liveMargin = nurseRate != null && quoted != null
              ? Math.round((Number(quoted) - nurseRate) * 100) / 100
              : null
            const canPresent = (request.allowed_transitions || []).includes('presented')

            return (
              <div key={request.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                  <div>
                    <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '19px', color: 'var(--deep-navy)', marginBottom: '3px' }}>
                      {request.employer_org || 'Employer'} &rarr; {request.nurse_name || 'Nurse'}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {request.engagement_type === 'contract' ? 'Contract' : 'Per Diem'}
                      {request.nurse_specialty ? ` · ${request.nurse_specialty}` : ''}
                      {` · starts ${formatDate(request.start_date)}`}
                      {request.city ? ` · ${request.city}, ${request.state}` : ''}
                      {request.hours_per_week ? ` · ${request.hours_per_week} hrs/wk` : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ padding: '5px 11px', background: tone.bg, color: tone.fg, borderRadius: '999px', fontSize: '10px', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      {tone.label}
                    </span>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '5px' }}>
                      employer sees &ldquo;{request.employer_status_label}&rdquo;
                    </p>
                  </div>
                </div>

                {request.employer_note && (
                  <p style={{ fontSize: '13px', color: 'var(--deep-navy)', lineHeight: 1.6, marginBottom: '14px', fontStyle: 'italic' }}>
                    &ldquo;{request.employer_note}&rdquo;
                  </p>
                )}

                {/* Rate block: admin-only. Nurse pay, markup and bill rate together. */}
                <div style={{ padding: '16px', background: 'var(--warm-white)', border: '1px solid var(--border)', borderRadius: '2px', marginBottom: '14px' }}>
                  <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warm-gold)', fontWeight: '600', marginBottom: '14px' }}>
                    Rate &middot; Admin Only
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '14px' }}>
                    <div>
                      <p style={cellLabel}>Offer To Nurse</p>
                      <input
                        type="number" min="0" step="0.50" value={d.offered_nurse_rate}
                        onChange={(e) => setDraft(request.id, { offered_nurse_rate: e.target.value })}
                        style={inputStyle} placeholder="required to present"
                      />
                    </div>
                    <div>
                      <p style={cellLabel}>Markup At Quote</p>
                      <p style={cellValue}>{request.markup_pct_snapshot != null ? `${request.markup_pct_snapshot}%` : '—'}</p>
                    </div>
                    <div>
                      <p style={cellLabel}>Quoted Bill Rate</p>
                      <p style={cellValue}>{formatHourly(quoted, { empty: '—' })}</p>
                      {liveMargin != null && (
                        <p style={{ fontSize: '10px', marginTop: '2px', color: liveMargin > 0 ? 'var(--success)' : '#B43C3C' }}>
                          {liveMargin > 0
                            ? `margin ${formatHourly(liveMargin)}`
                            : `⚠ below cost (${formatHourly(liveMargin)})`}
                        </p>
                      )}
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--deep-navy)', cursor: 'pointer' }}>
                    <input
                      type="checkbox" checked={d.employer_visible_to_nurse}
                      onChange={(e) => setDraft(request.id, { employer_visible_to_nurse: e.target.checked })}
                    />
                    Show the facility name to the nurse
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'end', marginBottom: '12px' }}>
                  <div>
                    <p style={cellLabel}>Admin Note</p>
                    <input
                      value={d.admin_notes}
                      onChange={(e) => setDraft(request.id, { admin_notes: e.target.value })}
                      style={inputStyle} placeholder="Internal only"
                    />
                  </div>
                  <button
                    type="button" onClick={() => saveFields(request)} disabled={isBusy}
                    style={{ padding: '9px 16px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.6 : 1, whiteSpace: 'nowrap' }}
                  >
                    {isBusy ? 'Saving...' : 'Save'}
                  </button>
                </div>

                {request.nurse_response_note && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Nurse said: &ldquo;{request.nurse_response_note}&rdquo;
                  </p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                  {canPresent && (
                    <button
                      type="button" onClick={() => present(request)}
                      disabled={isBusy || !d.offered_nurse_rate}
                      title={!d.offered_nurse_rate ? 'Set the offered nurse rate first' : ''}
                      style={{ padding: '9px 16px', background: 'var(--warm-gold)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '600', cursor: isBusy || !d.offered_nurse_rate ? 'not-allowed' : 'pointer', opacity: isBusy || !d.offered_nurse_rate ? 0.5 : 1 }}
                    >
                      Present To Nurse
                    </button>
                  )}
                  {(request.allowed_transitions || [])
                    .filter((next) => next !== 'presented')
                    .map((next) => (
                      <button
                        key={next} type="button" onClick={() => changeStatus(request, next)} disabled={isBusy}
                        style={{ padding: '8px 14px', background: 'transparent', color: 'var(--deep-navy)', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', cursor: isBusy ? 'not-allowed' : 'pointer' }}
                      >
                        {STATUS_TONE[next]?.label || next}
                      </button>
                    ))}
                  {(request.allowed_transitions || []).length === 0 && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      This request is closed.
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
