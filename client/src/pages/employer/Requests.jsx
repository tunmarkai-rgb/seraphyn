import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { apiRequest } from '../../lib/api'
import { formatHourly } from '../../lib/format'
import { NURSE_REQUEST_STATUS_LABELS } from '../../lib/constants'

// Employers only ever see the coarse status label the server sends -- never
// the internal state, which would reveal whether the nurse has been asked yet.
const LABEL_TONE = {
  'In Review': { bg: 'rgba(126,181,200,0.12)', fg: 'var(--sky-blue)' },
  'Confirming Availability': { bg: 'rgba(201,169,110,0.15)', fg: 'var(--warm-gold)' },
  Placed: { bg: 'rgba(45,122,79,0.1)', fg: 'var(--success)' },
  'Not Available': { bg: 'rgba(180,60,60,0.08)', fg: '#B43C3C' },
  Withdrawn: { bg: 'rgba(44,62,80,0.06)', fg: 'var(--text-muted)' }
}

function formatDate(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function EmployerRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRequests(await apiRequest('/api/employers/nurse-requests') || [])
    } catch (loadError) {
      setError(loadError.message)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(
    () => (filter === 'all' ? requests : requests.filter((r) => r.status_label === filter)),
    [requests, filter]
  )

  async function withdraw(id) {
    setBusy(id)
    setError('')
    try {
      const updated = await apiRequest(`/api/employers/nurse-requests/${id}/withdraw`, {
        method: 'POST',
        body: { reason: 'Withdrawn by employer' }
      })
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)))
    } catch (withdrawError) {
      setError(withdrawError.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />

      <div style={{ background: 'var(--deep-navy)', padding: '80px 5% 40px', marginTop: '72px' }}>
        <div style={{ maxWidth: '980px', margin: '0 auto' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '12px' }}>Your Requests</p>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: '300', color: 'var(--warm-white)', marginBottom: '10px' }}>
            Nurse <em style={{ fontStyle: 'italic', color: 'var(--warm-gold)' }}>Requests</em>
          </h1>
          <p style={{ fontSize: '15px', color: 'rgba(245,245,240,0.6)', fontWeight: '300' }}>
            Your coordinator confirms availability and rate for every request.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '980px', margin: '0 auto', padding: '28px 24px 60px' }}>
        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(180,60,60,0.08)', border: '1px solid rgba(180,60,60,0.3)', borderRadius: '2px', fontSize: '13px', color: '#B43C3C', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '22px' }}>
          {['all', ...NURSE_REQUEST_STATUS_LABELS].map((option) => {
            const active = filter === option
            return (
              <button
                key={option} type="button" onClick={() => setFilter(option)}
                style={{ padding: '7px 14px', background: active ? 'var(--deep-navy)' : 'white', color: active ? 'white' : 'var(--text-muted)', border: `1px solid ${active ? 'var(--deep-navy)' : 'var(--border)'}`, borderRadius: '999px', fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                {option === 'all' ? 'All' : option}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '56px', textAlign: 'center' }}>
            <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              {requests.length === 0 ? 'You have not requested any nurses yet.' : 'No requests match this filter.'}
            </p>
            {requests.length === 0 && (
              <Link to="/nurses" style={{ fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sky-blue)', textDecoration: 'none', fontWeight: '500' }}>
                Browse nurses &rarr;
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filtered.map((request) => {
              const tone = LABEL_TONE[request.status_label] || LABEL_TONE['In Review']
              return (
                <div key={request.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                    <div>
                      <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '19px', color: 'var(--deep-navy)', marginBottom: '3px' }}>
                        {request.nurse_name || 'Nurse'}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {request.engagement_type === 'contract' ? 'Contract' : 'Per Diem'}
                        {request.nurse_specialty ? ` · ${request.nurse_specialty}` : ''}
                        {request.start_date ? ` · starts ${formatDate(request.start_date)}` : ''}
                        {request.city ? ` · ${request.city}, ${request.state}` : ''}
                      </p>
                    </div>
                    <span style={{ padding: '5px 11px', background: tone.bg, color: tone.fg, borderRadius: '999px', fontSize: '10px', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      {request.status_label}
                    </span>
                  </div>

                  {request.employer_note && (
                    <p style={{ fontSize: '13px', color: 'var(--deep-navy)', lineHeight: 1.6, marginBottom: '12px', fontStyle: 'italic' }}>
                      &ldquo;{request.employer_note}&rdquo;
                    </p>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                    <div>
                      <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--warm-gold)', fontWeight: '500', marginRight: '8px' }}>
                        Quoted Hospital Rate
                      </span>
                      <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '17px', color: 'var(--deep-navy)' }}>
                        {formatHourly(request.quoted_bill_rate, { empty: 'To be confirmed' })}
                      </span>
                      {request.quoted_nurse_pay != null && request.quoted_agency_fee != null && (
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {formatHourly(request.quoted_nurse_pay)} nurse pay + {formatHourly(request.quoted_agency_fee)} Seraphyn fee
                        </span>
                      )}
                    </div>
                    {request.can_withdraw && (
                      <button
                        type="button" onClick={() => withdraw(request.id)} disabled={busy === request.id}
                        style={{ padding: '7px 14px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', cursor: busy === request.id ? 'not-allowed' : 'pointer' }}
                      >
                        {busy === request.id ? 'Withdrawing...' : 'Withdraw Request'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
