import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { apiRequest } from '../../lib/api'
import { formatHourly } from '../../lib/format'

// The nurse sees only requests an admin has presented, with the pay offered
// to them for that assignment.
function formatDate(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_COPY = {
  presented: { label: 'Action Needed', bg: 'rgba(201,169,110,0.16)', fg: 'var(--warm-gold)' },
  nurse_accepted: { label: 'You Accepted', bg: 'rgba(45,122,79,0.1)', fg: 'var(--success)' },
  nurse_declined: { label: 'You Declined', bg: 'rgba(44,62,80,0.06)', fg: 'var(--text-muted)' },
  placed: { label: 'Placed', bg: 'rgba(45,122,79,0.16)', fg: 'var(--success)' }
}

export default function NurseRequests() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [decliningId, setDecliningId] = useState(null)
  const [declineNote, setDeclineNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRequests(await apiRequest('/api/nurses/self/requests') || [])
    } catch (loadError) {
      setError(loadError.message)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function respond(id, accept, note = '') {
    setBusy(id)
    setError('')
    try {
      const updated = await apiRequest(`/api/nurses/self/requests/${id}/respond`, {
        method: 'POST',
        body: { accept, note }
      })
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)))
      setDecliningId(null)
      setDeclineNote('')
    } catch (respondError) {
      setError(respondError.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />

      <div style={{ background: 'var(--deep-navy)', padding: '80px 5% 40px', marginTop: '72px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '12px' }}>Nurse Portal</p>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: '300', color: 'var(--warm-white)', marginBottom: '10px' }}>
            Assignment <em style={{ fontStyle: 'italic', color: 'var(--warm-gold)' }}>Requests</em>
          </h1>
          <p style={{ fontSize: '15px', color: 'rgba(245,245,240,0.6)', fontWeight: '300' }}>
            Facilities that asked for you by name.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 24px 60px' }}>
        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(180,60,60,0.08)', border: '1px solid rgba(180,60,60,0.3)', borderRadius: '2px', fontSize: '13px', color: '#B43C3C', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>
        ) : requests.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '56px', textAlign: 'center' }}>
            <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              No requests yet. Facilities find you through the Seraphyn directory.
            </p>
            <Link to="/nurse/profile" style={{ fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sky-blue)', textDecoration: 'none', fontWeight: '500' }}>
              Keep your profile current &rarr;
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {requests.map((request) => {
              const tone = STATUS_COPY[request.status] || STATUS_COPY.presented
              const awaiting = request.awaiting_response
              const isBusy = busy === request.id

              return (
                <div
                  key={request.id}
                  style={{ background: 'white', border: '1px solid var(--border)', borderLeft: awaiting ? '3px solid var(--warm-gold)' : '1px solid var(--border)', borderRadius: '4px', padding: '22px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '19px', color: 'var(--deep-navy)', marginBottom: '3px' }}>
                        {request.facility_name || 'A Seraphyn client is requesting you'}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {request.engagement_type === 'contract' ? 'Contract' : 'Per Diem'}
                        {request.specialty ? ` · ${request.specialty}` : ''}
                        {request.city ? ` · ${request.city}, ${request.state}` : ''}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {request.start_date ? `Starts ${formatDate(request.start_date)}` : ''}
                        {request.end_date ? ` – ${formatDate(request.end_date)}` : ''}
                        {request.hours_per_week ? ` · roughly ${request.hours_per_week} hrs/week` : ''}
                        {request.shift_type ? ` · ${request.shift_type} shifts` : ''}
                      </p>
                    </div>
                    <span style={{ padding: '5px 11px', background: tone.bg, color: tone.fg, borderRadius: '999px', fontSize: '10px', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      {tone.label}
                    </span>
                  </div>

                  <div style={{ padding: '12px 0', marginBottom: '12px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--warm-gold)', fontWeight: '500', marginBottom: '4px' }}>
                      Your Rate For This Assignment
                    </p>
                    <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', fontWeight: '500', color: 'var(--deep-navy)' }}>
                      {formatHourly(request.offered_nurse_rate, { empty: 'Your coordinator will confirm' })}
                    </p>
                  </div>

                  {request.employer_note && (
                    <p style={{ fontSize: '13px', color: 'var(--deep-navy)', lineHeight: 1.6, marginBottom: '14px', fontStyle: 'italic' }}>
                      &ldquo;{request.employer_note}&rdquo;
                    </p>
                  )}

                  {awaiting ? (
                    decliningId === request.id ? (
                      <div>
                        <textarea
                          rows="2" value={declineNote} onChange={(e) => setDeclineNote(e.target.value)}
                          placeholder="Anything your coordinator should know? (optional)"
                          style={{ width: '100%', padding: '10px 12px', background: 'var(--warm-white)', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '13px', color: 'var(--deep-navy)', outline: 'none', fontFamily: 'DM Sans, sans-serif', resize: 'vertical', marginBottom: '10px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button" onClick={() => respond(request.id, false, declineNote)} disabled={isBusy}
                            style={{ padding: '9px 16px', background: '#B43C3C', color: 'white', border: 'none', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '600', cursor: isBusy ? 'not-allowed' : 'pointer' }}
                          >
                            {isBusy ? 'Sending...' : 'Confirm Decline'}
                          </button>
                          <button
                            type="button" onClick={() => { setDecliningId(null); setDeclineNote('') }}
                            style={{ padding: '9px 16px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <button
                          type="button" onClick={() => respond(request.id, true)} disabled={isBusy}
                          style={{ padding: '10px 18px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '600', cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy ? 0.6 : 1 }}
                        >
                          {isBusy ? 'Sending...' : 'Accept Request'}
                        </button>
                        <button
                          type="button" onClick={() => setDecliningId(request.id)} disabled={isBusy}
                          style={{ padding: '10px 18px', background: 'transparent', color: 'var(--deep-navy)', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                        >
                          Decline
                        </button>
                        <button
                          type="button" onClick={() => navigate('/messages')}
                          style={{ padding: '10px 18px', background: 'transparent', color: 'var(--sky-blue)', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                        >
                          Ask A Question
                        </button>
                      </div>
                    )
                  ) : (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {request.status === 'nurse_accepted' && request.responded_at && `You accepted on ${formatDate(request.responded_at)}.`}
                      {request.status === 'nurse_declined' && request.responded_at && `You declined on ${formatDate(request.responded_at)}.`}
                      {request.status === 'placed' && request.placed_at && `Placed on ${formatDate(request.placed_at)}.`}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
