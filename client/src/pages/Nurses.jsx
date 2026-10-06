import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import { NURSE_AVAILABILITY_OPTIONS, SPECIALTIES, URGENCY_OPTIONS, availabilityLabel, shiftPreferenceLabel, urgencyLabel } from '../lib/constants'
import { apiRequest, publicApiRequest } from '../lib/api'
import { formatHourly } from '../lib/format'

const EMPTY_FILTERS = {
  specialty: '', availability: '', experience: '', sort: 'newest'
}

const EMPTY_BUDGET = { job_id: '', target: '', max: '', urgency: 'standard' }

// How the directory labels each rate fit against the hospital's budget.
const FIT_CHIPS = {
  within_target: { dot: '🟢', text: 'Within target', color: 'var(--success)', bg: 'rgba(45,122,79,0.08)' },
  within_max: { dot: '🟡', text: 'Within maximum', color: 'var(--warm-gold)', bg: 'rgba(200,169,110,0.14)' },
  above_max: { dot: '⚠️', text: "Above your stated budget", color: '#B43C3C', bg: 'rgba(180,60,60,0.07)' },
  no_rate: { dot: '⚪', text: 'Rate on request', color: 'var(--text-muted)', bg: 'var(--warm-white)' }
}

function groupHeading(group, urgency) {
  if (group === 'above_budget') return 'Above Budget — Available for Consideration'
  if (group === 'secondary') return '🟡 Within Maximum'
  if (urgency === 'critical') return 'All Qualified Nurses, Best Match First'
  if (urgency === 'urgent') return '🟢 Within Your Budget'
  return '🟢 Within Target'
}

