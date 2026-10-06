import { useState } from 'react'
import { apiRequest } from '../lib/api'
import { formatHourly } from '../lib/format'
import { SPECIALTIES, US_STATES, SHIFT_TYPE_OPTIONS } from '../lib/constants'

// Employer-initiated request for a specific nurse. The rate panel restates the
// published breakdown (desired pay + Seraphyn fee = hospital rate) and
// disclaims it so a directory figure does not become a contractual quote.
// `aboveBudget` is set when the employer chose "Consider Anyway" on a nurse
// above their stated maximum; the note says so, so the coordinator knows.
export default function RequestNurseModal({ nurse, employer, aboveBudget = false, onClose, onSubmitted }) {
  const [form, setForm] = useState({
    engagement_type: 'per_diem',
    start_date: '',
    end_date: '',
    hours_per_week: '',
    shift_type: '',
    specialty: nurse?.specialty || '',
    city: employer?.city || '',
    state: employer?.state || '',
    employer_note: aboveBudget
      ? "This nurse's rate is above our stated maximum, but we'd like to consider them."
      : ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const isContract = form.engagement_type === 'contract'
  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')

    if (!form.start_date) return setError('Choose a start date.')
    if (!form.city.trim() || !form.state) return setError('City and state are required.')
    if (isContract && form.end_date && form.end_date < form.start_date) {
      return setError('The end date cannot be before the start date.')
    }

    setSaving(true)
    try {
      const created = await apiRequest('/api/employers/nurse-requests', {
        method: 'POST',
        body: {
          nurse_id: nurse.id,
          engagement_type: form.engagement_type,
          start_date: form.start_date,
          end_date: isContract && form.end_date ? form.end_date : null,
          hours_per_week: isContract && form.hours_per_week ? Number(form.hours_per_week) : null,
          shift_type: form.shift_type || null,
          specialty: form.specialty || null,
          city: form.city.trim(),
          state: form.state,
          employer_note: form.employer_note.trim()
        }
      })
      setDone(true)
      setTimeout(() => {
        onSubmitted?.(created)
        onClose?.()
      }, 2200)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  const labelStyle = {
    display: 'block', fontSize: '10px', letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--text-muted)',
    fontWeight: '500', marginBottom: '6px'
  }
  const inputStyle = {
    width: '100%', padding: '10px 12px', background: 'var(--warm-white)',
    border: '1px solid var(--border)', borderRadius: '2px', fontSize: '13px',
    color: 'var(--deep-navy)', outline: 'none', fontFamily: 'DM Sans, sans-serif'
  }

  const nurseLabel = `${nurse?.first_name || ''} ${nurse?.last_name ? nurse.last_name[0] + '.' : ''}`.trim()
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(44,62,80,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000, overflowY: 'auto' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '4px', padding: '28px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 8px' }}>
            <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: 'var(--success)', marginBottom: '10px' }}>
              Request submitted.
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Your Seraphyn coordinator will confirm availability and rate, usually
              within one business day. Track it under Requests.
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', color: 'var(--deep-navy)', marginBottom: '4px' }}>
              Request {nurseLabel || 'this nurse'}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {nurse?.specialty}
              {nurse?.years_experience ? ` · ${nurse.years_experience} yrs experience` : ''}
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Engagement Type</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[['per_diem', 'Per Diem'], ['contract', 'Contract']].map(([value, label]) => {
                  const active = form.engagement_type === value
                  return (
                    <button
                      key={value} type="button"
                      onClick={() => setForm({ ...form, engagement_type: value })}
                      style={{ flex: 1, padding: '9px', background: active ? 'var(--deep-navy)' : 'white', color: active ? 'white' : 'var(--deep-navy)', border: `1px solid ${active ? 'var(--deep-navy)' : 'var(--border)'}`, borderRadius: '2px', fontSize: '12px', letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer' }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Start Date *</label>
                <input name="start_date" type="date" min={today} value={form.start_date} onChange={handle} style={inputStyle} required />
              </div>
              {isContract ? (
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input name="end_date" type="date" min={form.start_date || today} value={form.end_date} onChange={handle} style={inputStyle} />
                </div>
              ) : (
                <div>
                  <label style={labelStyle}>Shift Type</label>
                  <select name="shift_type" value={form.shift_type} onChange={handle} style={inputStyle}>
                    <option value="">Any</option>
                    {SHIFT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {isContract && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Hours Per Week</label>
                  <input name="hours_per_week" type="number" min="1" max="80" value={form.hours_per_week} onChange={handle} style={inputStyle} placeholder="e.g. 36" />
                </div>
                <div>
                  <label style={labelStyle}>Shift Type</label>
                  <select name="shift_type" value={form.shift_type} onChange={handle} style={inputStyle}>
                    <option value="">Any</option>
                    {SHIFT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>City *</label>
                <input name="city" value={form.city} onChange={handle} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>State *</label>
                <select name="state" value={form.state} onChange={handle} style={inputStyle} required>
                  <option value="">Select</option>
                  {US_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Specialty Needed</label>
              <select name="specialty" value={form.specialty} onChange={handle} style={inputStyle}>
                <option value="">Any</option>
                {SPECIALTIES.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>What Do You Need?</label>
              <textarea
                name="employer_note" rows="4" value={form.employer_note} onChange={handle}
                style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="Unit, ratios, orientation, anything the coordinator should know."
              />
            </div>

            <div style={{ padding: '14px 16px', background: 'var(--warm-white)', border: '1px solid var(--border)', borderRadius: '2px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                  Indicative Hospital Rate
                </span>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: '500', color: 'var(--deep-navy)' }}>
                  {nurse?.has_rate ? formatHourly(nurse.bill_rate) : 'To be confirmed'}
                </span>
              </div>
              {nurse?.has_rate && (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  {formatHourly(nurse.nurse_pay)} nurse&rsquo;s desired pay + {formatHourly(nurse.agency_fee)} Seraphyn fee
                </p>
              )}
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {nurse?.has_rate
                  ? 'Final rate is confirmed by your Seraphyn coordinator before the assignment starts.'
                  : 'Your coordinator will confirm the rate within one business day.'}
              </p>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(180,60,60,0.08)', border: '1px solid rgba(180,60,60,0.3)', borderRadius: '2px', fontSize: '12px', color: '#B43C3C', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose}
                style={{ padding: '10px 20px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={saving}
                style={{ padding: '10px 22px', background: 'var(--warm-gold)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
