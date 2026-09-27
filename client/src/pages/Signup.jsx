import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAppBaseUrl } from '../lib/supabase'
import { apiRequest, publicApiRequest } from '../lib/api'
import BrandLogo from '../components/BrandLogo'

// One short signup for nurses and employers. Profile details are collected
// after the email is confirmed -- and for anyone who already filled in a
// Seraphyn form on consult.seraphyncare.com, the server fills them in from
// that submission, matched on the confirmed email.

const ROLE_COPY = {
  nurse: {
    eyebrow: 'Nurse Portal',
    headline: <>Your next great<br /><em style={{ color: 'var(--warm-gold)', fontStyle: 'italic' }}>assignment</em><br />awaits</>,
    body: 'Join verified nurses earning premium rates on per diem, contract and permanent assignments.',
    points: ['Premium assignments, no hidden fees', 'Average 4-5 day placement', 'Verified and secure platform'],
    background: 'var(--deep-navy)'
  },
  employer: {
    eyebrow: 'Employer Portal',
    headline: <>Fill critical<br />positions with<br /><em style={{ color: 'var(--warm-gold)', fontStyle: 'italic' }}>confidence</em></>,
    body: 'Connect with verified, credentialed nurses ready for placement.',
    points: ['Pre-verified nurse credentials', 'Average 4.2-day fill time', 'No placement until you approve'],
    background: 'linear-gradient(160deg, #24384C 0%, #35546B 55%, #537E93 100%)'
  }
}

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialRole = ['nurse', 'employer'].includes(searchParams.get('role')) ? searchParams.get('role') : ''

  const [role, setRole] = useState(initialRole)
  useEffect(() => {
    if (initialRole) setRole(initialRole)
  }, [initialRole])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName: searchParams.get('first_name') || '',
    lastName: searchParams.get('last_name') || '',
    email: searchParams.get('email') || '',
    password: '',
    confirmPassword: ''
  })

  const copy = ROLE_COPY[role || 'nurse']
  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!role) return setError('Choose whether you are joining as a nurse or an employer')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match')
    if (form.password.length < 8) return setError('Password must be at least 8 characters')

    setLoading(true)
    try {
      const firstName = form.firstName.trim()
      const lastName = form.lastName.trim()
      const email = form.email.trim()
      const fullName = `${firstName} ${lastName}`.trim()

      const { data, error: signUpError } = await signUp(email, form.password, role, fullName, {
        data: {
          first_name: firstName,
          last_name: lastName,
          ...(role === 'employer' ? { contact_name: fullName, onboarding_stage: 'profile' } : {})
        },
        emailRedirectTo: `${getAppBaseUrl()}/auth/confirm`
      })
      if (signUpError) throw signUpError

      if (data?.user?.id) {
        try {
          await publicApiRequest('/api/integrations/signup-alert', {
            method: 'POST',
            body: { userId: data.user.id, role, email }
          })
        } catch (signupAlertError) {
          console.error('Signup alert failed:', signupAlertError.message)
        }

        // Only when email confirmation is switched off in Supabase; otherwise
        // /auth/confirm does this once the email is confirmed.
        if (data.session?.access_token) {
          try {
            await apiRequest('/api/integrations/ghl/sync-self', {
              method: 'POST',
              accessToken: data.session.access_token
            })
            await apiRequest('/api/integrations/events/self', {
              method: 'POST',
              accessToken: data.session.access_token,
              body: { event: `${role}.signup_confirmed` }
            })
          } catch (syncError) {
            console.error('Signup GHL sync failed:', syncError.message)
          }
        }
      }

      navigate(`/login?signup=${role}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', background: 'white',
    border: '1px solid var(--border)', borderRadius: '2px',
    fontSize: '14px', outline: 'none', color: 'var(--charcoal)'
  }

  const labelStyle = {
    display: 'block', fontSize: '11px', letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--teal)',
    fontWeight: '500', marginBottom: '6px'
  }

  const roleButtonStyle = (value) => ({
    flex: 1,
    padding: '12px',
    border: `1px solid ${role === value ? 'var(--deep-navy)' : 'var(--border)'}`,
    background: role === value ? 'var(--deep-navy)' : 'white',
    color: role === value ? 'white' : 'var(--deep-navy)',
    borderRadius: '2px',
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: '600',
    cursor: 'pointer'
  })

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      fontFamily: 'DM Sans, sans-serif'
    }} className="auth-layout">
      <div style={{
        background: copy.background,
        padding: '60px 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', marginBottom: '48px', textDecoration: 'none' }}>
          <BrandLogo tone="light" size={32} showTagline={true} />
        </Link>
        <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '16px' }}>
          {copy.eyebrow}
        </p>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '42px', fontWeight: '300', color: 'var(--cream)', lineHeight: '1.15', marginBottom: '24px' }}>
          {copy.headline}
        </h1>
        <p style={{ color: 'rgba(245,240,232,0.6)', fontSize: '14px', fontWeight: '300', lineHeight: '1.8', marginBottom: '40px' }}>
          {copy.body}
        </p>
        {copy.points.map((item) => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1px solid rgba(196,151,90,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--warm-gold)', flexShrink: 0 }}>✓</div>
            <span style={{ fontSize: '13px', color: 'rgba(245,240,232,0.7)', fontWeight: '300' }}>{item}</span>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--cream)', padding: '60px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflowY: 'auto' }}>
        <div style={{ maxWidth: '460px', width: '100%', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '32px', color: 'var(--deep-navy)', marginBottom: '6px' }}>
            Create Your Account
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Already a member? <Link to="/login" style={{ color: 'var(--teal)', fontWeight: '500' }}>Sign in</Link>
          </p>

          <div style={{
            background: 'rgba(126,181,200,0.12)', border: '1px solid rgba(126,181,200,0.25)',
            borderRadius: '2px', padding: '12px 16px', marginBottom: '24px',
            fontSize: '13px', color: 'var(--deep-navy)', lineHeight: '1.6'
          }}>
            Already filled in a form on our website? Use the same email address and your details will be waiting for you after you confirm it.
          </div>

          {error && (
            <div style={{ background: 'rgba(200,60,60,0.1)', border: '1px solid rgba(200,60,60,0.3)', borderRadius: '2px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#C04040' }}>
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>I am joining as</label>
              <div style={{ display: 'flex', gap: '10px' }} role="radiogroup" aria-label="Account type">
                <button type="button" role="radio" aria-checked={role === 'nurse'} onClick={() => setRole('nurse')} style={roleButtonStyle('nurse')}>
                  A Nurse
                </button>
                <button type="button" role="radio" aria-checked={role === 'employer'} onClick={() => setRole('employer')} style={roleButtonStyle('employer')}>
                  An Employer
                </button>
              </div>
            </div>

            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>First Name</label>
                <input name="firstName" value={form.firstName} onChange={handle} required autoComplete="given-name" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input name="lastName" value={form.lastName} onChange={handle} required autoComplete="family-name" style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>{role === 'employer' ? 'Work Email' : 'Email'}</label>
              <input name="email" type="email" value={form.email} onChange={handle} required autoComplete="email" style={inputStyle} />
            </div>

            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={labelStyle}>Password</label>
                <input name="password" type="password" value={form.password} onChange={handle} placeholder="8+ characters" required autoComplete="new-password" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handle} required autoComplete="new-password" style={inputStyle} />
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px',
              background: 'var(--deep-navy)', opacity: loading ? 0.7 : 1,
              color: 'white', border: 'none', borderRadius: '2px',
              fontSize: '12px', letterSpacing: '0.08em',
              textTransform: 'uppercase', fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}>
              {loading ? 'Creating account...' : 'Create Account →'}
            </button>
          </form>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px', lineHeight: '1.6' }}>
            We'll email you a link to confirm your address. After that you'll complete your {role === 'employer' ? 'organization profile' : 'nurse profile'} in the portal.
          </p>
        </div>
      </div>
    </div>
  )
}
