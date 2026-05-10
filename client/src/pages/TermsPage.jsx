import PublicPageLayout from '../components/PublicPageLayout'

export default function TermsPage() {
  return (
    <PublicPageLayout
      eyebrow="Terms"
      title="Portal use should be clear before it becomes critical."
      intro="These high-level terms outline the intended use of the Seraphyn staffing portal and set expectations for user conduct, account responsibility, and platform availability."
    >
      <div style={{ display: 'grid', gap: '20px' }}>
        {[
          ['Use of the platform', 'The portal is intended for legitimate staffing activity by nurses, employers, and authorized administrators using accurate and current information.'],
          ['Account responsibility', 'Users are responsible for maintaining their credentials, protecting account access, and ensuring the information they submit is truthful and up to date.'],
          ['Hiring and placement decisions', 'Seraphyn may facilitate discovery, messaging, and workflow coordination, but final hiring, credential review, and placement decisions should follow the appropriate review process.'],
          ['Availability and updates', 'Portal features may evolve over time as the product matures. Seraphyn may update workflows, interface details, and supporting policies as needed.'],
        ].map(([title, body]) => (
          <section key={title} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '28px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '400', color: 'var(--deep-navy)', marginBottom: '12px' }}>{title}</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.85' }}>{body}</p>
          </section>
        ))}
      </div>
    </PublicPageLayout>
  )
}
