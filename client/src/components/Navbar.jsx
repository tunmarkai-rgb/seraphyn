import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BrandLogo from './BrandLogo'
import NotificationBell from './NotificationBell'

const baseLinkStyle = {
  fontSize: '13px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  fontWeight: '500',
}

function routeIsActive(pathname, href) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function Navbar({ transparent = false }) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24)
    handleScroll()
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const role = profile?.role
  const heroMode = transparent && !scrolled
  const tone = heroMode ? 'light' : 'dark'

  const navLinks = useMemo(() => {
    if (!user) {
      return [
        { label: 'Browse Jobs', href: '/jobs' },
        { label: 'Find Nurses', href: '/nurses' },
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' },
      ]
    }

    if (role === 'nurse') {
      return [
        { label: 'Dashboard', href: '/nurse/dashboard' },
        { label: 'Browse Jobs', href: '/jobs' },
        { label: 'Applications', href: '/nurse/applications' },
        { label: 'Messages', href: '/messages' },
        { label: 'Profile', href: '/nurse/profile' },
        { label: 'Contact', href: '/contact' },
      ]
    }

    if (role === 'employer') {
      return [
        { label: 'Dashboard', href: '/employer/dashboard' },
        { label: 'Find Nurses', href: '/nurses' },
        { label: 'Post Job', href: '/employer/post-job' },
        { label: 'Messages', href: '/messages' },
        { label: 'Contact', href: '/contact' },
      ]
    }

    return [
      { label: 'Home', href: '/' },
      { label: 'Contact', href: '/contact' },
    ]
  }, [role, user])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const linkColor = heroMode ? 'rgba(245,245,240,0.92)' : 'var(--deep-navy)'
  const mutedColor = heroMode ? 'rgba(245,245,240,0.72)' : 'var(--text-muted)'
  const navBg = heroMode ? 'linear-gradient(180deg, rgba(20,34,48,0.88), rgba(20,34,48,0.52))' : 'rgba(245,245,240,0.94)'
  const navBorder = heroMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid var(--border)'

  return (
    <>
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: navBg,
          backdropFilter: 'blur(18px)',
          borderBottom: navBorder,
          boxShadow: heroMode ? 'none' : '0 12px 32px rgba(44,62,80,0.08)',
          padding: '0 5%',
          minHeight: '78px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.3s',
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
          <BrandLogo tone={tone} size={30} showTagline={!heroMode} />
        </Link>

        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }} className="nav-links-desktop">
          {navLinks.map((item) => {
            const active = routeIsActive(location.pathname, item.href)
            return (
              <Link
                key={item.href}
                to={item.href}
                style={{
                  ...baseLinkStyle,
                  color: active ? 'var(--warm-gold)' : linkColor,
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }} className="nav-links-desktop">
          {!user ? (
            <>
              <Link
                to="/login"
                style={{
                  padding: '9px 18px',
                  border: `1px solid ${heroMode ? 'rgba(245,245,240,0.28)' : 'var(--border)'}`,
                  color: linkColor,
                  borderRadius: '999px',
                  fontSize: '12px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: '600',
                  textDecoration: 'none',
                }}
              >
                Login
              </Link>
              <Link
                to="/nurse-signup"
                style={{
                  padding: '9px 18px',
                  border: `1px solid ${heroMode ? 'rgba(245,245,240,0.28)' : 'var(--deep-navy)'}`,
                  color: linkColor,
                  borderRadius: '999px',
                  fontSize: '12px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: '600',
                  textDecoration: 'none',
                }}
              >
                I&apos;m a Nurse
              </Link>
              <Link
                to="/employer-signup"
                style={{
                  padding: '10px 18px',
                  background: 'var(--warm-gold)',
                  color: 'white',
                  borderRadius: '999px',
                  fontSize: '12px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: '700',
                  textDecoration: 'none',
                }}
              >
                Post Jobs
              </Link>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <NotificationBell tone={tone} />
              <Link
                to={role === 'nurse' ? '/nurse/profile' : role === 'employer' ? '/employer/dashboard' : '/'}
                style={{
                  display: 'inline-flex',
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--warm-gold)',
                  color: 'white',
                  fontFamily: 'Cormorant Garamond, serif',
                  fontSize: '16px',
                  textDecoration: 'none',
                }}
              >
                {profile?.full_name?.[0]?.toUpperCase() || '?'}
              </Link>
              <button
                onClick={handleSignOut}
                style={{
                  padding: '9px 16px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: mutedColor,
                  borderRadius: '999px',
                  fontSize: '12px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>

        {user && (
          <div style={{ display: 'none', alignItems: 'center', gap: '10px' }} className="mobile-auth-tools">
            <NotificationBell tone={tone} />
          </div>
        )}

        <button
          onClick={() => setMenuOpen((open) => !open)}
          style={{ display: 'none', flexDirection: 'column', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          className="mobile-menu-btn"
        >
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ display: 'block', width: '24px', height: '1.5px', background: linkColor, transition: 'all 0.3s' }} />
          ))}
        </button>
      </nav>

      {menuOpen && (
        <div
          style={{
            position: 'fixed',
            top: '78px',
            left: 0,
            right: 0,
            zIndex: 99,
            background: 'rgba(245,245,240,0.98)',
            borderBottom: '1px solid var(--border)',
            padding: '20px 5% 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '0 16px 36px rgba(44,62,80,0.08)',
          }}
        >
          {navLinks.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMenuOpen(false)}
              style={{
                fontSize: '14px',
                color: routeIsActive(location.pathname, item.href) ? 'var(--warm-gold)' : 'var(--deep-navy)',
                textDecoration: 'none',
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {item.label}
            </Link>
          ))}

          {user ? (
            <button
              onClick={handleSignOut}
              style={{ padding: '12px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '999px', fontSize: '13px' }}
            >
              Sign Out
            </button>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginTop: '4px' }}>
              <Link to="/login" onClick={() => setMenuOpen(false)} style={{ padding: '12px', border: '1px solid var(--border)', color: 'var(--deep-navy)', borderRadius: '999px', fontSize: '12px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>
                Login
              </Link>
              <Link to="/nurse-signup" onClick={() => setMenuOpen(false)} style={{ padding: '12px', border: '1px solid var(--deep-navy)', color: 'var(--deep-navy)', borderRadius: '999px', fontSize: '12px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>
                I&apos;m a Nurse
              </Link>
              <Link to="/employer-signup" onClick={() => setMenuOpen(false)} style={{ padding: '12px', background: 'var(--warm-gold)', color: 'white', borderRadius: '999px', fontSize: '12px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '700' }}>
                Post Jobs
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  )
}
