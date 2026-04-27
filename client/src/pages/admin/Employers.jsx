import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { apiRequest } from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import StatusBadge from '../../components/StatusBadge'

export default function AdminEmployers() {
  const [allEmployers, setAllEmployers] = useState([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [feedback, setFeedback] = useState('')

  const employers = filter === 'all' ? allEmployers : allEmployers.filter(e => e.users?.status === filter)

  useEffect(() => { loadEmployers() }, [])

  async function loadEmployers() {
    setLoading(true)
    const { data } = await supabase
      .from('employer_profiles')
      .select('*, users!inner(id, email, status, full_name, created_at), contracts(signed_url, status, signed_at, sent_at)')
      .order('created_at', { ascending: false })
    setAllEmployers(data || [])
    setLoading(false)
  }

  async function approve(empId) {
    setActionLoading(empId)
    setFeedback('')
    try {
      await apiRequest(`/api/admin/employers/${empId}/approve`, { method: 'PUT' })
      await loadEmployers()
      setFeedback('Employer approved successfully.')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function reject(userId, empId) {
    setActionLoading(empId)
    await supabase.from('users').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', userId)
    await loadEmployers()
    setActionLoading(null)
  }

  async function suspend(userId, empId) {
    setActionLoading(empId)
    await supabase.from('users').update({ status: 'suspended', updated_at: new Date().toISOString() }).eq('id', userId)
    await loadEmployers()
    setActionLoading(null)
  }

  async function sendContract(empId) {
    setActionLoading(empId)
    setFeedback('')
    try {
      await apiRequest(`/api/admin/employers/${empId}/send-contract`, { method: 'POST' })
      await loadEmployers()
      setFeedback('Contract sent successfully.')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function syncContact(empId) {
    setActionLoading(empId)
    setFeedback('')
    try {
      await apiRequest(`/api/admin/employers/${empId}/sync-contact`, { method: 'POST' })
      await loadEmployers()
      setFeedback('Employer contact synced to GHL.')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setActionLoading(null)
    }
  }

  const counts = allEmployers.reduce((acc, e) => { acc[e.users?.status] = (acc[e.users?.status] || 0) + 1; return acc }, {})

  return (
    <AdminLayout title="Employer Management">
      {feedback && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--deep-navy)', fontSize: '13px' }}>
          {feedback}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {[['all','All'],['pending','Pending'],['approved','Approved'],['rejected','Rejected'],['suspended','Suspended']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            style={{ padding: '7px 16px', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer', border: filter === val ? '1px solid var(--deep-navy)' : '1px solid var(--border)', background: filter === val ? 'var(--deep-navy)' : 'white', color: filter === val ? 'white' : 'var(--text-muted)' }}>
            {label} {val !== 'all' && counts[val] ? `(${counts[val]})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : employers.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '60px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>No employers found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {employers.map(emp => {
            const isExp = expanded === emp.id
            const status = emp.users?.status
            return (
              <div key={emp.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', cursor: 'pointer' }}
                  onClick={() => setExpanded(isExp ? null : emp.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'var(--warm-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px' }}>
                      {emp.org_name?.[0]}
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--deep-navy)' }}>{emp.org_name}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{emp.org_type} · {emp.city}, {emp.state}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stage {({ profile: 1, contract: 2, approved: 3 })[emp.onboarding_stage] || 1}/3</span>
                    <StatusBadge status={status} />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{isExp ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isExp && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '20px' }}>
                    <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                      {[
                        ['Contact', emp.contact_name],
                        ['Title', emp.contact_title || '—'],
                        ['Email', emp.users?.email],
                        ['Location', `${emp.city}, ${emp.state}`],
                        ['Beds', emp.bed_count || '—'],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '3px' }}>{label}</p>
                          <p style={{ fontSize: '13px', color: 'var(--deep-navy)' }}>{val || '—'}</p>
                        </div>
                      ))}
                    </div>
                    {emp.description && (
                      <div style={{ marginBottom: '16px' }}>
                        <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Description</p>
                        <p style={{ fontSize: '13px', color: 'var(--deep-navy)', lineHeight: '1.6' }}>{emp.description}</p>
                      </div>
                    )}
                    <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--warm-white)', borderRadius: '4px' }}>
                      <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Contract</p>
                      <p style={{ fontSize: '13px', color: 'var(--deep-navy)', marginBottom: '4px' }}>
                        {emp.contract_signed
                          ? 'Signed'
                          : emp.contracts?.[0]?.status === 'sent'
                            ? 'Sent - awaiting signature'
                            : 'Not sent yet'}
                      </p>
                      {emp.contracts?.[0]?.sent_at && (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Sent {new Date(emp.contracts[0].sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                        {emp.ghl_contact_id ? 'GHL contact synced' : 'GHL contact not synced yet'}
                      </p>
                    </div>
                    {emp.contracts?.[0]?.signed_url && (
                      <div style={{ marginBottom: '16px' }}>
                        <a href={emp.contracts[0].signed_url} target="_blank" rel="noreferrer"
                          style={{ padding: '8px 16px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          📄 View Signed Contract
                        </a>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {!emp.contract_signed && status !== 'approved' && (
                        <button onClick={() => syncContact(emp.id)} disabled={actionLoading === emp.id}
                          style={{ padding: '8px 16px', background: 'white', color: 'var(--deep-navy)', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                          {actionLoading === emp.id ? '...' : emp.ghl_contact_id ? 'Re-sync GHL Contact' : 'Sync GHL Contact'}
                        </button>
                      )}
                      {!emp.contract_signed && status !== 'approved' && (
                        <button onClick={() => sendContract(emp.id)} disabled={actionLoading === emp.id}
                          style={{ padding: '8px 16px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                          {actionLoading === emp.id ? '...' : emp.contracts?.[0]?.status === 'sent' ? 'Resend Contract' : 'Send Contract'}
                        </button>
                      )}
                      {status !== 'approved' && (
                        <button onClick={() => approve(emp.id)} disabled={actionLoading === emp.id || !emp.contract_signed}
                          style={{ padding: '8px 16px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                          {actionLoading === emp.id ? '...' : '✓ Approve'}
                        </button>
                      )}
                      {status !== 'rejected' && status !== 'approved' && (
                        <button onClick={() => reject(emp.users?.id, emp.id)} disabled={actionLoading === emp.id}
                          style={{ padding: '8px 16px', background: 'rgba(180,60,60,0.9)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                          ✗ Reject
                        </button>
                      )}
                      {status === 'approved' && (
                        <button onClick={() => suspend(emp.users?.id, emp.id)} disabled={actionLoading === emp.id}
                          style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          Suspend
                        </button>
                      )}
                      {!emp.contract_signed && status !== 'approved' && (
                        <p style={{ width: '100%', fontSize: '12px', color: 'var(--text-muted)' }}>
                          Approval unlocks after the signed agreement webhook comes back from GHL.
                        </p>
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
