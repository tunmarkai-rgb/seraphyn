import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { apiRequest } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import Navbar from '../../components/Navbar'

const APP_STATUS = {
  submitted: { label: 'New', color: 'var(--sky-blue)', bg: 'rgba(126,181,200,0.12)' },
  reviewing: { label: 'Reviewing', color: 'var(--warm-gold)', bg: 'rgba(200,169,110,0.12)' },
  interview: { label: 'Interview', color: 'var(--warm-gold)', bg: 'rgba(200,169,110,0.18)' },
  offer: { label: 'Offer Sent', color: 'var(--success)', bg: 'rgba(45,122,79,0.12)' },
  hired: { label: 'Hired', color: 'var(--success)', bg: 'rgba(45,122,79,0.2)' },
  rejected: { label: 'Rejected', color: '#B43C3C', bg: 'rgba(180,60,60,0.1)' }
}

function getContractLabel(contract) {
  if (contract?.title) return contract.title
  if (contract?.template_url === 'portal-template:direct_hire') return 'Direct Hire Agreement'
  if (contract?.template_url === 'portal-template:staffing_boss') return 'Per Diem Staffing Agreement'
  return 'Signed Agreement'
}

export default function EmployerDashboard() {
  const { user } = useAuth()
  const [empProfile, setEmpProfile] = useState(null)
  const [contracts, setContracts] = useState([])
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
        .select('*, contracts(*)')
        .eq('user_id', user.id)
        .single()

      setEmpProfile(ep)
      setContracts(ep?.contracts || [])

      if (ep) {
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('*')
          .eq('employer_id', ep.id)
          .order('created_at', { ascending: false })
        setJobs(jobsData || [])

        const jobIds = (jobsData || []).map((job) => job.id)
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
        } else {
          setApplications([])
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
      setApplications((previous) => previous.map((app) => (app.id === appId ? { ...app, ...updated } : app)))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUpdatingApp(null)
    }
  }

  async function toggleJobStatus(jobId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    await supabase.from('jobs').update({ status: newStatus }).eq('id', jobId)
    setJobs((previous) => previous.map((job) => (job.id === jobId ? { ...job, status: newStatus } : job)))
  }

  async function downloadContract(contractId) {
    try {
      const data = await apiRequest(`/api/contracts/${contractId}/download`)
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      }
    } catch (downloadError) {
      setError(downloadError.message)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--warm-white)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <img
            src="/logo.png"
            alt="Seraphyn"
            style={{ height: '34px', width: 'auto', marginBottom: '12px', objectFit: 'contain' }}
          />
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', letterSpacing: '0.08em' }}>LOADING DASHBOARD</p>
        </div>
      </div>
    )
  }

  if (empProfile && empProfile.onboarding_stage !== 'approved') {
    const isPendingApproval = empProfile.contract_signed || empProfile.onboarding_stage === 'contract'

    return (
      <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
        <Navbar />
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '100px 24px', textAlign: 'center' }}>
          {error && (
            <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'white', border: '1px solid rgba(180,60,60,0.25)', borderRadius: '4px', color: '#B43C3C', fontSize: '13px', textAlign: 'left' }}>
              {error}
            </div>
          )}

          <div style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '12px' }}>
            {isPendingApproval ? 'Employer Dashboard' : 'Setup Required'}
          </div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '32px', fontWeight: '300', color: 'var(--deep-navy)', marginBottom: '12px' }}>
            {isPendingApproval ? 'Approval in Progress' : 'Complete Your Setup'}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: '1.7' }}>
            {isPendingApproval
              ? 'Your agreements are signed and your account is under review. Use this page to track status and access your signed documents while approval is pending.'
              : 'Finish the onboarding process to access your full dashboard and start posting jobs.'}
          </p>

          {isPendingApproval && contracts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', textAlign: 'left' }}>
              {contracts.map((contract) => (
                <div key={contract.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '4px', background: 'white' }}>
                  <div>
                    <p style={{ fontSize: '13px', color: 'var(--deep-navy)', fontWeight: '500' }}>
                      {getContractLabel(contract)}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Signed {contract.signed_at ? new Date(contract.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'recently'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadContract(contract.id)}
                    style={{ padding: '8px 14px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', background: 'transparent', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}

          <Link to="/employer/onboarding" style={{ display: 'inline-block', padding: '12px 28px', background: 'var(--deep-navy)', color: 'white', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500' }}>
            {isPendingApproval ? 'View Approval Status' : 'Continue Setup'}
          </Link>
        </div>
      </div>
    )
  }

  const activeJobs = jobs.filter((job) => job.status === 'active').length
  const totalApps = applications.length
  const newApps = applications.filter((app) => app.status === 'submitted').length
  const hiredCount = applications.filter((app) => app.status === 'hired').length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 24px 60px' }}>
        {error && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'white', border: '1px solid rgba(180,60,60,0.25)', borderRadius: '4px', color: '#B43C3C', fontSize: '13px' }}>
            {error}
          </div>
        )}

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

        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Active Jobs', value: activeJobs, icon: 'J', color: 'var(--sky-blue)' },
            { label: 'Total Applicants', value: totalApps, icon: 'A', color: 'var(--warm-gold)' },
            { label: 'New Applications', value: newApps, icon: 'N', color: newApps > 0 ? 'var(--warm-gold)' : 'var(--text-muted)' },
            { label: 'Successful Hires', value: hiredCount, icon: 'H', color: 'var(--success)' }
          ].map((stat) => (
            <div key={stat.label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px 18px' }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>{stat.icon}</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '32px', fontWeight: '300', color: stat.color, lineHeight: 1, marginBottom: '4px' }}>{stat.value}</div>
              <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="dash-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--deep-navy)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '20px' }}>
              Recent Applications
            </h3>
            {applications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>No applications yet.</p>
                <Link to="/employer/post-job" style={{ fontSize: '12px', color: 'var(--sky-blue)' }}>Post your first job {'->'}</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {applications.slice(0, 8).map((app) => {
                  const statusMeta = APP_STATUS[app.status] || APP_STATUS.submitted
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
                        <span style={{ padding: '3px 8px', borderRadius: '2px', fontSize: '10px', fontWeight: '500', background: statusMeta.bg, color: statusMeta.color }}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {app.nurse_id && (
                          <Link
                            to={`/nurses/${app.nurse_id}`}
                            style={{ padding: '4px 8px', fontSize: '10px', letterSpacing: '0.04em', border: '1px solid var(--border)', borderRadius: '2px', background: 'transparent', color: 'var(--deep-navy)', cursor: 'pointer', textTransform: 'uppercase', textDecoration: 'none' }}
                          >
                            View Profile
                          </Link>
                        )}
                        <Link
                          to={`/messages?app=${app.id}`}
                          style={{ padding: '4px 8px', fontSize: '10px', letterSpacing: '0.04em', border: '1px solid var(--sky-blue)', borderRadius: '2px', background: 'transparent', color: 'var(--sky-blue)', cursor: 'pointer', textTransform: 'uppercase', textDecoration: 'none' }}
                        >
                          Message Nurse
                        </Link>
                        {['reviewing', 'interview', 'offer', 'hired', 'rejected'].map((status) => (
                          status !== app.status && (
                            <button
                              key={status}
                              onClick={() => updateAppStatus(app.id, status)}
                              disabled={updatingApp === app.id}
                              style={{ padding: '4px 8px', fontSize: '10px', letterSpacing: '0.04em', border: '1px solid var(--border)', borderRadius: '2px', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', textTransform: 'capitalize' }}
                            >
                              {'->'} {APP_STATUS[status]?.label}
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
                {jobs.map((job) => {
                  const appCount = applications.filter((app) => app.job_id === job.id).length
                  return (
                    <div key={job.id} style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '3px' }}>{job.title}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{job.city}, {job.state} · {job.specialty}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{appCount} applicant{appCount !== 1 ? 's' : ''}</p>
                        </div>
                        <button
                          onClick={() => toggleJobStatus(job.id, job.status)}
                          style={{ padding: '4px 10px', borderRadius: '2px', fontSize: '10px', fontWeight: '500', cursor: 'pointer', border: 'none', background: job.status === 'active' ? 'rgba(45,122,79,0.12)' : 'rgba(200,169,110,0.12)', color: job.status === 'active' ? 'var(--success)' : 'var(--warm-gold)' }}
                        >
                          {job.status === 'active' ? 'Active' : 'Paused'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '24px' }}>
          {[
            { icon: 'N', label: 'Browse Nurse Profiles', desc: 'Find qualified nurses for your positions', href: '/nurses' },
            { icon: 'M', label: 'Messages', desc: 'Communicate with applicants directly', href: '/messages' },
            { icon: 'S', label: 'Account Setup', desc: 'Update organization details', href: '/employer/onboarding' }
          ].map((quickLink) => (
            <Link
              key={quickLink.label}
              to={quickLink.href}
              style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px', textDecoration: 'none', display: 'block', transition: 'all 0.2s' }}
              onMouseEnter={(event) => {
                event.currentTarget.style.transform = 'translateY(-2px)'
                event.currentTarget.style.boxShadow = '0 8px 24px rgba(44,62,80,0.08)'
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = 'translateY(0)'
                event.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: '22px', marginBottom: '10px' }}>{quickLink.icon}</div>
              <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '4px' }}>{quickLink.label}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{quickLink.desc}</p>
            </Link>
          ))}
        </div>

        {contracts.filter((contract) => contract.status === 'signed').length > 0 && (
          <div style={{ marginTop: '24px', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--deep-navy)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Signed Agreements
              </h3>
              <Link to="/employer/onboarding" style={{ fontSize: '12px', color: 'var(--sky-blue)' }}>
                Open account documents
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {contracts
                .filter((contract) => contract.status === 'signed')
                .map((contract) => (
                  <div key={contract.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--warm-white)' }}>
                    <div>
                      <p style={{ fontSize: '13px', color: 'var(--deep-navy)', fontWeight: '500' }}>{getContractLabel(contract)}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Signed {contract.signed_at ? new Date(contract.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'recently'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadContract(contract.id)}
                      style={{ padding: '8px 14px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', background: 'transparent', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                    >
                      Download
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
