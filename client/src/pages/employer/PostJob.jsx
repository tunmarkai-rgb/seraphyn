import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Navbar from '../../components/Navbar'
import { SPECIALTIES, US_STATES } from '../../lib/constants'

export default function PostJob() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [empProfileId, setEmpProfileId] = useState(null)
  const [postingType, setPostingType] = useState('job')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [jobForm, setJobForm] = useState({
    title: '', specialty: '', city: '', state: '',
    shift_type: '', pay_rate: '', contract_length: '',
    description: '', requirements: ''
  })

  const [shiftForm, setShiftForm] = useState({
    specialty: '', shift_date: '', start_time: '',
    end_time: '', hourly_rate: '', notes: ''
  })

  useEffect(() => {
    if (user) getEmployerProfile()
  }, [user])

  async function getEmployerProfile() {
    const { data } = await supabase
      .from('employer_profiles')
      .select('id, onboarding_stage, approved_at')
      .eq('user_id', user.id)
      .single()
    if (!data) {
      setError('Profile not found. Complete your account setup before posting jobs.')
      navigate('/employer/onboarding')
      return
    }
    if (data.onboarding_stage < 3 || !data.approved_at) {
      navigate('/employer/onboarding')
      return
    }
    setEmpProfileId(data.id)
  }

  function handleJob(e) { setJobForm({ ...jobForm, [e.target.name]: e.target.value }) }
  function handleShift(e) { setShiftForm({ ...shiftForm, [e.target.name]: e.target.value }) }

  async function submitJob(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { error: err } = await supabase.from('jobs').insert({
        employer_id: empProfileId,
        title: jobForm.title,
        specialty: jobForm.specialty,
        city: jobForm.city,
        state: jobForm.state,
        location: `${jobForm.city}, ${jobForm.state}`,
        shift_type: jobForm.shift_type,
        pay_rate: jobForm.pay_rate ? parseFloat(jobForm.pay_rate) : null,
        contract_length: jobForm.contract_length,
        description: jobForm.description,
        requirements: jobForm.requirements,
        status: 'active',
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      })
      if (err) throw err
      navigate('/employer/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function submitShift(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { error: err } = await supabase.from('per_diem_shifts').insert({
        employer_id: empProfileId,
        specialty: shiftForm.specialty,
        shift_date: shiftForm.shift_date,
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
        hourly_rate: shiftForm.hourly_rate ? parseFloat(shiftForm.hourly_rate) : null,
        notes: shiftForm.notes,
        status: 'open'
      })
      if (err) throw err
      navigate('/employer/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px',
    background: 'var(--warm-white)', border: '1px solid var(--border)',
    borderRadius: '2px', fontSize: '14px', color: 'var(--deep-navy)',
    outline: 'none', fontFamily: 'DM Sans, sans-serif'
  }
  const labelStyle = {
    display: 'block', fontSize: '11px', letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--text-muted)',
    fontWeight: '500', marginBottom: '6px'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '100px 24px 60px' }}>

        <div style={{ marginBottom: '36px' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '8px' }}>Employer Portal</p>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: '300', color: 'var(--deep-navy)' }}>
            Post an Opportunity
          </h1>
        </div>

        {/* Type toggle */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '32px', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', width: 'fit-content' }}>
          {[['job', '📋 Job / Contract'], ['shift', '⏰ Per Diem Shift']].map(([type, label]) => (
            <button key={type} onClick={() => setPostingType(type)}
              style={{ padding: '12px 24px', border: 'none', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s', background: postingType === type ? 'var(--deep-navy)' : 'white', color: postingType === type ? 'white' : 'var(--text-muted)' }}>
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ background: 'rgba(180,60,60,0.08)', border: '1px solid rgba(180,60,60,0.25)', borderRadius: '2px', padding: '12px 16px', marginBottom: '24px', fontSize: '13px', color: '#B43C3C' }}>
            {error}
          </div>
        )}

        {/* ── JOB FORM ── */}
        {postingType === 'job' && (
          <form onSubmit={submitJob}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '32px' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '24px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
                Job / Contract Details
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Job Title *</label>
                  <input name="title" value={jobForm.title} onChange={handleJob} required style={inputStyle} placeholder="e.g. Travel ICU Registered Nurse" />
                </div>
                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>Specialty *</label>
                    <select name="specialty" value={jobForm.specialty} onChange={handleJob} required style={inputStyle}>
                      <option value="">Select specialty...</option>
                      {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Shift Type *</label>
                    <select name="shift_type" value={jobForm.shift_type} onChange={handleJob} required style={inputStyle}>
                      <option value="">Select...</option>
                      <option value="Day Shift">Day Shift</option>
                      <option value="Night Shift">Night Shift</option>
                      <option value="Evening Shift">Evening Shift</option>
                      <option value="Mixed Shifts">Mixed Shifts</option>
                    </select>
                  </div>
                </div>
                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>City *</label>
                    <input name="city" value={jobForm.city} onChange={handleJob} required style={inputStyle} placeholder="e.g. Chicago" />
                  </div>
                  <div>
                    <label style={labelStyle}>State *</label>
                    <select name="state" value={jobForm.state} onChange={handleJob} required style={inputStyle}>
                      <option value="">Select...</option>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>Pay Rate ($/hr)</label>
                    <input name="pay_rate" type="number" min="0" step="0.01" value={jobForm.pay_rate} onChange={handleJob} style={inputStyle} placeholder="e.g. 78.00" />
                  </div>
                  <div>
                    <label style={labelStyle}>Contract Length</label>
                    <select name="contract_length" value={jobForm.contract_length} onChange={handleJob} style={inputStyle}>
                      <option value="">Select...</option>
                      <option value="13 Weeks">13 Weeks</option>
                      <option value="26 Weeks">26 Weeks</option>
                      <option value="Permanent">Permanent</option>
                      <option value="PRN / Per Diem">PRN / Per Diem</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Job Description *</label>
                  <textarea name="description" value={jobForm.description} onChange={handleJob} required rows={5}
                    placeholder="Describe the role, responsibilities, and what makes this opportunity great..."
                    style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={labelStyle}>Requirements</label>
                  <textarea name="requirements" value={jobForm.requirements} onChange={handleJob} rows={3}
                    placeholder="License requirements, certifications, years of experience, etc."
                    style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" onClick={() => navigate('/employer/dashboard')}
                style={{ padding: '11px 24px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={saving}
                style={{ padding: '11px 32px', background: saving ? 'var(--text-muted)' : 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Posting...' : 'Post Job'}
              </button>
            </div>
          </form>
        )}

        {/* ── SHIFT FORM ── */}
        {postingType === 'shift' && (
          <form onSubmit={submitShift}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '32px' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '24px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
                Per Diem Shift Details
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Specialty Required *</label>
                  <select name="specialty" value={shiftForm.specialty} onChange={handleShift} required style={inputStyle}>
                    <option value="">Select specialty...</option>
                    {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Shift Date *</label>
                  <input name="shift_date" type="date" value={shiftForm.shift_date} onChange={handleShift} required style={inputStyle} min={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>Start Time *</label>
                    <input name="start_time" type="time" value={shiftForm.start_time} onChange={handleShift} required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>End Time *</label>
                    <input name="end_time" type="time" value={shiftForm.end_time} onChange={handleShift} required style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Hourly Rate ($/hr)</label>
                  <input name="hourly_rate" type="number" min="0" step="0.01" value={shiftForm.hourly_rate} onChange={handleShift} style={inputStyle} placeholder="e.g. 65.00" />
                </div>
                <div>
                  <label style={labelStyle}>Notes</label>
                  <textarea name="notes" value={shiftForm.notes} onChange={handleShift} rows={3}
                    placeholder="Special requirements, unit details, parking info..."
                    style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" onClick={() => navigate('/employer/dashboard')}
                style={{ padding: '11px 24px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={saving}
                style={{ padding: '11px 32px', background: saving ? 'var(--text-muted)' : 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Posting...' : 'Post Shift'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
