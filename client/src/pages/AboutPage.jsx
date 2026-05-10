import { Link } from 'react-router-dom'
import PublicPageLayout from '../components/PublicPageLayout'

const principles = [
  'Verified nurses and transparent employer onboarding',
  'Direct, modern communication between talent and facilities',
  'A placement experience designed around speed without sacrificing trust',
]

export default function AboutPage() {
  return (
    <PublicPageLayout
      eyebrow="About Seraphyn"
      title="Healthcare staffing built to feel more human and more dependable."
      intro="Seraphyn exists to help exceptional nurses and healthcare organizations connect faster, with better visibility, cleaner workflows, and a brand of service that feels premium from first click to final placement."
    >
      <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '28px', marginBottom: '32px' }}>
        <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '32px' }}>
          <h2 style={{ fontSize: '34px', fontWeight: '400', color: 'var(--deep-navy)', marginBottom: '16px' }}>What we stand for</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.9', marginBottom: '20px' }}>
            Traditional staffing often feels opaque, fragmented, and slower than it should be. Seraphyn is designed to
            make job discovery, hiring, and communication feel clear, elegant, and accountable for both sides of the marketplace.
          </p>
          {principles.map((item) => (
            <div key={item} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '14px' }}>
              <span style={{ width: '10px', height: '10px', marginTop: '8px', borderRadius: '50%', background: 'var(--warm-gold)', flexShrink: 0 }} />
              <span style={{ color: 'var(--deep-navy)' }}>{item}</span>
            </div>
          ))}
        </section>

        <section style={{ background: 'linear-gradient(180deg, rgba(126,181,200,0.14), rgba(200,169,110,0.1))', border: '1px solid rgba(44,62,80,0.08)', borderRadius: '8px', padding: '32px' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '14px' }}>Who We Serve</p>
          <h3 style={{ fontSize: '30px', fontWeight: '400', color: 'var(--deep-navy)', marginBottom: '14px' }}>Nurses and employers who expect a higher standard.</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.85', marginBottom: '24px' }}>
            Whether you are seeking your next assignment or filling urgent staffing gaps, Seraphyn is built to reduce friction and increase confidence.
          </p>
          <Link to="/contact" style={{ display: 'inline-block', padding: '12px 20px', background: 'var(--deep-navy)', color: 'white', borderRadius: '4px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Contact the Team
          </Link>
        </section>
      </div>
    </PublicPageLayout>
  )
}
