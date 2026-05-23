import { useEffect, useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAppBaseUrl, supabase } from '../lib/supabase'
import { SPECIALTIES, US_STATES } from '../lib/constants'
import { apiRequest, publicApiRequest } from '../lib/api'
import BrandLogo from '../components/BrandLogo'

function normalizeYearsExperience(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const allowed = new Set([
    '1-2 years',
    '3-5 years',
    '6-10 years',
    '10-15 years',
    '15+ years'
  ])

  if (allowed.has(raw)) {
    return raw
  }

  const numeric = Number.parseInt(raw, 10)
  if (Number.isNaN(numeric)) {
    return ''
  }

  if (numeric <= 2) return '1-2 years'
  if (numeric <= 5) return '3-5 years'
  if (numeric <= 10) return '6-10 years'
  if (numeric <= 15) return '10-15 years'
  return '15+ years'
}

function normalizeShiftPreference(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  if (raw === 'any') return 'any'

  const legacyAnyValues = new Set([
    'day',
    'night',
    'evening',
    'mixed',
    'per diem',
    'contract travel',
    'permanent',
    'flexible',
    'mixed / flexible'
  ])

  return legacyAnyValues.has(raw) ? 'any' : ''
}

export default function NurseSignup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [prefillLoading, setPrefillLoading] = useState(false)
  const [error, setError] = useState('')
  const [leadContext, setLeadContext] = useState({
    ghlContactId: null,
    ghlOpportunityId: null,
    source: ''
  })
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    licenseState: '',
    specialty: '',
    yearsExperience: '',
    shiftPreference: ''
  })

  useEffect(() => {
    let active = true

    async function loadLeadPrefill() {
      const token = searchParams.get('lead')
      if (!token) return

      setPrefillLoading(true)
      try {
        const data = await publicApiRequest(`/api/leads/nurse-prefill?token=${encodeURIComponent(token)}`)
        const lead = data.lead || {}
        if (!active) return

        setLeadContext({
          ghlContactId: lead.ghlContactId || null,
          ghlOpportunityId: lead.ghlOpportunityId || null,
          source: lead.source || 'ghl-form'
        })

        setForm((current) => ({
          ...current,
          firstName: current.firstName || lead.firstName || '',
          lastName: current.lastName || lead.lastName || '',
          email: current.email || lead.email || '',
          licenseState: current.licenseState || lead.licenseState || '',
          specialty: current.specialty || lead.specialty || '',
          yearsExperience: current.yearsExperience || normalizeYearsExperience(lead.yearsExperience),
          shiftPreference: current.shiftPreference || normalizeShiftPreference(lead.shiftPreference)
        }))
      } catch (prefillError) {
        if (active) {
          setError(prefillError.message)
        }
      } finally {
        if (active) {
          setPrefillLoading(false)
        }
      }
    }

    void loadLeadPrefill()

    return () => {
      active = false
    }
  }, [searchParams])

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
      const expMap = {
        '1-2 years': 1,
        '3-5 years': 3,
        '6-10 years': 6,
        '10-15 years': 10,
        '15+ years': 15
      }

      const normalizedShiftPreference = normalizeShiftPreference(form.shiftPreference)
      const { data, error: signUpError } = await signUp(
        form.email,
        form.password,
        'nurse',
        `${form.firstName} ${form.lastName}`,
        {
          data: {
            first_name: form.firstName,
            last_name: form.lastName,
            specialty: form.specialty,
            license_state: form.licenseState,
            years_experience: expMap[form.yearsExperience] || null,
            shift_preference: normalizedShiftPreference || null,
            source: leadContext.source || 'portal-signup',
            ghl_contact_id: leadContext.ghlContactId || null,
            ghl_opportunity_id: leadContext.ghlOpportunityId || null
          },
          emailRedirectTo: `${getAppBaseUrl()}/auth/confirm`
        }
      )
      if (signUpError) throw signUpError

      if (data?.user?.id) {
        const { error: profileUpsertError } = await supabase.from('nurse_profiles').upsert({
          user_id: data.user.id,
          first_name: form.firstName,
          last_name: form.lastName,
          license_state: form.licenseState,
          specialty: form.specialty,
          years_experience: expMap[form.yearsExperience] || null,
          shift_preference: normalizedShiftPreference || null
        }, { onConflict: 'user_id' })

        if (profileUpsertError) {
          console.error('Initial nurse profile upsert deferred until confirmed login:', profileUpsertError.message)
        }

        if (data.session?.access_token) {
          try {
            const syncResult = await apiRequest('/api/integrations/ghl/sync-self', {
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
                  licenseState: form.licenseState,
                  shiftPreference: normalizedShiftPreference || null,
                  source: leadContext.source || 'portal-signup',
                  ghlContactId: leadContext.ghlContactId || syncResult?.contactId || null,
                  ghlOpportunityId: leadContext.ghlOpportunityId || null
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
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', marginBottom: '48px', textDecoration: 'none' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '14px 18px',
              borderRadius: '999px',
              background: 'rgba(245,240,232,0.08)',
              border: '1px solid rgba(245,240,232,0.14)',
              boxShadow: '0 18px 40px rgba(6,16,26,0.28)'
            }}>
              <BrandLogo tone="light" size={36} showTagline={true} />
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
          {['Premium assignments, no hidden fees', 'Average 4-5 day placement', 'Verified and secure platform'].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '1px solid rgba(196,151,90,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--warm-gold)', flexShrink: 0 }}>✓</div>
              <span style={{ fontSize: '13px', color: 'rgba(245,240,232,0.7)', fontWeight: '300' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

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

          {prefillLoading && (
            <div style={{
              background: 'rgba(126,181,200,0.12)', border: '1px solid rgba(126,181,200,0.25)',
              borderRadius: '2px', padding: '12px 16px', marginBottom: '20px',
              fontSize: '13px', color: 'var(--deep-navy)'
            }}>
              Loading your nurse lead details...
            </div>
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
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: '500', marginBottom: '6px' }}>Specialty</label>
                <select name="specialty" value={form.specialty} onChange={handle} required
                  style={{ width: '100%', padding: '11px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '14px', outline: 'none', color: 'var(--charcoal)' }}>
                  <option value="">Select...</option>
                  {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: '500', marginBottom: '6px' }}>Years of Experience</label>
              <select name="yearsExperience" value={form.yearsExperience} onChange={handle} required
                style={{ width: '100%', padding: '11px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '14px', outline: 'none', color: 'var(--charcoal)' }}>
                <option value="">Select...</option>
                {['1-2 years', '3-5 years', '6-10 years', '10-15 years', '15+ years'].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: '500', marginBottom: '6px' }}>Shift Preference</label>
              <select name="shiftPreference" value={form.shiftPreference} onChange={handle}
                style={{ width: '100%', padding: '11px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '14px', outline: 'none', color: 'var(--charcoal)' }}>
                <option value="">Select...</option>
                <option value="any">Flexible / Any Shift</option>
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
