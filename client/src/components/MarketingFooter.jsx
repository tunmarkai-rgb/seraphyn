import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import { COMPANY_LINKS, EMPLOYER_LINKS, NURSE_LINKS, SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/site'

export default function MarketingFooter() {
  const columns = [
    { title: 'For Nurses', links: NURSE_LINKS },
    { title: 'For Employers', links: EMPLOYER_LINKS },
    { title: 'Company', links: COMPANY_LINKS },
  ]

  return (
    <footer style={{ background: 'var(--charcoal)', padding: '64px 5% 32px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr',
          gap: '48px',
          paddingBottom: '48px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '32px',
        }}
        className="footer-grid"
      >
        <div>
          <BrandLogo tone="light" size={34} showTagline={true} />
          <p
            style={{
              marginTop: '18px',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.45)',
              fontWeight: '300',
              lineHeight: '1.8',
              maxWidth: '320px',
            }}
          >
            Healthcare staffing for the modern era, connecting exceptional nurses with organizations that
            value excellence, speed, and transparency.
          </p>
          <div style={{ marginTop: '20px', fontSize: '13px', color: 'rgba(255,255,255,0.72)' }}>
            Reach the Seraphyn team:{' '}
            <a href={SUPPORT_MAILTO} style={{ color: 'var(--warm-gold)' }}>
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h5
              style={{
                fontSize: '11px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.3)',
                fontWeight: '500',
                marginBottom: '20px',
              }}
            >
              {col.title}
            </h5>
            {col.links.map(([label, href]) => (
              <Link
                key={label}
                to={href}
                style={{
                  display: 'block',
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: '13px',
                  marginBottom: '10px',
                  textDecoration: 'none',
                }}
              >
                {label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)' }}>
          © 2026 Seraphyn Care Solutions. All rights reserved.
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Trusted healthcare staffing, reimagined
        </div>
      </div>
    </footer>
  )
}
