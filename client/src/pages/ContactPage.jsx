import PublicPageLayout from '../components/PublicPageLayout'
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/site'

const contactCards = [
  {
    title: 'General support',
    body: 'Questions about access, onboarding, or how the platform works.',
  },
  {
    title: 'Employer help',
    body: 'Need help registering your facility, posting a job, or reviewing candidates.',
  },
  {
    title: 'Nurse help',
    body: 'Need help with account access, profile setup, or applications.',
  },
]

export default function ContactPage() {
  return (
    <PublicPageLayout
      eyebrow="Contact"
      title="Reach the Seraphyn team without the runaround."
      intro="We want support to feel as polished as the product. Use the contact details below and the right person on the Seraphyn team can help you move forward quickly."
    >
      <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginBottom: '28px' }}>
        <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '32px' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '12px' }}>Primary contact</p>
          <h2 style={{ fontSize: '34px', fontWeight: '400', color: 'var(--deep-navy)', marginBottom: '16px' }}>Email the team</h2>
          <a href={SUPPORT_MAILTO} style={{ fontSize: '24px', color: 'var(--deep-navy)', fontFamily: 'Cormorant Garamond, serif' }}>
            {SUPPORT_EMAIL}
          </a>
          <p style={{ marginTop: '18px', color: 'var(--text-muted)', lineHeight: '1.85' }}>
            For the current portal, email is the clearest support path and works for both nurses and employers.
          </p>
        </section>

        <section style={{ background: 'linear-gradient(180deg, rgba(44,62,80,0.96), rgba(61,90,115,0.96))', borderRadius: '8px', padding: '32px', color: 'var(--warm-white)' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '12px' }}>Response expectations</p>
          <h3 style={{ fontSize: '30px', fontWeight: '400', marginBottom: '14px' }}>Concise, direct, and helpful.</h3>
          <p style={{ color: 'rgba(245,245,240,0.72)', lineHeight: '1.85' }}>
            Include whether you are a nurse or employer, what page you are on, and what outcome you need. That will help the team respond faster.
          </p>
        </section>
      </div>

      <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {contactCards.map((card) => (
          <section key={card.title} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px' }}>
            <h4 style={{ fontSize: '24px', fontWeight: '400', color: 'var(--deep-navy)', marginBottom: '10px' }}>{card.title}</h4>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>{card.body}</p>
          </section>
        ))}
      </div>
    </PublicPageLayout>
  )
}
