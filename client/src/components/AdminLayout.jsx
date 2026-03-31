import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { path: '/admin',               icon: '📊', label: 'Overview' },
  { path: '/admin/nurses',        icon: '👩‍⚕️', label: 'Nurses' },
  { path: '/admin/employers',     icon: '🏥', label: 'Employers' },
  { path: '/admin/jobs',          icon: '📋', label: 'Jobs' },
  { path: '/admin/applications',  icon: '📨', label: 'Applications' },
  { path: '/admin/payments',      icon: '💳', label: 'Payments' },
  { path: '/admin/shifts',        icon: '⏰', label: 'Per Diem Shifts' },
]

export default function AdminLayout({ children, title }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif', background: 'var(--warm-white)' }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside style={{
        width: '240px', background: 'var(--charcoal)', display: 'flex', flexDirection: 'column',
        flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 50,
        transform: sidebarOpen ? 'translateX(0)' : undefined,
        transition: 'transform 0.3s'
      }} className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}>

        {/* Logo */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--warm-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '16px', flexShrink: 0 }}>✦</div>
            <div>
              <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: 'white', lineHeight: 1.2 }}>Seraphyn</p>
              <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Admin</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path
            return (
              <Link key={item.path} to={item.path}
                onClick={() => setSidebarOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', textDecoration: 'none', transition: 'all 0.15s', background: active ? 'rgba(200,169,110,0.15)' : 'transparent', borderLeft: active ? '3px solid var(--warm-gold)' : '3px solid transparent', color: active ? 'white' : 'rgba(255,255,255,0.55)', fontSize: '13px', fontWeight: active ? '500' : '400' }}>
                <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={handleSignOut}
            style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ marginLeft: '240px', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }} className="admin-main">

        {/* Top bar */}
        <header style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="admin-menu-btn"
              style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', flexDirection: 'column', gap: '4px', padding: '4px' }}>
              {[0,1,2].map(i => <span key={i} style={{ display: 'block', width: '20px', height: '1.5px', background: 'var(--deep-navy)' }} />)}
            </button>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)' }}>{title}</h1>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </header>

        <main style={{ flex: 1, padding: '32px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
