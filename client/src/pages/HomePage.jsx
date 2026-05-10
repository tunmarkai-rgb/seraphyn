import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MarketingFooter from '../components/MarketingFooter'
import Navbar from '../components/Navbar'

const BRAND_COLORS = ['#2C3E50', '#7EB5C8', '#C8A96E']

const stats = [
  { number: '2,400+', label: 'Verified Nurses' },
  { number: '340+', label: 'Healthcare Organizations' },
  { number: '8,900', label: 'Successful Placements' },
  { number: '98%', label: 'Satisfaction Rate' },
]

const steps = [
  { num: '1', title: 'Create Your Profile', desc: 'Nurses build profiles with credentials and availability. Employers create their organization profile and publish open roles.' },
  { num: '2', title: 'Verification and Approval', desc: 'Our team reviews nursing licenses and employer details so both sides can move with more confidence.' },
  { num: '3', title: 'Browse and Connect', desc: 'Nurses discover tailored opportunities. Employers review qualified talent matched to real staffing needs.' },
  { num: '4', title: 'Apply and Hire', desc: 'Direct applications, streamlined coordination, and faster onboarding help placements move in days, not weeks.' },
]

const FALLBACK_JOBS = [
  { org: "St. Mary's Medical Center", location: 'Chicago, IL', title: 'Travel ICU Registered Nurse', specialty: 'Intensive Care Unit', shift: 'Night Shift', contract: '13 Weeks', pay: '$78', initials: 'SM', color: '#2C3E50' },
  { org: 'Northwestern Health', location: 'Seattle, WA', title: 'Pediatric ER Nurse', specialty: 'Emergency Department', shift: 'Day Shift', contract: '26 Weeks', pay: '$85', initials: 'NH', color: '#7EB5C8' },
  { org: 'Baystate Health System', location: 'Boston, MA', title: 'OR Circulator RN', specialty: 'Operating Room', shift: 'Mixed Shifts', contract: '13 Weeks', pay: '$92', initials: 'BH', color: '#C8A96E' },
]

const FALLBACK_NURSES = [
  { name: 'Sarah C.', creds: 'RN, BSN, CCRN', specialty: 'ICU / Critical Care', exp: '8 yrs', initials: 'SC', color: '#2C3E50', skills: ['Ventilator', 'ACLS', 'CRRT'] },
  { name: 'Marcus R.', creds: 'RN, BSN, CEN', specialty: 'Emergency Dept.', exp: '12 yrs', initials: 'MR', color: '#7EB5C8', skills: ['Trauma', 'TNCC', 'PALS'] },
  { name: 'Amara T.', creds: 'RN, MSN, CNOR', specialty: 'Surgical / OR', exp: '6 yrs', initials: 'AT', color: '#C8A96E', skills: ['Circulator', 'Robotics', 'Scrub'] },
]

const testimonials = [
  { text: 'Seraphyn placed me in my ideal travel assignment within a week. The process felt clear and personal from start to finish.', name: 'Jennifer L., RN', role: 'ICU Travel Nurse', initials: 'JL' },
  { text: 'We filled multiple urgent roles fast, and every candidate felt well-vetted. The platform experience is noticeably stronger than traditional staffing.', name: 'Dr. David Harris', role: 'Chief Nursing Officer', initials: 'DH' },
  { text: 'Direct communication, transparent expectations, and stronger role quality made this feel like a much better way to work.', name: 'Patricia W., BSN, CCRN', role: 'Critical Care Nurse', initials: 'PW' },
]

