import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function prepareRecoverySession() {
      const url = new URL(window.location.href)
      const params = url.searchParams
      const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
      const errorDescription =
        params.get('error_description') ||
        hashParams.get('error_description') ||
        params.get('error') ||
        hashParams.get('error')

      if (errorDescription) {
        if (!cancelled) {
          setError(errorDescription)
          setReady(true)
        }
        return
      }

      try {
        const code = params.get('code')
        const tokenHash = params.get('token_hash') || hashParams.get('token_hash')
        const type = params.get('type') || hashParams.get('type')

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        } else if (tokenHash && type === 'recovery') {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery'
          })
          if (verifyError) throw verifyError
        } else {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session?.user) {
            throw new Error('This password reset link is invalid or has expired.')
          }
        }

        if (!cancelled) {
          setReady(true)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'We could not validate this reset link.')
          setReady(true)
        }
      }
    }

    void prepareRecoverySession()

    return () => {
      cancelled = true
    }
  }, [])

  async function submit(event) {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await updatePassword(password)
      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => {
        navigate('/login?reset=1', { replace: true })
      }, 1200)
    } catch (err) {
      setError(err.message || 'We could not update your password.')
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
          Password Recovery
        </p>
        <h1 style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: '38px',
          fontWeight: '300',
          color: 'var(--deep-navy)',
          lineHeight: '1.1',
          marginBottom: '12px',
        }}>
          Choose a new<br />
          <em style={{ fontStyle: 'italic', color: 'var(--warm-gold)' }}>password</em>
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.7', marginBottom: '28px' }}>
          Set a new password for your Seraphyn account. Your new password must be at least 8 characters.
        </p>

        {!ready && (
          <div style={{
            background: 'rgba(126,181,200,0.08)',
            border: '1px solid rgba(126,181,200,0.25)',
            borderRadius: '6px',
            padding: '14px 18px',
            marginBottom: '20px',
            fontSize: '13px',
            color: 'var(--deep-navy)'
          }}>
            Validating your reset link...
          </div>
        )}

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
            Password updated. Redirecting you to sign in...
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
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              disabled={!ready || success}
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
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="••••••••"
              required
              disabled={!ready || success}
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
            disabled={!ready || loading || success}
            style={{
              width: '100%',
              padding: '14px',
              background: !ready || loading || success ? 'var(--sky-blue)' : 'var(--deep-navy)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: '600',
              cursor: !ready || loading || success ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
          <Link to="/login" style={{ color: 'var(--sky-blue)', fontWeight: '500' }}>Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}
