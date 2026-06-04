import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import { apiRequest } from '../lib/api'

export default function NurseDetail() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [nurse, setNurse] = useState(null)
  const [empProfile, setEmpProfile] = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isFullAccess = empProfile?.onboarding_stage === 'approved' && empProfile?.approved_at

  useEffect(() => {
    void loadNurse()
    if (user && profile?.role === 'employer') {
      void loadEmployerProfile()
    }
  }, [id, user, profile])

  useEffect(() => {
    if (isFullAccess && profile?.role === 'employer') {
      void loadDocuments()
    }
  }, [id, isFullAccess, profile])

  async function loadNurse() {
    try {
      const data = await apiRequest(`/api/nurses/${id}`)
      setNurse(data)
    } catch {
      setNurse(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadEmployerProfile() {
    try {
      const data = await apiRequest('/api/employers/self')
      setEmpProfile(data)
    } catch {
      setEmpProfile(null)
    }
  }

  async function loadDocuments() {
    try {
      setError('')
      const data = await apiRequest(`/api/nurses/${id}/documents`)
      setDocuments(data || [])
    } catch (requestError) {
      console.error('Failed to load nurse documents:', requestError.message)
      setError(requestError.message)
    }
  }

  async function openDocument(documentId) {
    try {
      setError('')
      const data = await apiRequest(`/api/nurses/documents/${documentId}/download`)
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      }
    } catch (requestError) {
      console.error('Failed to open nurse document:', requestError.message)
      setError(requestError.message)
    }
  }

  async function openPrimaryFile(kind) {
    try {
      setError('')
      const data = await apiRequest(`/api/nurses/${id}/files/${kind}/download`)
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      }
    } catch (requestError) {
      console.error(`Failed to open nurse ${kind}:`, requestError.message)
      setError(requestError.message)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--warm-white)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</p>
      </div>
    )
  }

  if (!nurse) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--warm-white)' }}>
        <Navbar />
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '120px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '16px', color: 'var(--text-muted)' }}>Nurse profile not found.</p>
          <button
            onClick={() => navigate('/nurses')}
            style={{ marginTop: '20px', padding: '10px 24px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Back to Directory
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '100px 24px 60px' }}>
        {error && (
          <div style={{ background: 'rgba(180,60,60,0.08)', border: '1px solid rgba(180,60,60,0.2)', borderRadius: '4px', padding: '12px 14px', marginBottom: '16px', color: '#B43C3C', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <button onClick={() => navigate('/nurses')} style={{ background: 'none', border: 'none', color: 'var(--sky-blue)', fontSize: '13px', cursor: 'pointer', padding: '0', marginBottom: '24px' }}>
          {'<-'} Back to Directory
        </button>

        <div style={{ background: 'linear-gradient(135deg, var(--deep-navy), var(--sky-blue))', borderRadius: '4px', padding: '32px', marginBottom: '20px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '9px', color: 'var(--warm-gold)', letterSpacing: '0.06em', fontWeight: '500' }}>
            <img src="/logo.png" alt="" aria-hidden="true" style={{ height: '11px', width: 'auto', objectFit: 'contain' }} />
            VERIFIED
          </div>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: 'white', background: 'rgba(255,255,255,0.12)', marginBottom: '12px' }}>
            {nurse.first_name?.[0]}{nurse.last_name?.[0]}
          </div>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', color: 'white', marginBottom: '4px' }}>
            {isFullAccess ? `${nurse.first_name} ${nurse.last_name}` : `${nurse.first_name} ${nurse.last_name?.[0]}.`}
          </p>
          <p style={{ fontSize: '14px', color: 'rgba(245,245,240,0.7)' }}>{nurse.specialty}</p>
          {isFullAccess && nurse.user_id && (
            <button
              type="button"
              onClick={() => navigate(`/messages?direct=${nurse.user_id}`)}
              style={{ marginTop: '18px', padding: '9px 16px', background: 'white', color: 'var(--deep-navy)', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '600', cursor: 'pointer' }}
            >
              Message Nurse
            </button>
          )}
        </div>

        {!isFullAccess && profile?.role === 'employer' && (
          <div style={{ background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.3)', borderRadius: '4px', padding: '14px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>Locked</span>
            <p style={{ fontSize: '13px', color: 'var(--warm-gold)' }}>
              Full profile visible after final employer approval.{' '}
              <a href="/employer/onboarding" style={{ color: 'var(--warm-gold)', textDecoration: 'underline' }}>Complete setup {'->'}</a>
            </p>
          </div>
        )}

        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px', marginBottom: '20px' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
            Professional Details
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {[
              ['Availability', nurse.availability || 'Contact for details'],
              ['Experience', nurse.years_experience ? `${nurse.years_experience} years` : '-'],
              ['Shift Preference', nurse.shift_preference || 'Flexible'],
            ].map(([label, value]) => (
              <div key={label}>
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</p>
                <p style={{ fontSize: '14px', color: 'var(--deep-navy)', fontWeight: '500' }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {(nurse.certifications || []).length > 0 && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              Certifications
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {nurse.certifications.map((certification, index) => (
                <span key={index} style={{ padding: '6px 12px', background: 'rgba(126,181,200,0.1)', borderRadius: '2px', fontSize: '12px', color: 'var(--sky-blue)', fontWeight: '500' }}>
                  {certification}
                </span>
              ))}
            </div>
          </div>
        )}

        {isFullAccess && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              Candidate Documents
            </h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: documents.length > 0 ? '16px' : '0' }}>
              <button type="button" onClick={() => openPrimaryFile('resume')}
                style={{ padding: '8px 14px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', background: 'transparent', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                View Resume
              </button>
              <button type="button" onClick={() => openPrimaryFile('license')}
                style={{ padding: '8px 14px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', background: 'transparent', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                View License
              </button>
            </div>

            {documents.length > 0 && (
              <div>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Certification Documents
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {documents.map((doc) => (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '4px' }}>
                      <div>
                        <p style={{ fontSize: '13px', color: 'var(--deep-navy)', fontWeight: '500' }}>{doc.title}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Uploaded {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <button type="button" onClick={() => openDocument(doc.id)}
                        style={{ padding: '8px 14px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', background: 'transparent', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {isFullAccess && nurse.bio && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              About
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--deep-navy)', lineHeight: '1.8' }}>{nurse.bio}</p>
          </div>
        )}
      </div>
    </div>
  )
}
