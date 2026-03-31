import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '' })

  const justSignedUp = searchParams.get('signup')

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error } = await signIn(form.email, form.password)
      if (error) throw error
      // Redirect based on role from public.users table (not user_metadata)
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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px'
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '32px', textDecoration: 'none' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--deep-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warm-gold)', fontSize: '18px' }}>✦</div>
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: 'var(--deep-navy)' }}>Seraphyn</span>
          </Link>

          {justSignedUp && (
            <div style={{
              background: 'rgba(45,122,79,0.1)', border: '1px solid rgba(45,122,79,0.3)',
              borderRadius: '2px', padding: '12px 16px', marginBottom: '20px',
              fontSize: '13px', color: 'var(--success)', textAlign: 'left'
            }}>
              ✓ Account created! Check your email to confirm, then sign in below.
            </div>
          )}

          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '36px', color: 'var(--deep-navy)', marginBottom: '8px' }}>
            Welcome back
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Sign in to your Seraphyn account</p>
        </div>

        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '40px' }}>
          {error && (
            <div style={{
              background: 'rgba(200,60,60,0.1)', border: '1px solid rgba(200,60,60,0.3)',
              borderRadius: '2px', padding: '12px 16px', marginBottom: '20px',
              fontSize: '13px', color: '#C04040'
            }}>{error}</div>
          )}

          <form onSubmit={submit}>
            {[['email', 'Email Address', 'your@email.com', 'email'], ['password', 'Password', '••••••••', 'password']].map(([name, label, ph, type]) => (
              <div key={name} style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: '500', marginBottom: '8px' }}>{label}</label>
                <input name={name} type={type} value={form[name]} onChange={handle} placeholder={ph} required
                  style={{ width: '100%', padding: '12px 14px', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '14px', outline: 'none', color: 'var(--charcoal)' }} />
              </div>
            ))}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px', background: loading ? 'var(--teal)' : 'var(--deep-navy)',
              color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px',
              letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '20px'
            }}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            New to Seraphyn?{' '}
            <Link to="/nurse-signup" style={{ color: 'var(--teal)', fontWeight: '500' }}>Join as a Nurse</Link>
            {' '}or{' '}
            <Link to="/employer-signup" style={{ color: 'var(--teal)', fontWeight: '500' }}>Register as Employer</Link>
          </div>
        </div>
      </div>
    </div>
  )
}