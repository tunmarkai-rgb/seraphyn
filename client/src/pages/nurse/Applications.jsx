import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Navbar from '../../components/Navbar'

const STATUS_CONFIG = {
  submitted:  { label: 'Submitted',    bg: 'rgba(126,181,200,0.12)', color: 'var(--sky-blue)' },
  reviewing:  { label: 'Under Review', bg: 'rgba(200,169,110,0.12)', color: 'var(--warm-gold)' },
  interview:  { label: 'Interview',    bg: 'rgba(200,169,110,0.18)', color: 'var(--warm-gold)' },
  offer:      { label: 'Offer',        bg: 'rgba(45,122,79,0.12)',   color: 'var(--success)' },
  hired:      { label: 'Hired',        bg: 'rgba(45,122,79,0.2)',    color: 'var(--success)' },
  rejected:   { label: 'Not Selected', bg: 'rgba(180,60,60,0.1)',    color: '#B43C3C' },
}

const FILTER_OPTIONS = ['all', 'submitted', 'reviewing', 'interview', 'offer', 'hired', 'rejected']

export default function NurseApplications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadApplications()
  }, [user])

  async function loadApplications() {
    setLoading(true)
    const { data: np } = await supabase
      .from('nurse_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (np) {
      const { data } = await supabase
        .from('applications')
        .select(`
          *,
          jobs (
            title, city, state, specialty, pay_rate, shift_type,
            contract_length, description, employer_profiles(org_name)
          )
        `)
        .eq('nurse_id', np.id)
        .order('created_at', { ascending: false })
      setApplications(data || [])
    }
    setLoading(false)
  }

  const filtered = filter === 'all' ? applications : applications.filter(a => a.status === filter)

  const counts = applications.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1
    return acc
  }, {})

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '100px 24px 60px' }}>

        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '8px' }}>Nurse Portal</p>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: '300', color: 'var(--deep-navy)' }}>
            My Applications
          </h1>
        </div>

        {/* Status summary */}
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
          {[
            { label: 'Total', value: applications.length, color: 'var(--sky-blue)' },
            { label: 'Active', value: (counts.submitted || 0) + (counts.reviewing || 0) + (counts.interview || 0), color: 'var(--warm-gold)' },
            { label: 'Offers', value: counts.offer || 0, color: 'var(--success)' },
            { label: 'Hired', value: counts.hired || 0, color: 'var(--success)' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: '300', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {FILTER_OPTIONS.map(f => {
            const active = filter === f
            return (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '7px 14px', borderRadius: '2px', fontSize: '12px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', border: active ? '1px solid var(--deep-navy)' : '1px solid var(--border)', background: active ? 'var(--deep-navy)' : 'white', color: active ? 'white' : 'var(--text-muted)', transition: 'all 0.2s' }}>
                {f === 'all' ? `All (${applications.length})` : `${STATUS_CONFIG[f]?.label} ${counts[f] ? `(${counts[f]})` : ''}`}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
            <p style={{ fontSize: '16px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {filter === 'all' ? "You haven't applied to any jobs yet." : `No applications with status "${STATUS_CONFIG[filter]?.label}".`}
            </p>
            {filter === 'all' && (
              <Link to="/jobs" style={{ padding: '10px 24px', background: 'var(--sky-blue)', color: 'white', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500' }}>
                Browse Jobs
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filtered.map(app => {
              const s = STATUS_CONFIG[app.status] || STATUS_CONFIG.submitted
              const job = app.jobs
              return (
                <div key={app.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '4px' }}>
                        {job?.title || 'Job Position'}
                      </h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {job?.employer_profiles?.org_name} · {job?.city}, {job?.state}
                      </p>
                    </div>
                    <span style={{ padding: '5px 12px', borderRadius: '2px', fontSize: '11px', fontWeight: '500', letterSpacing: '0.06em', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
                      {s.label}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    {[job?.specialty, job?.shift_type, job?.contract_length, job?.pay_rate ? `$${job.pay_rate}/hr` : null].filter(Boolean).map((tag, i) => (
                      <span key={i} style={{ fontSize: '11px', padding: '3px 8px', background: 'rgba(126,181,200,0.1)', borderRadius: '2px', color: 'var(--sky-blue)', fontWeight: '500' }}>{tag}</span>
                    ))}
                  </div>

                  {app.cover_note && (
                    <div style={{ background: 'var(--warm-white)', borderRadius: '2px', padding: '10px 14px', marginBottom: '12px' }}>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your Note</p>
                      <p style={{ fontSize: '13px', color: 'var(--deep-navy)' }}>{app.cover_note}</p>
                    </div>
                  )}

                  {app.admin_notes && (
                    <div style={{ background: 'rgba(126,181,200,0.08)', border: '1px solid rgba(126,181,200,0.25)', borderRadius: '2px', padding: '10px 14px', marginBottom: '12px' }}>
                      <p style={{ fontSize: '12px', color: 'var(--sky-blue)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin Note</p>
                      <p style={{ fontSize: '13px', color: 'var(--deep-navy)' }}>{app.admin_notes}</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Applied {new Date(app.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <button onClick={() => navigate(`/messages?app=${app.id}`)}
                      style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      💬 Message
                    </button>
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
