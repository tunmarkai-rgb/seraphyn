import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'

export default function NurseDetail() {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [nurse, setNurse] = useState(null)
  const [empProfile, setEmpProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const isFullAccess = empProfile?.onboarding_stage === 'approved' && empProfile?.approved_at

  useEffect(() => {
    loadNurse()
    if (user && profile?.role === 'employer') loadEmployerProfile()
  }, [id, user, profile])

  async function loadNurse() {
    const { data } = await supabase
      .from('nurse_profiles')
      .select('id, first_name, last_name, specialty, years_experience, availability, shift_preference, certifications, bio, profile_photo_url, approved_at')
      .eq('id', id)
      .not('approved_at', 'is', null)
      .single()
    setNurse(data)
    setLoading(false)
  }

  async function loadEmployerProfile() {
    const { data } = await supabase
      .from('employer_profiles')
      .select('onboarding_stage, approved_at')
      .eq('user_id', user.id)
      .single()
    setEmpProfile(data)
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
          <button onClick={() => navigate('/nurses')} style={{ marginTop: '20px', padding: '10px 24px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
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

        <button onClick={() => navigate('/nurses')} style={{ background: 'none', border: 'none', color: 'var(--sky-blue)', fontSize: '13px', cursor: 'pointer', padding: '0', marginBottom: '24px' }}>
          ← Back to Directory
        </button>

        {/* Header card */}
        <div style={{ background: 'linear-gradient(135deg, var(--deep-navy), var(--sky-blue))', borderRadius: '4px', padding: '32px', marginBottom: '20px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '9px', color: 'var(--warm-gold)', letterSpacing: '0.06em', fontWeight: '500' }}>✦ VERIFIED</div>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: 'white', background: 'rgba(255,255,255,0.12)', marginBottom: '12px' }}>
            {nurse.first_name?.[0]}{nurse.last_name?.[0]}
          </div>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', color: 'white', marginBottom: '4px' }}>
            {isFullAccess ? `${nurse.first_name} ${nurse.last_name}` : `${nurse.first_name} ${nurse.last_name?.[0]}.`}
          </p>
          <p style={{ fontSize: '14px', color: 'rgba(245,245,240,0.7)' }}>{nurse.specialty}</p>
        </div>

        {!isFullAccess && profile?.role === 'employer' && (
          <div style={{ background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.3)', borderRadius: '4px', padding: '14px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🔒</span>
            <p style={{ fontSize: '13px', color: 'var(--warm-gold)' }}>
              Full profile visible after final employer approval.{' '}
              <a href="/employer/onboarding" style={{ color: 'var(--warm-gold)', textDecoration: 'underline' }}>Complete setup →</a>
            </p>
          </div>
        )}

        {/* Details */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px', marginBottom: '20px' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
            Professional Details
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {[
              ['Availability', nurse.availability || 'Contact for details'],
              ['Experience', nurse.years_experience ? `${nurse.years_experience} years` : '—'],
              ['Shift Preference', nurse.shift_preference || 'Flexible'],
            ].map(([label, value]) => (
              <div key={label}>
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</p>
                <p style={{ fontSize: '14px', color: 'var(--deep-navy)', fontWeight: '500' }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Certifications */}
        {(nurse.certifications || []).length > 0 && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              Certifications
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {nurse.certifications.map((c, i) => (
                <span key={i} style={{ padding: '6px 12px', background: 'rgba(126,181,200,0.1)', borderRadius: '2px', fontSize: '12px', color: 'var(--sky-blue)', fontWeight: '500' }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* Bio — full access only */}
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
