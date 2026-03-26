import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar({ transparent = false }) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Scroll effect for transparent navbars
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const navBg = transparent && !scrolled
    ? 'rgba(0,0,0,0)'
    : 'rgba(245,245,240,0.97)'

  const navBorder = transparent && !scrolled
    ? '1px solid rgba(255,255,255,0.1)'
    : '1px solid var(--border)'

  const linkColor = transparent && !scrolled
    ? 'rgba(245,245,240,0.85)'
    : 'var(--deep-navy)'

  const logoFilter = transparent && !scrolled
    ? 'brightness(0) invert(1) opacity(0.9)'
    : 'none'

  const getDashboardLink = () => {
    if (profile?.role === 'nurse') return '/nurse/dashboard'
    if (profile?.role === 'employer') return '/employer/dashboard'
    if (profile?.role === 'admin') return '/admin'
    return '/'
  }

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: navBg,
        backdropFilter: scrolled || !transparent ? 'blur(12px)' : 'none',
        borderBottom: navBorder,
        padding: '0 5%', height: '72px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'all 0.3s'
      }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img
            src="/logo.png"
            alt="Seraphyn Care Solutions"
            style={{ height: '40px', width: 'auto', filter: logoFilter, transition: 'filter 0.3s' }}
          />
        </Link>

        {/* Desktop nav links */}
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }} className="nav-links-desktop">
          {!user && (
            <>
              <Link to="/jobs" style={{ fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase', color: linkColor, textDecoration: 'none', fontWeight: '400', transition: 'color 0.2s' }}>
                Browse Jobs
              </Link>
              <Link to="/nurses" style={{ fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase', color: linkColor, textDecoration: 'none', fontWeight: '400' }}>
                Find Nurses
              </Link>
            </>
          )}
          {user && (
            <Link to={getDashboardLink()} style={{ fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase', color: linkColor, textDecoration: 'none', fontWeight: '400' }}>
              Dashboard
            </Link>
          )}
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }} className="nav-links-desktop">
          {!user ? (
            <>
              <Link to="/nurse-signup" style={{ padding: '9px 20px', border: `1px solid ${transparent && !scrolled ? 'rgba(245,245,240,0.5)' : 'var(--deep-navy)'}`, color: linkColor, borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500', textDecoration: 'none', transition: 'all 0.2s' }}>
                I'm a Nurse
              </Link>
              <Link to="/employer-signup" style={{ padding: '9px 20px', background: 'var(--warm-gold)', color: 'white', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500', textDecoration: 'none' }}>
                Post Jobs
              </Link>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--warm-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: 'white', cursor: 'pointer' }}>
                {profile?.full_name?.[0]?.toUpperCase() || '?'}
              </div>
              <button onClick={handleSignOut} style={{ padding: '8px 16px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ display: 'none', flexDirection: 'column', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          className="mobile-menu-btn"
        >
          {[0,1,2].map(i => (
            <span key={i} style={{ display: 'block', width: '24px', height: '1.5px', background: linkColor, transition: 'all 0.3s' }} />
          ))}
        </button>
      </nav>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: '72px', left: 0, right: 0, zIndex: 99,
          background: 'var(--warm-white)', borderBottom: '1px solid var(--border)',
          padding: '24px 5%', display: 'flex', flexDirection: 'column', gap: '16px'
        }}>
          <Link to="/jobs" onClick={() => setMenuOpen(false)} style={{ fontSize: '14px', color: 'var(--deep-navy)', textDecoration: 'none', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>Browse Jobs</Link>
          <Link to="/nurses" onClick={() => setMenuOpen(false)} style={{ fontSize: '14px', color: 'var(--deep-navy)', textDecoration: 'none', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>Find Nurses</Link>
          {user ? (
            <>
              <Link to={getDashboardLink()} onClick={() => setMenuOpen(false)} style={{ fontSize: '14px', color: 'var(--deep-navy)', textDecoration: 'none', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>Dashboard</Link>
              <button onClick={handleSignOut} style={{ padding: '12px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '13px', cursor: 'pointer' }}>Sign Out</button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '12px' }}>
              <Link to="/nurse-signup" onClick={() => setMenuOpen(false)} style={{ flex: 1, padding: '12px', border: '1px solid var(--deep-navy)', color: 'var(--deep-navy)', borderRadius: '2px', fontSize: '12px', textAlign: 'center', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '500' }}>I'm a Nurse</Link>
              <Link to="/employer-signup" onClick={() => setMenuOpen(false)} style={{ flex: 1, padding: '12px', background: 'var(--warm-gold)', color: 'white', borderRadius: '2px', fontSize: '12px', textAlign: 'center', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '500' }}>Post Jobs</Link>
            </div>
          )}
        </div>
      )}
    </>
  )
}