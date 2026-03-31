import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--deep-navy)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '32px',
            color: 'var(--warm-gold)',
            marginBottom: '16px'
          }}>✦</div>
          <p style={{ color: 'rgba(245,240,232,0.6)', fontSize: '13px', letterSpacing: '0.1em' }}>
            LOADING...
          </p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(profile?.role)) {
    // Redirect to correct dashboard based on role
    if (profile?.role === 'nurse') return <Navigate to="/nurse/dashboard" replace />
    if (profile?.role === 'employer') return <Navigate to="/employer/dashboard" replace />
    if (profile?.role === 'admin') return <Navigate to="/admin" replace />
    return <Navigate to="/" replace />
  }

  return children
}