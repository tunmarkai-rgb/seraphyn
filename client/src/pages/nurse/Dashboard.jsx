import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Navbar from '../../components/Navbar'

const COMPLETION_FIELDS = [
  'first_name', 'last_name', 'specialty', 'license_number',
  'license_state', 'years_experience', 'bio', 'resume_url',
  'license_url', 'shift_preference'
]

const STATUS_COLORS = {
  submitted:  { bg: 'rgba(126,181,200,0.12)', color: 'var(--sky-blue)',  label: 'Submitted' },
  reviewing:  { bg: 'rgba(200,169,110,0.12)', color: 'var(--warm-gold)', label: 'Reviewing' },
  interview:  { bg: 'rgba(200,169,110,0.18)', color: 'var(--warm-gold)', label: 'Interview' },
  offer:      { bg: 'rgba(45,122,79,0.12)',   color: 'var(--success)',   label: 'Offer' },
  hired:      { bg: 'rgba(45,122,79,0.18)',   color: 'var(--success)',   label: 'Hired' },
  rejected:   { bg: 'rgba(180,60,60,0.1)',    color: '#B43C3C',          label: 'Not Selected' },
}

export default function NurseDashboard() {
  const { user, profile } = useAuth()
  const [nurseProfile, setNurseProfile] = useState(null)
  const [applications, setApplications] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    try {
      const { data: np } = await supabase
        .from('nurse_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      setNurseProfile(np)

      if (np) {
        const [appsRes, jobsRes] = await Promise.all([
          supabase
            .from('applications')
            .select('*, jobs(title, city, state, specialty, pay_rate, shift_type, contract_length)')
            .eq('nurse_id', np.id)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('jobs')
            .select('*, employer_profiles(org_name)')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(3)
        ])
        setApplications(appsRes.data || [])
        setJobs(jobsRes.data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  const completion = nurseProfile
    ? Math.round(COMPLETION_FIELDS.filter(f => nurseProfile[f]).length / COMPLETION_FIELDS.length * 100)
    : 0

  const appCounts = applications.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1
    return acc
  }, {})

  const approvalStatus = profile?.status || 'pending'
  const statusBadge = {
    pending:   { label: 'Pending Approval', bg: 'rgba(200,169,110,0.15)', color: 'var(--warm-gold)' },
    approved:  { label: 'Approved',         bg: 'rgba(45,122,79,0.12)',   color: 'var(--success)' },
    rejected:  { label: 'Rejected',         bg: 'rgba(180,60,60,0.1)',    color: '#B43C3C' },
    suspended: { label: 'Suspended',        bg: 'rgba(90,107,122,0.15)',  color: 'var(--text-muted)' },
  }[approvalStatus]

  const recommendations = nurseProfile?.ai_job_matches || []

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--warm-white)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', color: 'var(--warm-gold)', marginBottom: '12px' }}>✦</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', letterSpacing: '0.08em' }}>LOADING YOUR DASHBOARD</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 24px 60px' }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '40px' }}>
          <div>
            <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '8px' }}>
              Nurse Portal
            </p>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '300', color: 'var(--deep-navy)', marginBottom: '10px' }}>
              Welcome back, {nurseProfile?.first_name || profile?.full_name?.split(' ')[0] || 'Nurse'}
            </h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '2px', fontSize: '11px', fontWeight: '500', letterSpacing: '0.06em', background: statusBadge.bg, color: statusBadge.color }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusBadge.color, display: 'inline-block' }} />
              {statusBadge.label}
            </span>
          </div>
          <Link to="/nurse/profile" style={{ padding: '10px 20px', background: 'var(--deep-navy)', color: 'white', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500' }}>
            Edit Profile →
          </Link>
        </div>

        {approvalStatus === 'pending' && (
          <div style={{ background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.3)', borderRadius: '4px', padding: '16px 20px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '18px' }}>⏳</span>
            <p style={{ fontSize: '14px', color: 'var(--deep-navy)' }}>
              Your profile is under review. Our admin team typically approves within 24–48 hours. You'll receive an email once approved.
            </p>
          </div>
        )}

        {/* ── STATS ROW ── */}
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Applications', value: applications.length, icon: '📋', color: 'var(--sky-blue)' },
            { label: 'Reviewing', value: (appCounts.reviewing || 0) + (appCounts.interview || 0), icon: '👁', color: 'var(--warm-gold)' },
            { label: 'Offers', value: appCounts.offer || 0, icon: '✉️', color: 'var(--success)' },
            { label: 'Profile Complete', value: `${completion}%`, icon: '👤', color: completion === 100 ? 'var(--success)' : 'var(--warm-gold)' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px 18px' }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>{s.icon}</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '32px', fontWeight: '300', color: s.color, lineHeight: 1, marginBottom: '4px' }}>{s.value}</div>
              <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── MAIN GRID ── */}
        <div className="dash-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '24px', marginBottom: '32px' }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Profile completion */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Profile Completion
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${completion}%`, height: '100%', background: completion === 100 ? 'var(--success)' : 'var(--warm-gold)', borderRadius: '3px', transition: 'width 0.6s ease' }} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: '500', color: completion === 100 ? 'var(--success)' : 'var(--warm-gold)', minWidth: '36px' }}>{completion}%</span>
              </div>
              {completion < 100 && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Complete your profile to get better job matches and faster approval.
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {COMPLETION_FIELDS.map(field => {
                  const labels = {
                    first_name: 'First Name', last_name: 'Last Name', specialty: 'Specialty',
                    license_number: 'License Number', license_state: 'License State',
                    years_experience: 'Years of Experience', bio: 'Bio / About',
                    resume_url: 'Resume Uploaded', license_url: 'License Uploaded',
                    shift_preference: 'Shift Preference'
                  }
                  const done = !!nurseProfile?.[field]
                  return (
                    <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: done ? 'var(--success)' : 'var(--text-muted)' }}>
                      <span style={{ fontSize: '10px' }}>{done ? '✓' : '○'}</span>
                      {labels[field]}
                    </div>
                  )
                })}
              </div>
              <Link to="/nurse/profile" style={{ display: 'block', marginTop: '16px', padding: '9px', background: 'var(--warm-gold)', color: 'white', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500', textAlign: 'center' }}>
                Complete Profile
              </Link>
            </div>

            {/* Document status */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Documents
              </h3>
              {[
                { label: 'Resume / CV', key: 'resume_url', icon: '📄' },
                { label: 'Nursing License', key: 'license_url', icon: '🪪' },
              ].map(doc => {
                const uploaded = !!nurseProfile?.[doc.key]
                return (
                  <div key={doc.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span>{doc.icon}</span>
                      <span style={{ fontSize: '13px', color: 'var(--deep-navy)' }}>{doc.label}</span>
                    </div>
                    {uploaded ? (
                      <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '500' }}>✓ Uploaded</span>
                    ) : (
                      <Link to="/nurse/profile" style={{ fontSize: '11px', color: 'var(--sky-blue)', fontWeight: '500' }}>Upload →</Link>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right column — Recent applications */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--deep-navy)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Recent Applications
              </h3>
              <Link to="/nurse/applications" style={{ fontSize: '12px', color: 'var(--sky-blue)' }}>View all →</Link>
            </div>

            {applications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>No applications yet.</p>
                <Link to="/jobs" style={{ padding: '9px 20px', background: 'var(--sky-blue)', color: 'white', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500' }}>
                  Browse Jobs
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {applications.map(app => {
                  const s = STATUS_COLORS[app.status] || STATUS_COLORS.submitted
                  return (
                    <div key={app.id} style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <h4 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '17px', fontWeight: '500', color: 'var(--deep-navy)', lineHeight: 1.3 }}>
                          {app.jobs?.title || 'Job Listing'}
                        </h4>
                        <span style={{ padding: '3px 8px', borderRadius: '2px', fontSize: '10px', fontWeight: '500', letterSpacing: '0.06em', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
                          {s.label}
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {app.jobs?.city}, {app.jobs?.state} · {app.jobs?.shift_type} · {app.jobs?.pay_rate && `$${app.jobs.pay_rate}/hr`}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                        Applied {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── JOB RECOMMENDATIONS ── */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '4px' }}>
                {recommendations.length > 0 ? 'AI-Matched Opportunities' : 'Open Positions'}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {recommendations.length > 0 ? 'Matched to your specialty and availability' : 'Latest active jobs on the platform'}
              </p>
            </div>
            <Link to="/jobs" style={{ fontSize: '12px', color: 'var(--sky-blue)' }}>Browse all →</Link>
          </div>

          {jobs.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', padding: '32px' }}>No open positions at the moment. Check back soon.</p>
          ) : (
            <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {jobs.map(job => (
                <div key={job.id} style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '20px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--warm-gold)', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    {job.specialty}
                  </div>
                  <h4 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '17px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '6px', lineHeight: 1.3 }}>
                    {job.title}
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    {job.employer_profiles?.org_name} · {job.city}, {job.state}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)' }}>
                      {job.pay_rate && `$${job.pay_rate}`}<span style={{ fontSize: '11px', fontFamily: 'DM Sans', fontWeight: '300', color: 'var(--text-muted)' }}>{job.pay_rate && '/hr'}</span>
                    </span>
                    <Link to={`/jobs?job=${job.id}`} style={{ padding: '6px 12px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Apply
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
