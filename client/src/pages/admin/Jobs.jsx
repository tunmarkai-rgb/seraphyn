import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/AdminLayout'

export default function AdminJobs() {
  const [jobs, setJobs] = useState([])
  const [filter, setFilter] = useState('active')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => { loadJobs() }, [filter])

  async function loadJobs() {
    setLoading(true)
    const query = supabase
      .from('jobs')
      .select('*, employer_profiles(org_name, city, state)')
      .order('created_at', { ascending: false })
    if (filter !== 'all') query.eq('status', filter)
    const { data } = await query
    setJobs(data || [])
    setLoading(false)
  }

  async function updateStatus(jobId, status) {
    setActionLoading(jobId)
    await supabase.from('jobs').update({ status }).eq('id', jobId)
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status } : j))
    setActionLoading(null)
  }

  const STATUS_COLORS = {
    active:  { label: 'Active',  bg: 'rgba(45,122,79,0.1)',    color: 'var(--success)' },
    paused:  { label: 'Paused',  bg: 'rgba(200,169,110,0.12)', color: 'var(--warm-gold)' },
    filled:  { label: 'Filled',  bg: 'rgba(126,181,200,0.12)', color: 'var(--sky-blue)' },
    closed:  { label: 'Closed',  bg: 'rgba(90,107,122,0.12)',  color: 'var(--text-muted)' },
  }

  return (
    <AdminLayout title="Job Listings">
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {[['all','All'],['active','Active'],['paused','Paused'],['filled','Filled'],['closed','Closed']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            style={{ padding: '7px 16px', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer', border: filter === val ? '1px solid var(--deep-navy)' : '1px solid var(--border)', background: filter === val ? 'var(--deep-navy)' : 'white', color: filter === val ? 'white' : 'var(--text-muted)' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : jobs.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '60px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>No jobs found.</p>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--warm-white)' }}>
                {['Job Title', 'Organization', 'Location', 'Specialty', 'Pay', 'Status', 'Posted', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: '500', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => {
                const s = STATUS_COLORS[job.status] || STATUS_COLORS.closed
                return (
                  <tr key={job.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--deep-navy)' }}>{job.title}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{job.shift_type} · {job.contract_length}</p>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--deep-navy)' }}>{job.employer_profiles?.org_name}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{job.city}, {job.state}</td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>{job.specialty}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--deep-navy)', fontFamily: 'Cormorant Garamond, serif' }}>
                      {job.pay_rate ? `$${job.pay_rate}/hr` : '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '2px', fontSize: '10px', fontWeight: '500', background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {job.status !== 'active' && (
                          <button onClick={() => updateStatus(job.id, 'active')} disabled={actionLoading === job.id}
                            style={{ padding: '5px 10px', background: 'rgba(45,122,79,0.1)', color: 'var(--success)', border: 'none', borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontWeight: '500' }}>
                            Activate
                          </button>
                        )}
                        {job.status === 'active' && (
                          <button onClick={() => updateStatus(job.id, 'paused')} disabled={actionLoading === job.id}
                            style={{ padding: '5px 10px', background: 'rgba(200,169,110,0.12)', color: 'var(--warm-gold)', border: 'none', borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontWeight: '500' }}>
                            Pause
                          </button>
                        )}
                        <button onClick={() => updateStatus(job.id, 'closed')} disabled={actionLoading === job.id}
                          style={{ padding: '5px 10px', background: 'rgba(90,107,122,0.1)', color: 'var(--text-muted)', border: 'none', borderRadius: '2px', fontSize: '11px', cursor: 'pointer' }}>
                          Close
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
