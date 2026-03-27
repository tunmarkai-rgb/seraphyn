import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/AdminLayout'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [pending, setPending] = useState({ nurses: [], employers: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [
      { count: totalNurses },
      { count: totalEmployers },
      { count: activeJobs },
      { count: totalApps },
      { count: pendingNurses },
      { count: pendingEmployers },
      { data: recentNurses },
      { data: recentEmployers },
    ] = await Promise.all([
      supabase.from('nurse_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('employer_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('applications').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'nurse').eq('status', 'pending'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'employer').eq('status', 'pending'),
      supabase.from('nurse_profiles').select('*, users(email, status)').order('created_at', { ascending: false }).limit(3),
      supabase.from('employer_profiles').select('*, users(email, status)').order('created_at', { ascending: false }).limit(3),
    ])

    setStats({ totalNurses, totalEmployers, activeJobs, totalApps, pendingNurses, pendingEmployers })
    setPending({ nurses: recentNurses || [], employers: recentEmployers || [] })
    setLoading(false)
  }

  const statCards = stats ? [
    { label: 'Total Nurses',       value: stats.totalNurses,     icon: '👩‍⚕️', color: 'var(--sky-blue)',  link: '/admin/nurses' },
    { label: 'Total Employers',    value: stats.totalEmployers,  icon: '🏥', color: 'var(--warm-gold)', link: '/admin/employers' },
    { label: 'Active Jobs',        value: stats.activeJobs,      icon: '📋', color: 'var(--success)',   link: '/admin/jobs' },
    { label: 'Total Applications', value: stats.totalApps,       icon: '📨', color: 'var(--sky-blue)',  link: '/admin/applications' },
    { label: 'Nurses Pending',     value: stats.pendingNurses,   icon: '⏳', color: stats.pendingNurses > 0 ? 'var(--warm-gold)' : 'var(--text-muted)', link: '/admin/nurses', urgent: stats.pendingNurses > 0 },
    { label: 'Employers Pending',  value: stats.pendingEmployers,icon: '⏳', color: stats.pendingEmployers > 0 ? 'var(--warm-gold)' : 'var(--text-muted)', link: '/admin/employers', urgent: stats.pendingEmployers > 0 },
  ] : []

  return (
    <AdminLayout title="Platform Overview">
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading dashboard...</div>
      ) : (
        <>
          {(stats?.pendingNurses > 0 || stats?.pendingEmployers > 0) && (
            <div style={{ background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.3)', borderRadius: '4px', padding: '14px 20px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>🔔</span>
              <p style={{ fontSize: '13px', color: 'var(--deep-navy)' }}>
                You have <strong>{stats.pendingNurses} nurse{stats.pendingNurses !== 1 ? 's' : ''}</strong> and <strong>{stats.pendingEmployers} employer{stats.pendingEmployers !== 1 ? 's' : ''}</strong> awaiting approval.
              </p>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                {stats.pendingNurses > 0 && <Link to="/admin/nurses" style={{ padding: '6px 12px', background: 'var(--deep-navy)', color: 'white', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500' }}>Review Nurses</Link>}
                {stats.pendingEmployers > 0 && <Link to="/admin/employers" style={{ padding: '6px 12px', background: 'var(--warm-gold)', color: 'white', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500' }}>Review Employers</Link>}
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
            {statCards.map((s, i) => (
              <Link key={i} to={s.link} style={{ textDecoration: 'none', display: 'block', background: 'white', border: s.urgent ? '1px solid rgba(200,169,110,0.4)' : '1px solid var(--border)', borderRadius: '4px', padding: '20px', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{ fontSize: '22px', marginBottom: '10px' }}>{s.icon}</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '36px', fontWeight: '300', color: s.color, lineHeight: 1, marginBottom: '6px' }}>{s.value ?? '—'}</div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{s.label}</div>
              </Link>
            ))}
          </div>

          {/* Recent registrations */}
          <div className="dash-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

            {/* Recent nurses */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--deep-navy)' }}>Recent Nurses</h3>
                <Link to="/admin/nurses" style={{ fontSize: '12px', color: 'var(--sky-blue)' }}>View all →</Link>
              </div>
              {pending.nurses.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No nurses yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {pending.nurses.map(n => (
                    <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--deep-navy)' }}>{n.first_name} {n.last_name}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{n.specialty}</p>
                      </div>
                      <StatusBadge status={n.users?.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent employers */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--deep-navy)' }}>Recent Employers</h3>
                <Link to="/admin/employers" style={{ fontSize: '12px', color: 'var(--sky-blue)' }}>View all →</Link>
              </div>
              {pending.employers.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No employers yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {pending.employers.map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--deep-navy)' }}>{e.org_name}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{e.org_type} · {e.city}, {e.state}</p>
                      </div>
                      <StatusBadge status={e.users?.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  )
}

function StatusBadge({ status }) {
  const cfg = {
    pending:   { label: 'Pending',   bg: 'rgba(200,169,110,0.12)', color: 'var(--warm-gold)' },
    approved:  { label: 'Approved',  bg: 'rgba(45,122,79,0.1)',    color: 'var(--success)' },
    rejected:  { label: 'Rejected',  bg: 'rgba(180,60,60,0.1)',    color: '#B43C3C' },
    suspended: { label: 'Suspended', bg: 'rgba(90,107,122,0.12)',  color: 'var(--text-muted)' },
  }[status] || { label: status || '—', bg: 'var(--border)', color: 'var(--text-muted)' }
  return (
    <span style={{ padding: '3px 8px', borderRadius: '2px', fontSize: '10px', fontWeight: '500', letterSpacing: '0.06em', background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}
