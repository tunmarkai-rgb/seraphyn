import PublicPageLayout from '../components/PublicPageLayout'

export default function PrivacyPage() {
  return (
    <PublicPageLayout
      eyebrow="Privacy Policy"
      title="A practical privacy page for the current Seraphyn portal."
      intro="This page gives users a clear overview of how the staffing portal handles account details, profile information, application activity, and support communications."
    >
      <div style={{ display: 'grid', gap: '20px' }}>
        {[
          ['Information we collect', 'Account information, profile data, application activity, and messages submitted through the platform may be stored so the portal can support staffing workflows.'],
          ['How it is used', 'Information is used to authenticate users, display relevant jobs or candidate profiles, support onboarding, and help the Seraphyn team resolve issues or coordinate placements.'],
          ['Sharing and access', 'Access should be limited to authorized users and administrators who need the information to operate the staffing portal and placement process.'],
          ['Questions', 'If a user has a privacy concern or wants clarification on data handling, they should contact the Seraphyn team directly through the contact page.'],
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
