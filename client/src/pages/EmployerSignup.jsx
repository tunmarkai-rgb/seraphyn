import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { apiRequest } from '../lib/api'

export default function EmployerSignup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    contactName: '', orgName: '', email: '',
    password: '', confirmPassword: '',
    orgType: '', state: ''
  })

  const orgTypes = [
    'Hospital', 'Long-Term Care Facility', 'Rehab Center',
    'Outpatient Clinic', 'Ambulatory Surgery Center',
    'Home Health Agency', 'Other'
  ]

  const states = [
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
    'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
    'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
    'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
    'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
  ]

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match')
    }
    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters')
    }
    setLoading(true)
    try {
      const { data, error } = await signUp(
        form.email,
        form.password,
        'employer',
        form.contactName
      )
      if (error) throw error

      // Upsert employer_profiles row with signup data
      if (data?.user?.id) {
        await supabase.from('employer_profiles').upsert({
          user_id: data.user.id,
          org_name: form.orgName,
          contact_name: form.contactName,
          org_type: form.orgType,
          state: form.state,
          onboarding_stage: 'profile',
        }, { onConflict: 'user_id' })

        if (data.session?.access_token) {
          try {
            await apiRequest('/api/integrations/ghl/sync-self', {
              method: 'POST',
              accessToken: data.session.access_token
            })
          } catch (syncError) {
            console.error('Employer signup GHL sync failed:', syncError.message)
          }
        }
      }

      navigate('/login?signup=employer')
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

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
    }} className="auth-layout">
      {/* Left panel */}
      <div style={{
        background: 'linear-gradient(160deg, #2A1A4A 0%, #4A2A7A 100%)',
        padding: '60px 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px', textDecoration: 'none' }}>
          <img src="/logo.png" alt="Seraphyn" style={{ height: '38px', width: 'auto', objectFit: 'contain' }} />
          <span style={{ color: 'var(--cream)', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px' }}>Seraphyn</span>
        </Link>

        <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#D4A8F0', marginBottom: '16px' }}>
          Employer Portal
        </p>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '42px', fontWeight: '300', color: 'var(--cream)', lineHeight: '1.15', marginBottom: '24px' }}>
          Fill critical<br />positions with<br /><em style={{ color: '#D4A8F0', fontStyle: 'italic' }}>confidence</em>
        </h1>
        <p style={{ color: 'rgba(245,240,232,0.6)', fontSize: '14px', fontWeight: '300', lineHeight: '1.8', marginBottom: '40px' }}>
          Access thousands of verified, credentialed nurses ready for immediate placement.
        </p>
        {['Pre-verified nurse credentials', 'Average 4.2-day fill time', 'No placement until you approve'].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1px solid rgba(212,168,240,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#D4A8F0', flexShrink: 0 }}>✓</div>
            <span style={{ fontSize: '13px', color: 'rgba(245,240,232,0.7)', fontWeight: '300' }}>{item}</span>
          </div>
        ))}
      </div>

      {/* Right panel */}
      <div style={{ background: 'var(--cream)', padding: '60px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflowY: 'auto' }}>
        <div style={{ maxWidth: '460px', width: '100%', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '32px', color: 'var(--deep-navy)', marginBottom: '6px' }}>
            Register Your Organization
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '32px' }}>
            Already registered? <Link to="/login" style={{ color: 'var(--teal)', fontWeight: '500' }}>Sign in</Link>
          </p>

          {error && (
            <div style={{ background: 'rgba(200,60,60,0.1)', border: '1px solid rgba(200,60,60,0.3)', borderRadius: '2px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#C04040' }}>
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Contact Full Name</label>
              <input name="contactName" value={form.contactName} onChange={handle} placeholder="Dr. David Harris" required style={inputStyle} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Organization Name</label>
              <input name="orgName" value={form.orgName} onChange={handle} placeholder="St. Mary's Medical Center" required style={inputStyle} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Work Email</label>
              <input name="email" type="email" value={form.email} onChange={handle} placeholder="d.harris@stmarys.org" required style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Organization Type</label>
                <select name="orgType" value={form.orgType} onChange={handle} required style={inputStyle}>
                  <option value="">Select...</option>
                  {orgTypes.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>State</label>
                <select name="state" value={form.state} onChange={handle} required style={inputStyle}>
                  <option value="">Select...</option>
                  {states.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={labelStyle}>Password</label>
                <input name="password" type="password" value={form.password} onChange={handle} placeholder="••••••••" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handle} placeholder="••••••••" required style={inputStyle} />
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px',
              background: loading ? '#4A2A7A' : '#6A3AA0',
              color: 'white', border: 'none', borderRadius: '2px',
              fontSize: '12px', letterSpacing: '0.08em',
              textTransform: 'uppercase', fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}>
              {loading ? 'Registering...' : 'Register Organization →'}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '20px' }}>
            Looking to work as a nurse?{' '}
            <Link to="/nurse-signup" style={{ color: 'var(--teal)', fontWeight: '500' }}>Join as a Nurse</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
