import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { SPECIALTIES, US_STATES } from '../lib/constants'
import { apiRequest } from '../lib/api'

export default function NurseSignup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    password: '', confirmPassword: '',
    licenseState: '', specialty: '', yearsExperience: ''
  })


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
        'nurse',
        `${form.firstName} ${form.lastName}`
      )
      if (error) throw error

      // Upsert nurse_profiles row with signup data
      if (data?.user?.id) {
        const expMap = { '1-2 years': 1, '3-5 years': 3, '6-10 years': 6, '10-15 years': 10, '15+ years': 15 }
        await supabase.from('nurse_profiles').upsert({
          user_id: data.user.id,
          first_name: form.firstName,
          last_name: form.lastName,
          license_state: form.licenseState,
          specialty: form.specialty,
          years_experience: expMap[form.yearsExperience] || null,
        }, { onConflict: 'user_id' })

        if (data.session?.access_token) {
          try {
            await apiRequest('/api/integrations/ghl/sync-self', {
              method: 'POST',
              accessToken: data.session.access_token
            })
            await apiRequest('/api/integrations/events/self', {
              method: 'POST',
              accessToken: data.session.access_token,
              body: {
                event: 'nurse.signup_confirmed',
                payload: {
                  specialty: form.specialty,
                  licenseState: form.licenseState
                }
              }
            })
          } catch (syncError) {
            console.error('Nurse signup GHL sync failed:', syncError.message)
          }
        }
      }

      navigate('/login?signup=nurse')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      fontFamily: 'DM Sans, sans-serif'
    }} className="auth-layout">
      {/* Left panel */}
      <div style={{
        background: 'var(--deep-navy)',
        padding: '60px 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link to="/" style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            marginBottom: '48px', textDecoration: 'none'
          }}>
            <img src="/logo.png" alt="Seraphyn" style={{ height: '38px', width: 'auto', objectFit: 'contain' }} />
            <span style={{ color: 'var(--cream)', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px' }}>
              Seraphyn
            </span>
          </Link>
          <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '16px' }}>
            Nurse Portal
          </p>
          <h1 style={{
            fontFamily: 'Cormorant Garamond, serif', fontSize: '42px',
            fontWeight: '300', color: 'var(--cream)', lineHeight: '1.15',
            marginBottom: '24px'
          }}>
            Your next great<br /><em style={{ color: 'var(--warm-gold)', fontStyle: 'italic' }}>assignment</em><br />awaits
          </h1>
          <p style={{ color: 'rgba(245,240,232,0.6)', fontSize: '14px', fontWeight: '300', lineHeight: '1.8', marginBottom: '40px' }}>
            Join thousands of verified nurses earning premium rates on travel and contract assignments nationwide.
          </p>
          {['Premium assignments, no hidden fees', 'Average 4–5 day placement', 'Verified and secure platform'].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1px solid rgba(196,151,90,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--warm-gold)', flexShrink: 0 }}>✓</div>
              <span style={{ fontSize: '13px', color: 'rgba(245,240,232,0.7)', fontWeight: '300' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        background: 'var(--cream)',
        padding: '60px 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        overflowY: 'auto'
      }}>
        <div style={{ maxWidth: '460px', width: '100%', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '32px', color: 'var(--deep-navy)', marginBottom: '6px' }}>
            Create Your Profile
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '32px' }}>
            Already a member? <Link to="/login" style={{ color: 'var(--teal)', fontWeight: '500' }}>Sign in</Link>
          </p>

          {error && (
            <div style={{
              background: 'rgba(200,60,60,0.1)', border: '1px solid rgba(200,60,60,0.3)',
              borderRadius: '2px', padding: '12px 16px', marginBottom: '20px',
              fontSize: '13px', color: '#C04040'
            }}>{error}</div>
          )}

          <form onSubmit={submit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {[['firstName', 'First Name', 'Sarah'], ['lastName', 'Last Name', 'Chen']].map(([name, label, ph]) => (
                <div key={name}>
                  <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: '500', marginBottom: '6px' }}>{label}</label>
                  <input name={name} value={form[name]} onChange={handle} placeholder={ph} required
                    style={{ width: '100%', padding: '11px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '14px', outline: 'none', color: 'var(--charcoal)' }} />
                </div>
              ))}
            </div>

            {[['email', 'Email Address', 'sarah@email.com', 'email'], ['password', 'Password', '••••••••', 'password'], ['confirmPassword', 'Confirm Password', '••••••••', 'password']].map(([name, label, ph, type]) => (
              <div key={name} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: '500', marginBottom: '6px' }}>{label}</label>
                <input name={name} type={type} value={form[name]} onChange={handle} placeholder={ph} required
                  style={{ width: '100%', padding: '11px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '14px', outline: 'none', color: 'var(--charcoal)' }} />
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: '500', marginBottom: '6px' }}>License State</label>
                <select name="licenseState" value={form.licenseState} onChange={handle} required
                  style={{ width: '100%', padding: '11px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '14px', outline: 'none', color: 'var(--charcoal)' }}>
                  <option value="">Select state...</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: '500', marginBottom: '6px' }}>Specialty</label>
                <select name="specialty" value={form.specialty} onChange={handle} required
                  style={{ width: '100%', padding: '11px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '14px', outline: 'none', color: 'var(--charcoal)' }}>
                  <option value="">Select...</option>
                  {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: '500', marginBottom: '6px' }}>Years of Experience</label>
              <select name="yearsExperience" value={form.yearsExperience} onChange={handle} required
                style={{ width: '100%', padding: '11px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '14px', outline: 'none', color: 'var(--charcoal)' }}>
                <option value="">Select...</option>
                {['1-2 years', '3-5 years', '6-10 years', '10-15 years', '15+ years'].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px', background: loading ? 'var(--teal-mid)' : 'var(--deep-navy)',
              color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px',
              letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
            }}>
              {loading ? 'Creating Profile...' : 'Create My Profile →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