export default function NurseDirectory() {
  const { user, profile } = useAuth()
  const [nurses, setNurses] = useState([])
  const [loading, setLoading] = useState(true)
  // Authoritative full-access signal: the server decides who may see a rate,
  // and returns full name/bio to exactly the same audience.
  const [ratesVisible, setRatesVisible] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  // Compare nurses against one of the employer's jobs or a typed budget.
  const [myJobs, setMyJobs] = useState([])
  const [budgetDraft, setBudgetDraft] = useState(EMPTY_BUDGET)
  const [budgetQuery, setBudgetQuery] = useState('')
  const [comparison, setComparison] = useState(null)
  const [showAboveBudget, setShowAboveBudget] = useState(false)

  const isFullAccess = ratesVisible
  // Employers see the row even before approval (locked), so the value is a
  // visible reason to finish onboarding. Guests and nurses get no row at all.
  const showRateRow = isFullAccess || profile?.role === 'employer'

  const loadNurses = useCallback(async () => {
    setLoading(true)
    try {
      // Signed-in callers get their role's payload; guests get the base fields.
      const request = user ? apiRequest : publicApiRequest
      const result = await request(`/api/nurses/directory${budgetQuery}`)
      setNurses(result?.nurses || [])
      setRatesVisible(Boolean(result?.rates_visible))
      setComparison(result?.comparison || null)
    } catch (error) {
      console.error('Failed to load nurse directory:', error.message)
      setNurses([])
      setRatesVisible(false)
      setComparison(null)
    } finally {
      setLoading(false)
    }
  }, [user, budgetQuery])

  useEffect(() => {
    loadNurses()
  }, [loadNurses])

  useEffect(() => {
    if (!isFullAccess || profile?.role !== 'employer') return
    apiRequest('/api/jobs/mine')
      .then((jobs) => setMyJobs((jobs || []).filter((job) => job.status === 'active')))
      .catch(() => setMyJobs([]))
  }, [isFullAccess, profile?.role])

  function applyBudget(e) {
    e?.preventDefault()
    const params = new URLSearchParams()
    if (budgetDraft.job_id) {
      params.set('job_id', budgetDraft.job_id)
      if (budgetDraft.urgency) params.set('urgency', budgetDraft.urgency)
    } else {
      if (budgetDraft.target) params.set('target', budgetDraft.target)
      if (budgetDraft.max) params.set('max', budgetDraft.max)
      params.set('urgency', budgetDraft.urgency)
      if (!budgetDraft.target && !budgetDraft.max) return
    }
    setShowAboveBudget(false)
    setFilters((current) => ({ ...current, sort: 'match' }))
    setBudgetQuery(`?${params.toString()}`)
  }

  function clearBudget() {
    setBudgetDraft(EMPTY_BUDGET)
    setBudgetQuery('')
    setFilters((current) => ({ ...current, sort: current.sort === 'match' ? 'newest' : current.sort }))
  }

  function pickJob(jobId) {
    const job = myJobs.find((j) => j.id === jobId)
    setBudgetDraft({
      job_id: jobId,
      target: job?.target_bill_rate != null ? String(job.target_bill_rate) : '',
      max: job?.max_bill_rate != null ? String(job.max_bill_rate) : '',
      urgency: job?.urgency || 'standard'
    })
  }

  const filtered = useMemo(() => {
    let result = nurses
    if (filters.specialty) result = result.filter(n => n.specialty === filters.specialty)
    if (filters.availability) result = result.filter(n => n.availability === filters.availability)
    if (filters.experience === '0-2') result = result.filter(n => n.years_experience <= 2)
    else if (filters.experience === '3-5') result = result.filter(n => n.years_experience >= 3 && n.years_experience <= 5)
    else if (filters.experience === '6-10') result = result.filter(n => n.years_experience >= 6 && n.years_experience <= 10)
    else if (filters.experience === '10+') result = result.filter(n => n.years_experience > 10)

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
    // 'match' and 'newest' keep the server's order.

    return result
  }, [nurses, filters])

  // With a budget applied the list is shown in the server's groups; nobody is
  // dropped, above-budget nurses are just listed last (or inline if critical).
  const groups = useMemo(() => {
    if (!comparison) return null
    const order = ['primary', 'secondary', 'above_budget']
    return order
      .map((key) => ({ key, nurses: filtered.filter((n) => (n.group || 'primary') === key) }))
      .filter((group) => group.nurses.length > 0)
  }, [comparison, filtered])

  function handleFilter(e) { setFilters({ ...filters, [e.target.name]: e.target.value }) }
  function clearFilters() { setFilters(EMPTY_FILTERS) }

  const selectStyle = {
    padding: '9px 14px', background: 'white', border: '1px solid var(--border)',
    borderRadius: '2px', fontSize: '13px', color: 'var(--deep-navy)', outline: 'none',
    fontFamily: 'DM Sans, sans-serif', width: '100%'
  }
  const smallLabel = { display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }

  const COLORS = ['var(--deep-navy)', 'var(--sky-blue)', 'var(--warm-gold)']

  function renderCard(nurse, idx) {
    const fit = nurse.match?.fit
    const chip = comparison ? FIT_CHIPS[fit] : null
    const overBy = nurse.match?.over_max_by || 0
    return (
      <div key={nurse.id} style={{ background: 'white', border: `1px solid ${fit === 'above_max' ? 'rgba(180,60,60,0.25)' : 'var(--border)'}`, borderRadius: '4px', overflow: 'hidden', transition: 'all 0.2s' }}
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
          {comparison && nurse.match && (
            <p style={{ position: 'absolute', bottom: '12px', right: '12px', fontSize: '11px', color: 'white', fontWeight: '600' }}>
              {nurse.match.score}% match
            </p>
          )}
        </div>
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: '500', color: 'var(--warm-gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {availabilityLabel(nurse.availability) || 'Available'}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {nurse.years_experience} yr{nurse.years_experience !== 1 ? 's' : ''}
            </span>
          </div>

          {/* The published breakdown: desired pay + Seraphyn fee = hospital
              rate. Always renders so cards in the 3-up grid stay equal height. */}
          {showRateRow && (
            <div style={{ padding: '10px 0', marginBottom: '10px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              {!isFullAccess ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--warm-gold)', fontWeight: '500' }}>Hospital Rate</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Unlocks after approval</span>
                </div>
              ) : nurse.has_rate ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                    <span>Nurse&rsquo;s desired pay</span><span>{formatHourly(nurse.nurse_pay)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <span>Seraphyn fee</span><span>+{formatHourly(nurse.agency_fee)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--warm-gold)', fontWeight: '500' }}>Hospital Rate</span>
                    <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', lineHeight: 1 }}>
                      {formatHourly(nurse.bill_rate).replace('/hr', '')}
                      <span style={{ fontSize: '11px', fontFamily: 'DM Sans, sans-serif', fontWeight: '300', color: 'var(--text-muted)' }}>/hr</span>
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--warm-gold)', fontWeight: '500' }}>Hospital Rate</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Rate on request</span>
                </div>
              )}
            </div>
          )}

          {chip && (
            <div style={{ padding: '8px 10px', background: chip.bg, borderRadius: '2px', marginBottom: '10px' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', color: chip.color }}>{chip.dot} {chip.text}</p>
              {fit === 'above_max' && (
                <p style={{ fontSize: '11px', color: 'var(--deep-navy)', marginTop: '4px', lineHeight: 1.5 }}>
                  This nurse&rsquo;s requested rate is {formatHourly(overBy)} above your stated maximum.
                  Would you like to consider this nurse anyway?
                </p>
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
            {nurse.shift_preference && nurse.shift_preference !== 'any' ? `${shiftPreferenceLabel(nurse.shift_preference)} Shifts` : 'Open to Any Shift Type'}
          </div>
          {fit === 'above_max' && profile?.role === 'employer' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <Link to={`/nurses/${nurse.id}`} style={{ display: 'block', textAlign: 'center', padding: '7px', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--deep-navy)', textDecoration: 'none' }}>
                View Nurse
              </Link>
              <Link to={`/nurses/${nurse.id}?consider=1`} style={{ display: 'block', textAlign: 'center', padding: '7px', background: 'var(--deep-navy)', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'white', textDecoration: 'none' }}>
                Consider Anyway
              </Link>
            </div>
          ) : (
            <Link to={`/nurses/${nurse.id}`} style={{ display: 'block', textAlign: 'center', padding: '7px', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--deep-navy)', textDecoration: 'none' }}>
              View Profile →
            </Link>
          )}
        </div>
      </div>
    )
  }

  const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }

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
            Nurses name their desired pay. Hospitals choose what fits their needs. Seraphyn makes the match transparent.
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
        {/* Budget comparison: hospitals (and admins) only. */}
        {isFullAccess && (
          <form onSubmit={applyBudget} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px 24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--deep-navy)' }}>Match Against Your Budget</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Hospital rate = nurse&rsquo;s desired pay + Seraphyn fee</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', alignItems: 'end' }}>
              {myJobs.length > 0 && (
                <div>
                  <label style={smallLabel}>One of your jobs</label>
                  <select value={budgetDraft.job_id} onChange={(e) => pickJob(e.target.value)} style={selectStyle}>
                    <option value="">Custom budget</option>
                    {myJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={smallLabel}>Target rate ($/hr)</label>
                <input type="number" min="1" step="0.5" value={budgetDraft.target} disabled={Boolean(budgetDraft.job_id)}
                  onChange={(e) => setBudgetDraft({ ...budgetDraft, target: e.target.value })} placeholder="e.g. 85" style={selectStyle} />
              </div>
              <div>
                <label style={smallLabel}>Maximum rate ($/hr)</label>
                <input type="number" min="1" step="0.5" value={budgetDraft.max} disabled={Boolean(budgetDraft.job_id)}
                  onChange={(e) => setBudgetDraft({ ...budgetDraft, max: e.target.value })} placeholder="e.g. 95" style={selectStyle} />
              </div>
              <div>
                <label style={smallLabel}>Urgency</label>
                <select value={budgetDraft.urgency} onChange={(e) => setBudgetDraft({ ...budgetDraft, urgency: e.target.value })} style={selectStyle}>
                  {URGENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" style={{ flex: 1, padding: '10px 14px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                  Match
                </button>
                {comparison && (
                  <button type="button" onClick={clearBudget} style={{ padding: '10px 12px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '11px', cursor: 'pointer' }}>
                    Clear
                  </button>
                )}
              </div>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>
              {URGENCY_OPTIONS.find((option) => option.value === budgetDraft.urgency)?.help}
            </p>
          </form>
        )}

        <div className="jobs-layout" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '32px', alignItems: 'start' }}>

          {/* Filters */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '24px', position: 'sticky', top: '88px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--deep-navy)' }}>Filters</h3>
              <button onClick={clearFilters} style={{ fontSize: '11px', color: 'var(--sky-blue)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={smallLabel}>Specialty</label>
                <select name="specialty" value={filters.specialty} onChange={handleFilter} style={selectStyle}>
                  <option value="">All Specialties</option>
                  {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={smallLabel}>Availability</label>
                <select name="availability" value={filters.availability} onChange={handleFilter} style={selectStyle}>
                  <option value="">Any</option>
                  {NURSE_AVAILABILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label style={smallLabel}>Experience</label>
                <select name="experience" value={filters.experience} onChange={handleFilter} style={selectStyle}>
                  <option value="">Any</option>
                  <option value="0-2">0–2 years</option>
                  <option value="3-5">3–5 years</option>
                  <option value="6-10">6–10 years</option>
                  <option value="10+">10+ years</option>
                </select>
              </div>
              <div>
                <label style={smallLabel}>Sort By</label>
                <select name="sort" value={filters.sort} onChange={handleFilter} style={selectStyle}>
                  {comparison && <option value="match">Best match</option>}
                  <option value="newest">Newest</option>
                  {isFullAccess && <option value="rate_asc">Hospital rate: low to high</option>}
                  {isFullAccess && <option value="rate_desc">Hospital rate: high to low</option>}
                  <option value="experience">Most experienced</option>
                </select>
              </div>
            </div>
          </div>

          {/* Nurse cards */}
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Showing <strong style={{ color: 'var(--deep-navy)' }}>{filtered.length}</strong> nurse{filtered.length !== 1 ? 's' : ''}
              {comparison && (
                <>
                  {' '}against {comparison.job_title ? <strong style={{ color: 'var(--deep-navy)' }}>{comparison.job_title}</strong> : 'your budget'}
                  {' '}({comparison.target_bill_rate !== comparison.max_bill_rate
                    ? `target ${formatHourly(comparison.target_bill_rate)}, max ${formatHourly(comparison.max_bill_rate)}`
                    : `max ${formatHourly(comparison.max_bill_rate)}`}, {urgencyLabel(comparison.urgency).toLowerCase()})
                </>
              )}
            </p>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '60px', textAlign: 'center' }}>
                <p style={{ fontSize: '16px', color: 'var(--text-muted)' }}>No nurses match your filters.</p>
              </div>
            ) : groups && filters.sort === 'match' ? (
              groups.map((group) => {
                const collapsed = group.key === 'above_budget' && !showAboveBudget
                return (
                  <section key={group.key} style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
                      <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: '500', color: group.key === 'above_budget' ? '#B43C3C' : 'var(--deep-navy)' }}>
                        {groupHeading(group.key, comparison.urgency)}
                        <span style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)', marginLeft: '8px' }}>{group.nurses.length}</span>
                      </h3>
                      {group.key === 'above_budget' && (
                        <button onClick={() => setShowAboveBudget(!showAboveBudget)} style={{ fontSize: '11px', color: 'var(--sky-blue)', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {collapsed ? 'Show' : 'Hide'}
                        </button>
                      )}
                    </div>
                    {group.key === 'above_budget' && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.6 }}>
                        Qualified nurses whose requested rate is above your stated maximum. If the need is
                        severe, you can still consider them.
                      </p>
                    )}
                    {!collapsed && (
                      <div className="cards-grid" style={gridStyle}>
                        {group.nurses.map((nurse, idx) => renderCard(nurse, idx))}
                      </div>
                    )}
                  </section>
                )
              })
            ) : (
              <div className="cards-grid" style={gridStyle}>
                {filtered.map((nurse, idx) => renderCard(nurse, idx))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
