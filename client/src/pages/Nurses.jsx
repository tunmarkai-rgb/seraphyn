import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import { NURSE_AVAILABILITY_OPTIONS, SPECIALTIES } from '../lib/constants'
import { apiRequest, publicApiRequest } from '../lib/api'
import { formatHourly } from '../lib/format'

const EMPTY_FILTERS = {
  specialty: '', availability: '', experience: '', rate_min: '', rate_max: '', sort: 'newest'
}

export default function NurseDirectory() {
  const { user, profile } = useAuth()
  const [nurses, setNurses] = useState([])
  const [loading, setLoading] = useState(true)
  // Authoritative full-access signal: the server decides who may see a rate,
  // and returns full name/bio to exactly the same audience.
  const [ratesVisible, setRatesVisible] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  const isFullAccess = ratesVisible
  // Employers see the row even before approval (locked), so the value is a
  // visible reason to finish onboarding. Guests and nurses get no row at all.
  const showRateRow = isFullAccess || profile?.role === 'employer'

  const loadNurses = useCallback(async () => {
    setLoading(true)
    try {
      // Signed-in callers get their role's payload; guests get the base fields.
      const request = user ? apiRequest : publicApiRequest
      const result = await request('/api/nurses/directory')
      setNurses(result?.nurses || [])
      setRatesVisible(Boolean(result?.rates_visible))
    } catch (error) {
      console.error('Failed to load nurse directory:', error.message)
      setNurses([])
      setRatesVisible(false)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadNurses()
  }, [loadNurses])

  const filtered = useMemo(() => {
    let result = nurses
    if (filters.specialty) result = result.filter(n => n.specialty === filters.specialty)
    if (filters.availability) result = result.filter(n => n.availability === filters.availability)
    if (filters.experience === '0-2') result = result.filter(n => n.years_experience <= 2)
    else if (filters.experience === '3-5') result = result.filter(n => n.years_experience >= 3 && n.years_experience <= 5)
    else if (filters.experience === '6-10') result = result.filter(n => n.years_experience >= 6 && n.years_experience <= 10)
    else if (filters.experience === '10+') result = result.filter(n => n.years_experience > 10)

    // A nurse with no published rate can't be evaluated against a budget, so
    // they drop out once either bound is set -- same as the Jobs page.
    if (filters.rate_min) result = result.filter(n => n.bill_rate && n.bill_rate >= parseFloat(filters.rate_min))
    if (filters.rate_max) result = result.filter(n => n.bill_rate && n.bill_rate <= parseFloat(filters.rate_max))

    if (filters.sort === 'rate_asc' || filters.sort === 'rate_desc') {
      // Rate-less nurses always sort last, so the list never opens on a wall
      // of "Rate on request".
      const dir = filters.sort === 'rate_asc' ? 1 : -1
      result = [...result].sort((a, b) => {
        if (a.bill_rate == null && b.bill_rate == null) return 0
        if (a.bill_rate == null) return 1
        if (b.bill_rate == null) return -1
        return (a.bill_rate - b.bill_rate) * dir
      })
    } else if (filters.sort === 'experience') {
      result = [...result].sort((a, b) => (b.years_experience || 0) - (a.years_experience || 0))
    }

    return result
  }, [nurses, filters])

  function handleFilter(e) { setFilters({ ...filters, [e.target.name]: e.target.value }) }
  function clearFilters() { setFilters(EMPTY_FILTERS) }

  const selectStyle = {
    padding: '9px 14px', background: 'white', border: '1px solid var(--border)',
    borderRadius: '2px', fontSize: '13px', color: 'var(--deep-navy)', outline: 'none',
    fontFamily: 'DM Sans, sans-serif', width: '100%'
  }

  const COLORS = ['var(--deep-navy)', 'var(--sky-blue)', 'var(--warm-gold)']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />

      <div style={{ background: 'var(--deep-navy)', padding: '80px 5% 48px', marginTop: '72px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '12px' }}>Nurse Directory</p>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: '300', color: 'var(--warm-white)', marginBottom: '12px' }}>
            Browse <em style={{ fontStyle: 'italic', color: 'var(--warm-gold)' }}>Verified</em> Nurses
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(245,245,240,0.6)', fontWeight: '300' }}>
            {nurses.length} approved nurses available for placement
          </p>
          {!isFullAccess && profile?.role === 'employer' && (
            <div style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: 'rgba(200,169,110,0.15)', border: '1px solid rgba(200,169,110,0.3)', borderRadius: '4px' }}>
              <span style={{ fontSize: '14px' }}>🔒</span>
              <p style={{ fontSize: '12px', color: 'var(--warm-gold)' }}>Full profiles unlock after final employer approval. <a href="/employer/onboarding" style={{ color: 'var(--warm-gold)', textDecoration: 'underline' }}>Complete setup →</a></p>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px 60px' }}>
        <div className="jobs-layout" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '32px', alignItems: 'start' }}>

          {/* Filters */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '24px', position: 'sticky', top: '88px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--deep-navy)' }}>Filters</h3>
              <button onClick={clearFilters} style={{ fontSize: '11px', color: 'var(--sky-blue)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>Specialty</label>
                <select name="specialty" value={filters.specialty} onChange={handleFilter} style={selectStyle}>
                  <option value="">All Specialties</option>
                  {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>Availability</label>
                <select name="availability" value={filters.availability} onChange={handleFilter} style={selectStyle}>
                  <option value="">Any</option>
                  {NURSE_AVAILABILITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>Experience</label>
                <select name="experience" value={filters.experience} onChange={handleFilter} style={selectStyle}>
                  <option value="">Any</option>
                  <option value="0-2">0–2 years</option>
                  <option value="3-5">3–5 years</option>
                  <option value="6-10">6–10 years</option>
                  <option value="10+">10+ years</option>
                </select>
              </div>
              {isFullAccess && (
                <div>
                  <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>Bill Rate ($/hr)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input name="rate_min" type="number" min="0" value={filters.rate_min} onChange={handleFilter} placeholder="Min" style={selectStyle} />
                    <input name="rate_max" type="number" min="0" value={filters.rate_max} onChange={handleFilter} placeholder="Max" style={selectStyle} />
                  </div>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
                    Nurses without a published rate are hidden when a range is set.
                  </p>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>Sort By</label>
                <select name="sort" value={filters.sort} onChange={handleFilter} style={selectStyle}>
                  <option value="newest">Newest</option>
                  {isFullAccess && <option value="rate_asc">Bill rate: low to high</option>}
                  {isFullAccess && <option value="rate_desc">Bill rate: high to low</option>}
                  <option value="experience">Most experienced</option>
                </select>
              </div>
            </div>
          </div>

          {/* Nurse cards */}
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Showing <strong style={{ color: 'var(--deep-navy)' }}>{filtered.length}</strong> nurse{filtered.length !== 1 ? 's' : ''}
            </p>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '60px', textAlign: 'center' }}>
                <p style={{ fontSize: '16px', color: 'var(--text-muted)' }}>No nurses match your filters.</p>
              </div>
            ) : (
              <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                {filtered.map((nurse, idx) => (
                  <div key={nurse.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(44,62,80,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
                    <div style={{ padding: '20px', background: `linear-gradient(135deg, var(--deep-navy), ${COLORS[idx % COLORS.length]})`, position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '9px', color: 'var(--warm-gold)', letterSpacing: '0.06em', fontWeight: '500' }}>
                        <img src="/logo.png" alt="" aria-hidden="true" style={{ height: '11px', width: 'auto', objectFit: 'contain' }} />
                        VERIFIED
                      </div>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', color: 'white', background: 'rgba(255,255,255,0.12)', marginBottom: '8px' }}>
                        {nurse.first_name?.[0]}{nurse.last_name?.[0]}
                      </div>
                      <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', color: 'white', marginBottom: '2px' }}>
                        {isFullAccess ? `${nurse.first_name} ${nurse.last_name}` : `${nurse.first_name} ${nurse.last_name?.[0]}.`}
                      </p>
                      <p style={{ fontSize: '11px', color: 'rgba(245,245,240,0.55)' }}>{nurse.specialty}</p>
                    </div>
                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--warm-gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {nurse.availability || 'Available'}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {nurse.years_experience} yr{nurse.years_experience !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {/* Labelled BILL RATE deliberately: an employer reading this
                          as nurse take-home is the commercial risk of the feature.
                          Always renders so cards in the 3-up grid stay equal height. */}
                      {showRateRow && (
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', padding: '10px 0', marginBottom: '10px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--warm-gold)', fontWeight: '500' }}>Bill Rate</span>
                          {!isFullAccess ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Unlocks after approval</span>
                          ) : nurse.has_rate ? (
                            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', lineHeight: 1 }}>
                              {formatHourly(nurse.bill_rate).replace('/hr', '')}
                              <span style={{ fontSize: '11px', fontFamily: 'DM Sans, sans-serif', fontWeight: '300', color: 'var(--text-muted)' }}>/hr</span>
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Rate on request</span>
                          )}
                        </div>
                      )}
                      {(nurse.certifications || []).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                          {nurse.certifications.slice(0, 3).map((c, i) => (
                            <span key={i} style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(126,181,200,0.1)', borderRadius: '2px', color: 'var(--sky-blue)', fontWeight: '500' }}>{c}</span>
                          ))}
                        </div>
                      )}
                      {isFullAccess && nurse.bio && (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '12px' }}>
                          {nurse.bio.length > 80 ? nurse.bio.slice(0, 80) + '...' : nurse.bio}
                        </p>
                      )}
                      {!isFullAccess && (
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '10px' }}>
                          🔒 Full profile unlocked after final employer approval
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--success)', padding: '6px 8px', background: 'rgba(45,122,79,0.06)', borderRadius: '2px', marginBottom: '10px' }}>
                        <span style={{ width: '5px', height: '5px', background: 'var(--success)', borderRadius: '50%', display: 'inline-block' }} />
                        Available for {nurse.shift_preference || 'All'} Shifts
                      </div>
                      <Link to={`/nurses/${nurse.id}`} style={{ display: 'block', textAlign: 'center', padding: '7px', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--deep-navy)', textDecoration: 'none' }}>
                        View Profile →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
