import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      const { error: resetError } = await requestPasswordReset(email)
      if (resetError) throw resetError
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'We could not send the reset email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--warm-white)',
      fontFamily: 'DM Sans, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '36px 32px',
        boxShadow: '0 10px 30px rgba(44,62,80,0.08)'
      }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '28px' }}>
          <img src="/logo.png" alt="Seraphyn" style={{ height: '38px', width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: 'var(--deep-navy)' }}>Seraphyn</span>
        </Link>

        <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--sky-blue)', fontWeight: '600', marginBottom: '10px' }}>
          Account Recovery
        </p>
        <h1 style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: '38px',
          fontWeight: '300',
          color: 'var(--deep-navy)',
          lineHeight: '1.1',
          marginBottom: '12px',
        }}>
          Reset your<br />
          <em style={{ fontStyle: 'italic', color: 'var(--warm-gold)' }}>password</em>
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.7', marginBottom: '28px' }}>
          Enter the email address on your Seraphyn account and we&apos;ll send you a secure reset link.
        </p>

        {success && (
          <div style={{
            background: 'rgba(45,122,79,0.08)',
            border: '1px solid rgba(45,122,79,0.25)',
            borderRadius: '6px',
            padding: '14px 18px',
            marginBottom: '20px',
            fontSize: '13px',
            color: 'var(--success)'
          }}>
            Reset email sent. Check your inbox and open the link from the same device if possible.
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(200,60,60,0.07)',
            border: '1px solid rgba(200,60,60,0.25)',
            borderRadius: '6px',
            padding: '13px 16px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#C04040'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div style={{ marginBottom: '22px' }}>
            <label style={{
              display: 'block',
              fontSize: '10px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              fontWeight: '600',
              marginBottom: '8px'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%',
                padding: '13px 16px',
                background: 'var(--warm-white)',
                border: '1.5px solid var(--border)',
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none',
                color: 'var(--charcoal)',
                boxSizing: 'border-box'
              }}
            />
          </div>

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
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
          Remembered your password?{' '}
          <Link to="/login" style={{ color: 'var(--sky-blue)', fontWeight: '500' }}>Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}
