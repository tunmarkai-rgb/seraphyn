import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import { SPECIALTIES, US_STATES } from '../lib/constants'

export default function Jobs() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(null)
  const [appliedIds, setAppliedIds] = useState(new Set())
  const [nurseProfileId, setNurseProfileId] = useState(null)
  const [applyModal, setApplyModal] = useState(null)
  const [coverNote, setCoverNote] = useState('')
  const [applySuccess, setApplySuccess] = useState(false)
  const [nonNurseToast, setNonNurseToast] = useState(false)

  const [filters, setFilters] = useState({
    specialty: '', state: '', shift_type: '', pay_min: '', pay_max: ''
  })

  useEffect(() => {
    loadJobs()
    if (user && profile?.role === 'nurse') loadNurseProfile()
  }, [user, profile])

  useEffect(() => {
    applyFilters()
  }, [jobs, filters])

  async function loadJobs() {
    setLoading(true)
    const { data } = await supabase
      .from('jobs')
      .select('*, employer_profiles(org_name, city, state)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    setJobs(data || [])
    setLoading(false)
  }

  async function loadNurseProfile() {
    const { data: np } = await supabase
      .from('nurse_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (np) {
      setNurseProfileId(np.id)
      const { data: apps } = await supabase
        .from('applications')
        .select('job_id')
        .eq('nurse_id', np.id)
      setAppliedIds(new Set((apps || []).map(a => a.job_id)))
    }
  }

  function applyFilters() {
    let result = [...jobs]
    if (filters.specialty) result = result.filter(j => j.specialty === filters.specialty)
    if (filters.state) result = result.filter(j => j.state === filters.state)
    if (filters.shift_type) result = result.filter(j => j.shift_type === filters.shift_type)
    if (filters.pay_min) result = result.filter(j => j.pay_rate && j.pay_rate >= parseFloat(filters.pay_min))
    if (filters.pay_max) result = result.filter(j => j.pay_rate && j.pay_rate <= parseFloat(filters.pay_max))
    setFiltered(result)
  }

  function handleFilter(e) {
    setFilters({ ...filters, [e.target.name]: e.target.value })
  }

  function clearFilters() {
    setFilters({ specialty: '', state: '', shift_type: '', pay_min: '', pay_max: '' })
  }

  async function submitApplication() {
    if (!user) { navigate('/login'); return }
    if (!nurseProfileId) return
    if (profile?.status !== 'approved') {
      alert('Your account must be approved before you can apply to jobs.')
      return
    }
    setApplying(applyModal.id)
    const { error } = await supabase.from('applications').insert({
      job_id: applyModal.id,
      nurse_id: nurseProfileId,
      employer_id: applyModal.employer_id,
      status: 'submitted',
      cover_note: coverNote
    })
    if (!error) {
      setAppliedIds(prev => new Set([...prev, applyModal.id]))
      setApplySuccess(true)
      setTimeout(() => { setApplyModal(null); setApplySuccess(false); setCoverNote('') }, 2000)
    }
    setApplying(null)
  }

  const selectStyle = {
    padding: '9px 14px', background: 'white', border: '1px solid var(--border)',
    borderRadius: '2px', fontSize: '13px', color: 'var(--deep-navy)',
    outline: 'none', fontFamily: 'DM Sans, sans-serif', width: '100%'
  }

  const activeFilters = Object.values(filters).filter(Boolean).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />

      {/* Hero */}
      <div style={{ background: 'var(--deep-navy)', padding: '80px 5% 48px', marginTop: '72px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '12px' }}>Open Positions</p>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: '300', color: 'var(--warm-white)', marginBottom: '12px' }}>
            Browse <em style={{ fontStyle: 'italic', color: 'var(--warm-gold)' }}>Nursing</em> Jobs
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(245,245,240,0.6)', fontWeight: '300' }}>
            {jobs.length} active positions across the United States
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px 60px' }}>
        <div className="jobs-layout" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '32px', alignItems: 'start' }}>

          {/* Filters sidebar */}
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '24px', position: 'sticky', top: '88px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--deep-navy)' }}>
                Filters {activeFilters > 0 && <span style={{ background: 'var(--warm-gold)', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', marginLeft: '6px' }}>{activeFilters}</span>}
              </h3>
              {activeFilters > 0 && (
                <button onClick={clearFilters} style={{ fontSize: '11px', color: 'var(--sky-blue)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear all</button>
              )}
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
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>State</label>
                <select name="state" value={filters.state} onChange={handleFilter} style={selectStyle}>
                  <option value="">All States</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>Shift Type</label>
                <select name="shift_type" value={filters.shift_type} onChange={handleFilter} style={selectStyle}>
                  <option value="">All Shifts</option>
                  <option value="day">Day Shift</option>
                  <option value="night">Night Shift</option>
                  <option value="evening">Evening Shift</option>
                  <option value="mixed">Mixed Shifts</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>Pay Rate ($/hr)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input name="pay_min" type="number" value={filters.pay_min} onChange={handleFilter} placeholder="Min" style={{ ...selectStyle, width: '50%' }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>–</span>
                  <input name="pay_max" type="number" value={filters.pay_max} onChange={handleFilter} placeholder="Max" style={{ ...selectStyle, width: '50%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Job listings */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Showing <strong style={{ color: 'var(--deep-navy)' }}>{filtered.length}</strong> position{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading jobs...</div>
            ) : filtered.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '36px', marginBottom: '16px' }}>🔍</div>
                <p style={{ fontSize: '16px', color: 'var(--text-muted)', marginBottom: '12px' }}>No jobs match your filters.</p>
                <button onClick={clearFilters} style={{ padding: '9px 20px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Clear Filters
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filtered.map(job => {
                  const already = appliedIds.has(job.id)
                  return (
                    <div key={job.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '24px', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(44,62,80,0.08)' }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                        <div>
                          <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '4px' }}>
                            {job.title}
                          </h3>
                          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {job.employer_profiles?.org_name} · 📍 {job.city}, {job.state}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {job.pay_rate && (
                            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', fontWeight: '500', color: 'var(--deep-navy)' }}>
                              ${job.pay_rate}<span style={{ fontSize: '12px', fontFamily: 'DM Sans', color: 'var(--text-muted)', fontWeight: '300' }}>/hr</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                        {[job.specialty, job.shift_type, job.contract_length].filter(Boolean).map((tag, i) => (
                          <span key={i} style={{ fontSize: '11px', padding: '4px 9px', background: 'rgba(126,181,200,0.1)', borderRadius: '2px', color: 'var(--sky-blue)', fontWeight: '500' }}>{tag}</span>
                        ))}
                      </div>

                      {job.description && (
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '16px' }}>
                          {job.description.length > 180 ? job.description.slice(0, 180) + '...' : job.description}
                        </p>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Posted {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        {already ? (
                          <span style={{ padding: '8px 16px', background: 'rgba(45,122,79,0.1)', color: 'var(--success)', borderRadius: '2px', fontSize: '12px', fontWeight: '500' }}>
                            ✓ Applied
                          </span>
                        ) : (
                          <button onClick={() => {
                            if (!user) navigate('/nurse-signup')
                            else if (profile?.role !== 'nurse') {
                              setNonNurseToast(true)
                              setTimeout(() => setNonNurseToast(false), 3000)
                            } else setApplyModal(job)
                          }}
                            style={{ padding: '8px 20px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                            {!user ? 'Sign Up to Apply' : 'Apply Now'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Non-nurse toast */}
      {nonNurseToast && (
        <div style={{ position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)', background: 'var(--deep-navy)', color: 'white', padding: '12px 24px', borderRadius: '4px', fontSize: '13px', zIndex: 300, boxShadow: '0 8px 24px rgba(44,62,80,0.2)' }}>
          Only nurses can apply to jobs.
        </div>
      )}

      {/* Apply modal */}
      {applyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(44,62,80,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={e => { if (e.target === e.currentTarget) setApplyModal(null) }}>
          <div style={{ background: 'white', borderRadius: '4px', padding: '32px', maxWidth: '500px', width: '100%' }}>
            {applySuccess ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎉</div>
                <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: 'var(--success)', marginBottom: '8px' }}>Application Submitted!</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>The employer will review your profile and be in touch.</p>
              </div>
            ) : (
              <>
                <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '6px' }}>
                  Apply: {applyModal.title}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  {applyModal.employer_profiles?.org_name} · {applyModal.city}, {applyModal.state}
                </p>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Cover Note (optional)
                  </label>
                  <textarea value={coverNote} onChange={e => setCoverNote(e.target.value)} rows={4}
                    placeholder="Briefly introduce yourself and why you're a great fit..."
                    style={{ width: '100%', padding: '11px 14px', background: 'var(--warm-white)', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '14px', color: 'var(--deep-navy)', outline: 'none', fontFamily: 'DM Sans, sans-serif', resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setApplyModal(null)}
                    style={{ padding: '10px 20px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', borderRadius: '2px', fontSize: '12px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={submitApplication} disabled={applying === applyModal.id}
                    style={{ padding: '10px 24px', background: applying === applyModal.id ? 'var(--text-muted)' : 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500', cursor: applying ? 'not-allowed' : 'pointer' }}>
                    {applying === applyModal.id ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
