import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiRequest } from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import StatusBadge from '../../components/StatusBadge'

export default function AdminNurses() {
  const [searchParams] = useSearchParams()
  const [allNurses, setAllNurses] = useState([])
  const [documentsByNurse, setDocumentsByNurse] = useState({})
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [feedback, setFeedback] = useState('')

  const nurses = filter === 'all' ? allNurses : allNurses.filter((nurse) => nurse.users?.status === filter)

  useEffect(() => {
    void loadNurses()
  }, [])

  useEffect(() => {
    const targetId = searchParams.get('open')
    if (!targetId || allNurses.length === 0) return
    const match = allNurses.find((nurse) => nurse.id === targetId)
    if (!match) return
    setExpanded(match.id)
    void loadDocuments(match.id)
  }, [searchParams, allNurses])

  async function loadNurses() {
    setLoading(true)
    setFeedback('')
    try {
      const data = await apiRequest('/api/admin/nurses')
      setAllNurses(data || [])
    } catch (error) {
      setFeedback(error.message)
      setAllNurses([])
    } finally {
      setLoading(false)
    }
  }

  async function loadDocuments(nurseId) {
    if (documentsByNurse[nurseId]) return
    try {
      const docs = await apiRequest(`/api/nurses/${nurseId}/documents`)
      setDocumentsByNurse((current) => ({ ...current, [nurseId]: docs || [] }))
    } catch (error) {
      setFeedback(error.message)
    }
  }

  async function downloadDocument(documentId) {
    try {
      const data = await apiRequest(`/api/nurses/documents/${documentId}/download`)
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      }
    } catch (error) {
      setFeedback(error.message)
    }
  }

  async function downloadPrimaryFile(nurseId, kind) {
    try {
      const data = await apiRequest(`/api/nurses/${nurseId}/files/${kind}/download`)
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      }
    } catch (error) {
      setFeedback(error.message)
    }
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

  async function updateNurseStatus(nurseId, status) {
    setActionLoading(nurseId)
    setFeedback('')
    try {
      await apiRequest(`/api/admin/nurses/${nurseId}/status`, {
        method: 'PUT',
        body: { status }
      })
      await loadNurses()
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setActionLoading(null)
    }
  }

  const counts = allNurses.reduce((accumulator, nurse) => {
    accumulator[nurse.users?.status] = (accumulator[nurse.users?.status] || 0) + 1
    return accumulator
  }, {})

  return (
    <AdminLayout title="Nurse Management">
      {feedback && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--deep-navy)', fontSize: '13px' }}>
          {feedback}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {[['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['suspended', 'Suspended']].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            style={{ padding: '7px 16px', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer', border: filter === value ? '1px solid var(--deep-navy)' : '1px solid var(--border)', background: filter === value ? 'var(--deep-navy)' : 'white', color: filter === value ? 'white' : 'var(--text-muted)', transition: 'all 0.15s' }}
          >
            {label} {value !== 'all' && counts[value] ? `(${counts[value]})` : ''}
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
          {nurses.map((nurse) => {
            const isExpanded = expanded === nurse.id
            const status = nurse.users?.status

            return (
              <div key={nurse.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', cursor: 'pointer' }}
                  onClick={() => {
                    setExpanded(isExpanded ? null : nurse.id)
                    if (!isExpanded) void loadDocuments(nurse.id)
                  }}
                >
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
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '20px' }}>
                    <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                      {[
                        ['Specialty', nurse.specialty],
                        ['License No.', nurse.license_number],
                        ['License State', nurse.license_state],
                        ['Experience', nurse.years_experience ? `${nurse.years_experience} years` : '-'],
                        ['Shift Preference', nurse.shift_preference || '-'],
                        ['Availability', nurse.availability || '-'],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '3px' }}>{label}</p>
                          <p style={{ fontSize: '13px', color: 'var(--deep-navy)' }}>{value || '-'}</p>
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
                        {nurse.certifications.map((certification, index) => (
                          <span key={index} style={{ padding: '3px 8px', background: 'rgba(126,181,200,0.1)', borderRadius: '2px', fontSize: '11px', color: 'var(--sky-blue)' }}>
                            {certification}
                          </span>
                        ))}
                      </div>
                    )}

                    {(documentsByNurse[nurse.id] || []).length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px' }}>Certification Files</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {documentsByNurse[nurse.id].map((doc) => (
                            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '4px' }}>
                              <div>
                                <p style={{ fontSize: '13px', color: 'var(--deep-navy)' }}>{doc.title}</p>
                              </div>
                              <button type="button" onClick={() => downloadDocument(doc.id)} style={{ padding: '8px 14px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', background: 'transparent', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                                View
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {nurse.users?.id && (
                        <a
                          href={`/messages?direct=${nurse.users.id}`}
                          onClick={(event) => {
                            event.stopPropagation()
                          }}
                          onMouseDown={(event) => event.stopPropagation()}
                          onPointerDown={(event) => event.stopPropagation()}
                          style={{ padding: '8px 16px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', background: 'transparent', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer' }}
                        >
                          Message Nurse
                        </a>
                      )}
                      {nurse.resume_url && (
                        <button type="button" onClick={() => downloadPrimaryFile(nurse.id, 'resume')} style={{ padding: '8px 16px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', background: 'transparent', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          View Resume
                        </button>
                      )}
                      {nurse.license_url && (
                        <button type="button" onClick={() => downloadPrimaryFile(nurse.id, 'license')} style={{ padding: '8px 16px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', background: 'transparent', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          View License
                        </button>
                      )}
                      {status !== 'approved' && (
                        <button onClick={() => approve(nurse.id)} disabled={actionLoading === nurse.id} style={{ padding: '8px 16px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                          {actionLoading === nurse.id ? '...' : 'Approve'}
                        </button>
                      )}
                      {status !== 'rejected' && status !== 'approved' && (
                        <button onClick={() => updateNurseStatus(nurse.id, 'rejected')} disabled={actionLoading === nurse.id} style={{ padding: '8px 16px', background: 'rgba(180,60,60,0.9)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                          Reject
                        </button>
                      )}
                      {status === 'approved' && (
                        <button onClick={() => updateNurseStatus(nurse.id, 'suspended')} disabled={actionLoading === nurse.id} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
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
