import Navbar from './Navbar'
import MarketingFooter from './MarketingFooter'

export default function PublicPageLayout({ eyebrow, title, intro, children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />

      <section
        style={{
          padding: '128px 5% 56px',
          background: 'linear-gradient(135deg, rgba(44,62,80,0.98) 0%, rgba(61,90,115,0.96) 55%, rgba(126,181,200,0.88) 100%)',
          color: 'var(--warm-white)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', maxWidth: '900px', margin: '0 auto' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '14px' }}>
            {eyebrow}
          </p>
          <h1 style={{ fontSize: 'clamp(38px, 5vw, 64px)', fontWeight: '300', lineHeight: '1.06', marginBottom: '20px' }}>
            {title}
          </h1>
          <p style={{ maxWidth: '700px', fontSize: '17px', color: 'rgba(245,245,240,0.76)', lineHeight: '1.85' }}>
            {intro}
          </p>
        </div>
      </section>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '56px 24px 88px' }}>{children}</main>
      <MarketingFooter />
    </div>
  )
}