function SectionEyebrow({ children }) {
  return (
    <p
      style={{
        fontSize: '11px',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: 'var(--warm-gold)',
        fontWeight: '500',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <span style={{ width: '32px', height: '1px', background: 'var(--warm-gold)', display: 'inline-block' }} />
      {children}
    </p>
  )
}

export default function HomePage() {
  const [jobs, setJobs] = useState(FALLBACK_JOBS)
  const [nurses, setNurses] = useState(FALLBACK_NURSES)

  useEffect(() => {
    const api = import.meta.env.VITE_API_URL || ''

    fetch(`${api}/api/jobs?limit=3`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) return
        setJobs(
          data.map((job, i) => ({
            id: job.id,
            org: job.employer_profiles?.org_name || 'Healthcare Facility',
            location: job.employer_profiles ? `${job.employer_profiles.city}, ${job.employer_profiles.state}` : job.state,
            title: job.title,
            specialty: job.specialty,
            shift: job.shift_type,
            contract: job.contract_length || 'Contract',
            pay: job.pay_rate ? `$${job.pay_rate}` : 'Competitive',
            initials: (job.employer_profiles?.org_name || 'HC').slice(0, 2).toUpperCase(),
            color: BRAND_COLORS[i % 3],
          }))
        )
      })
      .catch(() => {})

    fetch(`${api}/api/nurses/featured`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) return
        setNurses(
          data.map((nurse, i) => {
            const certs = Array.isArray(nurse.certifications) ? nurse.certifications : []
            return {
              name: `${nurse.first_name || ''}${nurse.last_name ? ` ${nurse.last_name[0]}.` : ''}`.trim(),
              creds: certs.length > 0 ? `RN, ${certs.slice(0, 2).join(', ')}` : 'RN',
              specialty: nurse.specialty,
              exp: nurse.years_experience ? `${nurse.years_experience} yrs` : '',
              initials: `${nurse.first_name?.[0] || ''}${nurse.last_name?.[0] || ''}`.toUpperCase(),
              color: BRAND_COLORS[i % 3],
              skills: certs.slice(0, 3),
            }
          })
        )
      })
      .catch(() => {})
  }, [])

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', background: 'var(--warm-white)' }}>
      <Navbar transparent={true} />

      <section
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, var(--deep-navy) 0%, #3D5A73 58%, var(--sky-blue) 100%)',
          display: 'flex',
          alignItems: 'center',
          padding: '132px 5% 84px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/hero-bg.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.14,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />

        <div style={{ position: 'relative', maxWidth: '700px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(200,169,110,0.15)',
              border: '1px solid rgba(200,169,110,0.38)',
              padding: '7px 14px',
              borderRadius: '999px',
              marginBottom: '28px',
              fontSize: '11px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--warm-gold)',
              fontWeight: '600',
            }}
          >
            <span style={{ width: '6px', height: '6px', background: 'var(--warm-gold)', borderRadius: '50%', display: 'inline-block' }} />
            Healthcare Staffing, Reimagined
          </div>

          <h1
            style={{
              fontFamily: 'Cormorant Garamond, serif',
              fontSize: 'clamp(46px, 6vw, 78px)',
              fontWeight: '300',
              lineHeight: '1.02',
              color: 'var(--warm-white)',
              marginBottom: '24px',
              letterSpacing: '-0.02em',
            }}
          >
            Where <em style={{ fontStyle: 'italic', color: 'var(--warm-gold)' }}>Exceptional</em>
            <br />
            Nurses Meet
            <br />
            Healthcare Excellence
          </h1>

          <p style={{ fontSize: '18px', color: 'rgba(245,245,240,0.78)', maxWidth: '520px', marginBottom: '40px', fontWeight: '300', lineHeight: '1.8' }}>
            Seraphyn connects skilled nursing professionals with top healthcare organizations in a way that feels faster, clearer, and more premium for everyone involved.
          </p>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <Link to="/nurse-signup" style={{ padding: '14px 30px', background: 'var(--warm-gold)', color: 'white', borderRadius: '999px', fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '700', textDecoration: 'none' }}>
              Join as a Nurse
            </Link>
            <Link to="/employer-signup" style={{ padding: '14px 30px', border: '1px solid rgba(245,245,240,0.35)', color: 'var(--warm-white)', borderRadius: '999px', fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '700', textDecoration: 'none' }}>
              Hire Nurses
            </Link>
            <Link to="/contact" style={{ padding: '14px 30px', border: '1px solid rgba(245,245,240,0.18)', color: 'rgba(245,245,240,0.88)', borderRadius: '999px', fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '600', textDecoration: 'none' }}>
              Contact Team
            </Link>
          </div>
        </div>
      </section>

      <div className="stats-mobile" style={{ background: 'var(--deep-navy)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, var(--warm-gold), var(--sky-blue), var(--warm-gold))' }} />
        {stats.map((s, i) => (
          <div key={s.label} style={{ padding: '28px 20px', textAlign: 'center', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '40px', fontWeight: '300', color: 'var(--warm-white)', lineHeight: '1', marginBottom: '6px' }}>
              {s.number}
            </div>
            <div style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(245,245,240,0.45)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <section id="how-it-works" style={{ padding: '96px 5%', background: 'white' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'start', maxWidth: '1200px', margin: '0 auto' }} className="hiw-grid">
          <div>
            <SectionEyebrow>Platform Guide</SectionEyebrow>
            <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: '300', color: 'var(--deep-navy)', lineHeight: '1.15', marginBottom: '20px' }}>
              Placement made
              <br />
              <em style={{ fontStyle: 'italic', color: 'var(--warm-gold)' }}>beautifully simple</em>
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--text-muted)', maxWidth: '420px', fontWeight: '300', lineHeight: '1.8', marginBottom: '40px' }}>
              From profile to placement in days, not weeks. The workflow is designed to reduce friction without sacrificing quality.
            </p>
            <Link to="/nurse-signup" style={{ padding: '13px 28px', background: 'var(--deep-navy)', color: 'white', borderRadius: '999px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '700', textDecoration: 'none' }}>
              Get Started Today
            </Link>
          </div>

          <div>
            {steps.map((step, i) => (
              <div key={step.num} style={{ display: 'flex', gap: '20px', paddingBottom: i < steps.length - 1 ? '36px' : '0', position: 'relative' }}>
                {i < steps.length - 1 && (
                  <div style={{ position: 'absolute', left: '19px', top: '40px', bottom: 0, width: '1px', background: 'linear-gradient(to bottom, var(--warm-gold), transparent)' }} />
                )}
                <div style={{ width: '40px', height: '40px', border: '1px solid var(--warm-gold)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: 'var(--warm-gold)', flexShrink: 0, background: 'white' }}>
                  {step.num}
                </div>
                <div>
                  <h4 style={{ fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '6px' }}>{step.title}</h4>
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '300', lineHeight: '1.7' }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '96px 5%', background: 'var(--warm-white)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <SectionEyebrow>Open Positions</SectionEyebrow>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: '300', color: 'var(--deep-navy)', marginBottom: '16px' }}>
            Featured <em style={{ fontStyle: 'italic', color: 'var(--warm-gold)' }}>Opportunities</em>
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--text-muted)', maxWidth: '480px', fontWeight: '300', lineHeight: '1.8', marginBottom: '48px' }}>
            Handpicked roles at leading healthcare facilities, refreshed from live platform data where available.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }} className="cards-grid">
            {jobs.map((job, i) => (
              <div
                key={job.id || `${job.org}-${job.title}`}
                style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '28px', transition: 'all 0.3s', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 20px 48px rgba(44,62,80,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '6px', background: job.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', fontWeight: '600', color: 'white', flexShrink: 0 }}>
                    {job.initials}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--deep-navy)' }}>{job.org}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{job.location}</div>
                  </div>
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '14px', lineHeight: '1.2' }}>{job.title}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                  {[job.specialty, job.shift, job.contract].map((tag) => (
                    <span key={tag} style={{ fontSize: '11px', padding: '4px 8px', background: 'rgba(126,181,200,0.1)', borderRadius: '999px', color: 'var(--sky-blue)', fontWeight: '600' }}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', fontWeight: '500', color: 'var(--deep-navy)' }}>
                    {job.pay}
                    <span style={{ fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: '300', color: 'var(--text-muted)' }}>/hr</span>
                  </div>
                  <Link to="/jobs" style={{ padding: '8px 16px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', borderRadius: '999px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '700', textDecoration: 'none' }}>
                    View Role
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center' }}>
            <Link to="/jobs" style={{ padding: '13px 32px', border: '1px solid var(--deep-navy)', color: 'var(--deep-navy)', borderRadius: '999px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '700', textDecoration: 'none' }}>
              View All Open Positions
            </Link>
          </div>
        </div>
      </section>

      <section style={{ padding: '96px 5%', background: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <SectionEyebrow>Nurse Directory</SectionEyebrow>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: '300', color: 'var(--deep-navy)', marginBottom: '48px' }}>
            Meet Our <em style={{ fontStyle: 'italic', color: 'var(--warm-gold)' }}>Elite</em> Nurses
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }} className="cards-grid">
            {nurses.map((nurse) => (
              <div
                key={`${nurse.initials}-${nurse.specialty}`}
                style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', transition: 'all 0.3s' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 16px 48px rgba(44,62,80,0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ padding: '24px', background: `linear-gradient(135deg, var(--deep-navy), ${nurse.color})`, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--warm-gold)', fontWeight: '600', letterSpacing: '0.06em' }}>
                    <img src="/logo.png" alt="" aria-hidden="true" style={{ height: '12px', width: 'auto', objectFit: 'contain' }} />
                    Verified
                  </div>
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: 'white', background: 'rgba(255,255,255,0.12)', marginBottom: '10px' }}>
                    {nurse.initials}
                  </div>
                  <div style={{ fontSize: '20px', color: 'white', marginBottom: '2px' }}>{nurse.name}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(245,245,240,0.55)', letterSpacing: '0.04em' }}>{nurse.creds}</div>
                </div>
                <div style={{ padding: '18px 20px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--warm-gold)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{nurse.specialty}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{nurse.exp}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '14px' }}>
                    {nurse.skills.map((skill) => (
                      <span key={skill} style={{ fontSize: '10px', padding: '3px 7px', background: 'rgba(126,181,200,0.1)', borderRadius: '999px', color: 'var(--sky-blue)', fontWeight: '600' }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#2D7A4F', padding: '7px 10px', background: 'rgba(45,122,79,0.06)', borderRadius: '999px' }}>
                    <span style={{ width: '5px', height: '5px', background: '#2D7A4F', borderRadius: '50%', display: 'inline-block' }} />
                    Available for Travel
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <Link to="/nurses" style={{ padding: '13px 32px', border: '1px solid var(--deep-navy)', color: 'var(--deep-navy)', borderRadius: '999px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '700', textDecoration: 'none' }}>
              Browse the Directory
            </Link>
          </div>
        </div>
      </section>

      <section style={{ padding: '96px 5%', background: 'var(--deep-navy)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', fontFamily: 'Cormorant Garamond, serif', fontSize: '500px', lineHeight: '0.7', color: 'rgba(255,255,255,0.02)', top: 0, left: '-20px', pointerEvents: 'none' }}>"</div>
        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--warm-gold)', fontWeight: '500', marginBottom: '16px' }}>Testimonials</p>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: '300', color: 'var(--warm-white)', marginBottom: '48px' }}>
            Trusted by <em style={{ fontStyle: 'italic', color: 'var(--warm-gold)' }}>thousands</em>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }} className="cards-grid">
            {testimonials.map((t) => (
              <div
                key={t.name}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '32px', transition: 'all 0.3s' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--warm-gold)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '20px' }}>
                  <img src="/logo.png" alt="" aria-hidden="true" style={{ height: '14px', width: 'auto', objectFit: 'contain' }} />
                  Trusted Placement
                </div>
                <p style={{ fontSize: '18px', fontWeight: '300', fontStyle: 'italic', color: 'var(--warm-white)', lineHeight: '1.7', marginBottom: '24px' }}>
                  "{t.text}"
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(200,169,110,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: 'var(--warm-gold)' }}>
                    {t.initials}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--warm-white)' }}>{t.name}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(245,245,240,0.45)' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '120px 5%', background: 'var(--warm-white)', textAlign: 'center' }}>
        <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--warm-gold)', fontWeight: '500', marginBottom: '16px' }}>Get Started</p>
        <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: '300', color: 'var(--deep-navy)', marginBottom: '16px' }}>
          Join <em style={{ fontStyle: 'italic', color: 'var(--warm-gold)' }}>Seraphyn</em> Today
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '56px', fontSize: '15px' }}>
          Whether you are a nurse seeking your next opportunity or a facility with an urgent need, we are here.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', maxWidth: '800px', margin: '0 auto' }} className="cta-grid">
          {[
            { title: "I'm a Nurse", desc: 'Create your profile, upload credentials, and start browsing premium travel and contract opportunities nationwide.', cta: 'Create Nurse Profile', href: '/nurse-signup', bg: 'var(--sky-blue)', accent: 'white' },
            { title: "I'm an Employer", desc: 'Register your facility, post open positions, and connect directly with verified nursing professionals.', cta: 'Post Your First Job', href: '/employer-signup', bg: 'var(--warm-gold)', accent: 'white' },
          ].map((card) => (
            <div
              key={card.title}
              style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '8px', padding: '48px 40px', textAlign: 'left', position: 'relative', overflow: 'hidden', transition: 'all 0.3s' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 24px 56px rgba(44,62,80,0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: card.bg }} />
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: card.bg }}>
                <img src="/logo.png" alt="" aria-hidden="true" style={{ height: '16px', width: 'auto', objectFit: 'contain' }} />
                Seraphyn Access
              </div>
              <h3 style={{ fontSize: '28px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '12px' }}>{card.title}</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '300', lineHeight: '1.7', marginBottom: '28px' }}>{card.desc}</p>
              <Link to={card.href} style={{ display: 'block', width: '100%', padding: '13px', background: card.bg, color: card.accent, borderRadius: '999px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '700', textDecoration: 'none', textAlign: 'center' }}>
                {card.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
