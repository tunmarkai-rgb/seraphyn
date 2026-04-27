import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import { SPECIALTIES } from '../lib/constants'

export default function NurseDirectory() {
  const { user, profile } = useAuth()
  const [nurses, setNurses] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [empProfile, setEmpProfile] = useState(null)
  const [filters, setFilters] = useState({ specialty: '', availability: '', experience: '' })

  const isFullAccess = empProfile?.onboarding_stage === 'approved' && empProfile?.approved_at

  useEffect(() => {
    if (user && profile?.role === 'employer') {
      loadEmployerProfile()
    }
    loadNurses()
  }, [user, profile])

  useEffect(() => {
    applyFilters()
  }, [nurses, filters])

  async function loadEmployerProfile() {
    const { data } = await supabase
      .from('employer_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    setEmpProfile(data)
  }

  async function loadNurses() {
    setLoading(true)
    const { data } = await supabase
      .from('nurse_profiles')
      .select('id, first_name, last_name, specialty, years_experience, availability, shift_preference, certifications, bio, profile_photo_url, approved_at')
      .not('approved_at', 'is', null)
      .order('approved_at', { ascending: false })
    setNurses(data || [])
    setLoading(false)
  }

  function applyFilters() {
    let result = [...nurses]
    if (filters.specialty) result = result.filter(n => n.specialty === filters.specialty)
    if (filters.availability) result = result.filter(n => n.availability === filters.availability)
    if (filters.experience === '0-2') result = result.filter(n => n.years_experience <= 2)
    else if (filters.experience === '3-5') result = result.filter(n => n.years_experience >= 3 && n.years_experience <= 5)
    else if (filters.experience === '6-10') result = result.filter(n => n.years_experience >= 6 && n.years_experience <= 10)
    else if (filters.experience === '10+') result = result.filter(n => n.years_experience > 10)
    setFiltered(result)
  }

  function handleFilter(e) { setFilters({ ...filters, [e.target.name]: e.target.value }) }
  function clearFilters() { setFilters({ specialty: '', availability: '', experience: '' }) }

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
                  <option value="Immediately">Immediately</option>
                  <option value="2 Weeks">2 Weeks</option>
                  <option value="1 Month">1 Month</option>
                  <option value="Per Diem">Per Diem Only</option>
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
                      <div style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '9px', color: 'var(--warm-gold)', letterSpacing: '0.06em', fontWeight: '500' }}>✦ VERIFIED</div>
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
