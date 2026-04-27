import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { apiRequest } from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import StatusBadge from '../../components/StatusBadge'

export default function AdminNurses() {
  const [allNurses, setAllNurses] = useState([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [feedback, setFeedback] = useState('')

  const nurses = filter === 'all' ? allNurses : allNurses.filter(n => n.users?.status === filter)

  useEffect(() => { loadNurses() }, [])

  async function loadNurses() {
    setLoading(true)
    const { data } = await supabase
      .from('nurse_profiles')
      .select('*, users!inner(id, email, status, full_name, created_at)')
      .order('created_at', { ascending: false })
    setAllNurses(data || [])
    setLoading(false)
  }

  async function approve(nurseId) {
    setActionLoading(nurseId)
    setFeedback('')
    try {
      await apiRequest(`/api/admin/nurses/${nurseId}/approve`, { method: 'PUT' })
      await loadNurses()
      setFeedback('Nurse approved successfully.')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function reject(userId, nurseId) {
    setActionLoading(nurseId)
    await supabase.from('users').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', userId)
    await loadNurses()
    setActionLoading(null)
  }

  async function suspend(userId, nurseId) {
    setActionLoading(nurseId)
    await supabase.from('users').update({ status: 'suspended', updated_at: new Date().toISOString() }).eq('id', userId)
    await loadNurses()
    setActionLoading(null)
  }

  const counts = allNurses.reduce((acc, n) => { acc[n.users?.status] = (acc[n.users?.status] || 0) + 1; return acc }, {})

  return (
    <AdminLayout title="Nurse Management">
      {feedback && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--deep-navy)', fontSize: '13px' }}>
          {feedback}
        </div>
      )}
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {[['all','All'],['pending','Pending'],['approved','Approved'],['rejected','Rejected'],['suspended','Suspended']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            style={{ padding: '7px 16px', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer', border: filter === val ? '1px solid var(--deep-navy)' : '1px solid var(--border)', background: filter === val ? 'var(--deep-navy)' : 'white', color: filter === val ? 'white' : 'var(--text-muted)', transition: 'all 0.15s' }}>
            {label} {val !== 'all' && counts[val] ? `(${counts[val]})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : nurses.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '60px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>No nurses found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {nurses.map(nurse => {
            const isExp = expanded === nurse.id
            const status = nurse.users?.status
            return (
              <div key={nurse.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', cursor: 'pointer' }}
                  onClick={() => setExpanded(isExp ? null : nurse.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--deep-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px' }}>
                      {nurse.first_name?.[0]}{nurse.last_name?.[0]}
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--deep-navy)' }}>{nurse.first_name} {nurse.last_name}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{nurse.users?.email} · {nurse.specialty}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <StatusBadge status={status} />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{isExp ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isExp && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '20px' }}>
                    <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                      {[
                        ['Specialty', nurse.specialty],
                        ['License No.', nurse.license_number],
                        ['License State', nurse.license_state],
                        ['Experience', nurse.years_experience ? `${nurse.years_experience} years` : '—'],
                        ['Shift Preference', nurse.shift_preference || '—'],
                        ['Availability', nurse.availability || '—'],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '3px' }}>{label}</p>
                          <p style={{ fontSize: '13px', color: 'var(--deep-navy)' }}>{val || '—'}</p>
                        </div>
                      ))}
                    </div>
                    {nurse.bio && (
                      <div style={{ marginBottom: '16px' }}>
                        <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Bio</p>
                        <p style={{ fontSize: '13px', color: 'var(--deep-navy)', lineHeight: '1.6' }}>{nurse.bio}</p>
                      </div>
                    )}
                    {(nurse.certifications || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                        {nurse.certifications.map((c, i) => (
                          <span key={i} style={{ padding: '3px 8px', background: 'rgba(126,181,200,0.1)', borderRadius: '2px', fontSize: '11px', color: 'var(--sky-blue)' }}>{c}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {nurse.resume_url && (
                        <a href={nurse.resume_url} target="_blank" rel="noreferrer"
                          style={{ padding: '8px 16px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          📄 View Resume
                        </a>
                      )}
                      {nurse.license_url && (
                        <a href={nurse.license_url} target="_blank" rel="noreferrer"
                          style={{ padding: '8px 16px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          🪪 View License
                        </a>
                      )}
                      {status !== 'approved' && (
                        <button onClick={() => approve(nurse.id)} disabled={actionLoading === nurse.id}
                          style={{ padding: '8px 16px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                          {actionLoading === nurse.id ? '...' : '✓ Approve'}
                        </button>
                      )}
                      {status !== 'rejected' && status !== 'approved' && (
                        <button onClick={() => reject(nurse.users?.id, nurse.id)} disabled={actionLoading === nurse.id}
                          style={{ padding: '8px 16px', background: 'rgba(180,60,60,0.9)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                          ✗ Reject
                        </button>
                      )}
                      {status === 'approved' && (
                        <button onClick={() => suspend(nurse.users?.id, nurse.id)} disabled={actionLoading === nurse.id}
                          style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          Suspend
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
