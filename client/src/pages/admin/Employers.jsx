import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/AdminLayout'
import StatusBadge from '../../components/StatusBadge'

export default function AdminEmployers() {
  const [allEmployers, setAllEmployers] = useState([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const employers = filter === 'all' ? allEmployers : allEmployers.filter(e => e.users?.status === filter)

  useEffect(() => { loadEmployers() }, [])

  async function loadEmployers() {
    setLoading(true)
    const { data } = await supabase
      .from('employer_profiles')
      .select('*, users!inner(id, email, status, full_name, created_at)')
      .order('created_at', { ascending: false })
    setAllEmployers(data || [])
    setLoading(false)
  }

  async function approve(userId, empId) {
    setActionLoading(empId)
    await supabase.from('users').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', userId)
    await supabase.from('employer_profiles').update({
      approved_at: new Date().toISOString(),
      onboarding_stage: 3
    }).eq('id', empId)
    await loadEmployers()
    setActionLoading(null)
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

  const counts = allEmployers.reduce((acc, e) => { acc[e.users?.status] = (acc[e.users?.status] || 0) + 1; return acc }, {})

  return (
    <AdminLayout title="Employer Management">
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
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stage {emp.onboarding_stage || 1}/3</span>
                    {emp.contract_signed && <span style={{ fontSize: '11px', color: 'var(--success)' }}>✓ Contract Signed</span>}
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
                        ['Contract Signed', emp.contract_signed ? `Yes — ${emp.contract_signed_at ? new Date(emp.contract_signed_at).toLocaleDateString() : ''}` : 'No'],
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
                    {emp.signed_url && (
                      <div style={{ marginBottom: '16px' }}>
                        <a href={emp.signed_url} target="_blank" rel="noreferrer"
                          style={{ padding: '8px 16px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          📄 View Signed Contract
                        </a>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {status !== 'approved' && emp.contract_signed && (
                        <button onClick={() => approve(emp.users?.id, emp.id)} disabled={actionLoading === emp.id}
                          style={{ padding: '8px 16px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                          {actionLoading === emp.id ? '...' : '✓ Approve'}
                        </button>
                      )}
                      {status !== 'approved' && !emp.contract_signed && (
                        <span style={{ fontSize: '12px', color: 'var(--warm-gold)', padding: '8px 0' }}>⏳ Awaiting contract signature before approval</span>
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
