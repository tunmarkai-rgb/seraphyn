import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { apiRequest } from '../lib/api'

async function routeAuthenticatedUser(navigate) {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user?.id) {
    navigate('/login?confirmed=1', { replace: true })
    return
  }

  const role = session.user.user_metadata?.role

  if (role === 'nurse') {
    try {
      await apiRequest('/api/integrations/ghl/sync-self', { method: 'POST' })
      await apiRequest('/api/integrations/events/self', {
        method: 'POST',
        body: { event: 'nurse.signup_confirmed' }
      })
    } catch (error) {
      console.error('Post-confirmation nurse sync failed:', error.message)
    }
    navigate('/nurse/dashboard', { replace: true })
    return
  }

  if (role === 'employer') {
    try {
      await apiRequest('/api/integrations/ghl/sync-self', { method: 'POST' })
    } catch (error) {
      console.error('Post-confirmation employer sync failed:', error.message)
    }
    navigate('/employer/onboarding', { replace: true })
    return
  }

  if (role === 'admin') {
    navigate('/admin', { replace: true })
    return
  }

  navigate('/login?confirmed=1', { replace: true })
}

export default function AuthConfirm() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('working')
  const [message, setMessage] = useState('Confirming your email and preparing your account...')

  useEffect(() => {
    let cancelled = false

    async function confirmEmail() {
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
          setStatus('error')
          setMessage(errorDescription)
        }
        return
      }

      try {
        const code = params.get('code')
        const tokenHash = params.get('token_hash') || hashParams.get('token_hash')
        const type = params.get('type') || hashParams.get('type')

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type
          })
          if (error) throw error
        } else {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session?.user) {
            throw new Error('This confirmation link is invalid or has expired.')
          }
        }

        if (cancelled) return

        setStatus('success')
        setMessage('Email confirmed. Redirecting you now...')
        await routeAuthenticatedUser(navigate)
      } catch (error) {
        if (!cancelled) {
          setStatus('error')
          setMessage(error.message || 'We could not confirm your email.')
        }
      }
    }

    void confirmEmail()

    return () => {
      cancelled = true
    }
  }, [navigate])

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
        boxShadow: '0 10px 30px rgba(44,62,80,0.08)',
        textAlign: 'center'
      }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '28px' }}>
          <img src="/logo.png" alt="Seraphyn" style={{ height: '38px', width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: 'var(--deep-navy)' }}>Seraphyn</span>
        </Link>

        <div style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 20px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: status === 'error' ? 'rgba(180,60,60,0.10)' : 'rgba(126,181,200,0.12)',
          color: status === 'error' ? '#B43C3C' : 'var(--deep-navy)',
          fontSize: '26px'
        }}>
          {status === 'error' ? '!' : status === 'success' ? '✓' : '...'}
        </div>

        <h1 style={{
          fontFamily: 'Cormorant Garamond, serif',
          fontSize: '36px',
          fontWeight: '400',
          color: 'var(--deep-navy)',
          marginBottom: '12px'
        }}>
          {status === 'error' ? 'Confirmation failed' : 'Confirming your account'}
        </h1>

        <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.7', marginBottom: status === 'error' ? '20px' : 0 }}>
          {message}
        </p>

        {status === 'error' && (
          <div style={{ marginTop: '24px' }}>
            <Link to="/login" style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: 'var(--deep-navy)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
