import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '' })
  const [focusedField, setFocusedField] = useState(null)

  const justSignedUp = searchParams.get('signup')

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error } = await signIn(form.email, form.password)
      if (error) throw error
      const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single()
      const role = userRow?.role
      if (role === 'nurse') navigate('/nurse/dashboard')
      else if (role === 'employer') navigate('/employer/dashboard')
      else if (role === 'admin') navigate('/admin')
      else navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const stats = [
    { value: '2,400+', label: 'Nurses Placed' },
    { value: '48', label: 'States Covered' },
    { value: '4.2 days', label: 'Avg Fill Time' },
  ]

  const testimonial = {
    quote: 'Seraphyn matched me with a perfect ICU assignment in under a week. The platform is seamless.',
    name: 'Sarah Chen, RN',
    specialty: 'Critical Care · New York',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      fontFamily: 'DM Sans, sans-serif',
    }} className="auth-layout">

      {/* ── LEFT PANEL ── */}
      <div style={{
        background: 'var(--deep-navy)',
        padding: '60px 52px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative orbs */}
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: '340px', height: '340px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(126,181,200,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '60px', left: '-100px',
          width: '380px', height: '380px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,169,110,0.12) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '45%', left: '55%',
          width: '180px', height: '180px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(126,181,200,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Top: Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <img
              src="/logo.png"
              alt="Seraphyn"
              style={{ height: '42px', width: 'auto', objectFit: 'contain' }}
            />
            <span style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: '22px',
              color: 'var(--warm-white)',
              fontWeight: '400',
              letterSpacing: '0.02em',
            }}>
              Seraphyn
            </span>
          </Link>
        </div>

        {/* Middle: Hero copy */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{
            fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--warm-gold)', marginBottom: '20px', fontWeight: '500',
          }}>
            Healthcare Staffing · Reimagined
          </p>
          <h1 style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: '52px',
            fontWeight: '300',
            color: 'var(--warm-white)',
            lineHeight: '1.1',
            marginBottom: '28px',
          }}>
            Where great<br />
            nurses meet<br />
            <em style={{ color: 'var(--warm-gold)', fontStyle: 'italic' }}>great roles</em>
          </h1>
          <p style={{
            color: 'rgba(245,245,240,0.55)',
            fontSize: '14px',
            lineHeight: '1.85',
            maxWidth: '340px',
            marginBottom: '48px',
          }}>
            Premium travel and contract assignments across the country — verified, transparent, and built around your career.
          </p>

          {/* Stats row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: '24px 0',
            marginBottom: '48px',
          }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                textAlign: 'center',
                borderRight: i < stats.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                padding: '0 16px',
              }}>
                <div style={{
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: '28px',
                  fontWeight: '400',
                  color: 'var(--warm-gold)',
                  lineHeight: '1',
                  marginBottom: '6px',
                }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(245,245,240,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Testimonial card */}
        <div style={{
          position: 'relative', zIndex: 1,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          padding: '28px 32px',
          backdropFilter: 'blur(8px)',
        }}>
          {/* Quote mark */}
          <div style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: '64px',
            color: 'var(--warm-gold)',
            opacity: 0.4,
            lineHeight: '0.6',
            marginBottom: '16px',
            fontWeight: '300',
          }}>"</div>
          <p style={{
            fontSize: '13px',
            color: 'rgba(245,245,240,0.75)',
            lineHeight: '1.75',
            marginBottom: '20px',
            fontStyle: 'italic',
          }}>
            {testimonial.quote}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--sky-blue), var(--warm-gold))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', color: 'white', fontWeight: '600', flexShrink: 0,
            }}>
              SC
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--warm-white)', fontWeight: '500' }}>{testimonial.name}</div>
              <div style={{ fontSize: '11px', color: 'rgba(245,245,240,0.45)', marginTop: '2px' }}>{testimonial.specialty}</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
              {[...Array(5)].map((_, i) => (
                <span key={i} style={{ color: 'var(--warm-gold)', fontSize: '11px' }}>★</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{
        background: 'var(--warm-white)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 48px',
        position: 'relative',
      }}>
        {/* Subtle background texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(126,181,200,0.07) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(200,169,110,0.06) 0%, transparent 50%)',
          pointerEvents: 'none',
        }} />

        <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>

          {/* Mobile logo (hidden on desktop via auth-layout) */}
          <div className="mobile-logo-only" style={{ textAlign: 'center', marginBottom: '36px', display: 'none' }}>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
              <img src="/logo.png" alt="Seraphyn" style={{ height: '36px', width: 'auto' }} />
              <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: 'var(--deep-navy)' }}>Seraphyn</span>
            </Link>
          </div>

          {justSignedUp && (
            <div style={{
              background: 'rgba(45,122,79,0.08)',
              border: '1px solid rgba(45,122,79,0.25)',
              borderRadius: '6px',
              padding: '14px 18px',
              marginBottom: '28px',
              fontSize: '13px',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <span style={{ fontSize: '16px' }}>✓</span>
              Account created! Check your email to confirm, then sign in below.
            </div>
          )}

          {/* Heading */}
          <div style={{ marginBottom: '40px' }}>
            <p style={{
              fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'var(--sky-blue)', fontWeight: '600', marginBottom: '10px',
            }}>
              Welcome Back
            </p>
            <h1 style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: '40px',
              fontWeight: '300',
              color: 'var(--deep-navy)',
              lineHeight: '1.1',
              marginBottom: '12px',
            }}>
              Sign in to your<br />
              <em style={{ fontStyle: 'italic', color: 'var(--sky-blue)' }}>account</em>
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Don't have an account?{' '}
              <Link to="/nurse-signup" style={{ color: 'var(--sky-blue)', fontWeight: '500' }}>Join as a Nurse</Link>
              {' '}or{' '}
              <Link to="/employer-signup" style={{ color: 'var(--sky-blue)', fontWeight: '500' }}>Register as Employer</Link>
            </p>
          </div>

          {/* Card */}
          <div style={{
            background: 'var(--pure-white)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '40px 36px',
            boxShadow: '0 4px 24px rgba(44,62,80,0.06), 0 1px 4px rgba(44,62,80,0.04)',
          }}>
            {error && (
              <div style={{
                background: 'rgba(200,60,60,0.07)',
                border: '1px solid rgba(200,60,60,0.25)',
                borderRadius: '6px',
                padding: '13px 16px',
                marginBottom: '24px',
                fontSize: '13px',
                color: '#C04040',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span>⚠</span> {error}
              </div>
            )}

            <form onSubmit={submit}>
              {[
                { name: 'email', label: 'Email Address', placeholder: 'your@email.com', type: 'email' },
                { name: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
              ].map(({ name, label, placeholder, type }) => (
                <div key={name} style={{ marginBottom: '22px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '10px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: focusedField === name ? 'var(--sky-blue)' : 'var(--text-muted)',
                    fontWeight: '600',
                    marginBottom: '8px',
                    transition: 'color 0.2s',
                  }}>
                    {label}
                  </label>
                  <input
                    name={name}
                    type={type}
                    value={form[name]}
                    onChange={handle}
                    placeholder={placeholder}
                    required
                    onFocus={() => setFocusedField(name)}
                    onBlur={() => setFocusedField(null)}
                    style={{
                      width: '100%',
                      padding: '13px 16px',
                      background: focusedField === name ? 'var(--pure-white)' : 'var(--warm-white)',
                      border: `1.5px solid ${focusedField === name ? 'var(--sky-blue)' : 'var(--border)'}`,
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none',
                      color: 'var(--charcoal)',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: loading ? 'var(--sky-blue)' : 'var(--deep-navy)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '6px',
                }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white', borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite', display: 'inline-block',
                    }} />
                    Signing in...
                  </>
                ) : (
                  'Sign In →'
                )}
              </button>
            </form>
          </div>

          {/* Trust line */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginTop: '28px',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}>
            <span>🔒</span>
            <span>Enterprise-grade security · All data encrypted in transit</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .mobile-logo-only { display: flex !important; justify-content: center; }
        }
      `}</style>
    </div>
  )
}
