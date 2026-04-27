import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { apiRequest } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Navbar from '../../components/Navbar'

const APP_STATUS = {
  submitted:  { label: 'New',       color: 'var(--sky-blue)',  bg: 'rgba(126,181,200,0.12)' },
  reviewing:  { label: 'Reviewing', color: 'var(--warm-gold)', bg: 'rgba(200,169,110,0.12)' },
  interview:  { label: 'Interview', color: 'var(--warm-gold)', bg: 'rgba(200,169,110,0.18)' },
  offer:      { label: 'Offer Sent',color: 'var(--success)',   bg: 'rgba(45,122,79,0.12)' },
  hired:      { label: 'Hired',     color: 'var(--success)',   bg: 'rgba(45,122,79,0.2)' },
  rejected:   { label: 'Rejected',  color: '#B43C3C',          bg: 'rgba(180,60,60,0.1)' },
}

export default function EmployerDashboard() {
  const { user } = useAuth()
  const [empProfile, setEmpProfile] = useState(null)
  const [jobs, setJobs] = useState([])
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingApp, setUpdatingApp] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    try {
      const { data: ep } = await supabase
        .from('employer_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()
      setEmpProfile(ep)

      if (ep) {
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('*')
          .eq('employer_id', ep.id)
          .order('created_at', { ascending: false })
        setJobs(jobsData || [])

        const jobIds = (jobsData || []).map(j => j.id)
        if (jobIds.length > 0) {
          const { data: appsData } = await supabase
            .from('applications')
            .select(`
              *,
              jobs(title),
              nurse_profiles(first_name, last_name, specialty, years_experience)
            `)
            .in('job_id', jobIds)
            .order('created_at', { ascending: false })
            .limit(20)
          setApplications(appsData || [])
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function updateAppStatus(appId, newStatus) {
    setUpdatingApp(appId)
    setError('')
    try {
      const updated = await apiRequest(`/api/employers/applications/${appId}/status`, {
        method: 'PUT',
        body: { status: newStatus }
      })
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, ...updated } : a))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUpdatingApp(null)
    }
  }

  async function toggleJobStatus(jobId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    await supabase.from('jobs').update({ status: newStatus }).eq('id', jobId)
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j))
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--warm-white)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', color: 'var(--warm-gold)', marginBottom: '12px' }}>✦</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', letterSpacing: '0.08em' }}>LOADING DASHBOARD</p>
        </div>
      </div>
    )
  }

  if (empProfile && empProfile.onboarding_stage !== 'approved') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
        <Navbar />
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '100px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '20px' }}>🔒</div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: '300', color: 'var(--deep-navy)', marginBottom: '12px' }}>
            Complete Your Setup
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: '1.7' }}>
            Finish the onboarding process to access your full dashboard and start posting jobs.
          </p>
          <Link to="/employer/onboarding" style={{ padding: '12px 28px', background: 'var(--deep-navy)', color: 'white', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500' }}>
            Continue Setup →
          </Link>
        </div>
      </div>
    )
  }

  const activeJobs = jobs.filter(j => j.status === 'active').length
  const totalApps = applications.length
  const newApps = applications.filter(a => a.status === 'submitted').length
  const hiredCount = applications.filter(a => a.status === 'hired').length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 24px 60px' }}>
        {error && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'white', border: '1px solid rgba(180,60,60,0.25)', borderRadius: '4px', color: '#B43C3C', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '40px' }}>
          <div>
            <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '8px' }}>Employer Portal</p>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: '300', color: 'var(--deep-navy)' }}>
              {empProfile?.org_name || 'Your Dashboard'}
            </h1>
          </div>
          <Link to="/employer/post-job" style={{ padding: '11px 24px', background: 'var(--warm-gold)', color: 'white', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500' }}>
            + Post a Job
          </Link>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Active Jobs',  value: activeJobs,  icon: '📋', color: 'var(--sky-blue)' },
            { label: 'Total Applicants', value: totalApps, icon: '👥', color: 'var(--warm-gold)' },
            { label: 'New Applications', value: newApps, icon: '🔔', color: newApps > 0 ? 'var(--warm-gold)' : 'var(--text-muted)' },
            { label: 'Successful Hires', value: hiredCount, icon: '✅', color: 'var(--success)' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px 18px' }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>{s.icon}</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '32px', fontWeight: '300', color: s.color, lineHeight: 1, marginBottom: '4px' }}>{s.value}</div>
              <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="dash-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>

          {/* Applications */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--deep-navy)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '20px' }}>
              Recent Applications
            </h3>
            {applications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>No applications yet.</p>
                <Link to="/employer/post-job" style={{ fontSize: '12px', color: 'var(--sky-blue)' }}>Post your first job →</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {applications.slice(0, 8).map(app => {
                  const s = APP_STATUS[app.status] || APP_STATUS.submitted
                  const nurse = app.nurse_profiles
                  return (
                    <div key={app.id} style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--deep-navy)' }}>
                            {nurse ? `${nurse.first_name} ${nurse.last_name}` : 'Applicant'}
                          </p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {nurse?.specialty} · {nurse?.years_experience} yrs
                          </p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{app.jobs?.title}</p>
                        </div>
                        <span style={{ padding: '3px 8px', borderRadius: '2px', fontSize: '10px', fontWeight: '500', background: s.bg, color: s.color }}>
                          {s.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {['reviewing', 'interview', 'offer', 'hired', 'rejected'].map(status => (
                          status !== app.status && (
                            <button key={status} onClick={() => updateAppStatus(app.id, status)}
                              disabled={updatingApp === app.id}
                              style={{ padding: '4px 8px', fontSize: '10px', letterSpacing: '0.04em', border: '1px solid var(--border)', borderRadius: '2px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', textTransform: 'capitalize' }}>
                              → {APP_STATUS[status]?.label}
                            </button>
                          )
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Job postings */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--deep-navy)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Your Job Postings
              </h3>
              <Link to="/employer/post-job" style={{ fontSize: '12px', color: 'var(--sky-blue)' }}>+ Add new</Link>
            </div>
            {jobs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>No jobs posted yet.</p>
                <Link to="/employer/post-job" style={{ padding: '9px 20px', background: 'var(--deep-navy)', color: 'white', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500' }}>
                  Post First Job
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {jobs.map(job => {
                  const appCount = applications.filter(a => a.job_id === job.id).length
                  return (
                    <div key={job.id} style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '3px' }}>{job.title}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{job.city}, {job.state} · {job.specialty}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{appCount} applicant{appCount !== 1 ? 's' : ''}</p>
                        </div>
                        <button onClick={() => toggleJobStatus(job.id, job.status)}
                          style={{ padding: '4px 10px', borderRadius: '2px', fontSize: '10px', fontWeight: '500', cursor: 'pointer', border: 'none', background: job.status === 'active' ? 'rgba(45,122,79,0.12)' : 'rgba(200,169,110,0.12)', color: job.status === 'active' ? 'var(--success)' : 'var(--warm-gold)' }}>
                          {job.status === 'active' ? '● Active' : '⏸ Paused'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '24px' }}>
          {[
            { icon: '👥', label: 'Browse Nurse Profiles', desc: 'Find qualified nurses for your positions', href: '/nurses', color: 'var(--sky-blue)' },
            { icon: '💬', label: 'Messages', desc: 'Communicate with applicants directly', href: '/messages', color: 'var(--warm-gold)' },
            { icon: '⚙️', label: 'Account Setup', desc: 'Update organization details', href: '/employer/onboarding', color: 'var(--text-muted)' },
          ].map((q, i) => (
            <Link key={i} to={q.href} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px', textDecoration: 'none', display: 'block', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(44,62,80,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ fontSize: '22px', marginBottom: '10px' }}>{q.icon}</div>
              <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '4px' }}>{q.label}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{q.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
