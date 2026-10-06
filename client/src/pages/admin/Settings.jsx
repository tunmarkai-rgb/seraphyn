import { useEffect, useState } from 'react'
import { apiRequest } from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { formatHourly } from '../../lib/format'
import { resetPricing } from '../../lib/pricing'

// The Seraphyn agency fee: a flat dollar amount added to every nurse's desired
// pay to give the hospital bill rate. It is published -- hospitals and nurses
// both see it -- so a change here shows up on every profile and in the
// directory immediately. Open quotes and booked shifts keep the fee they were
// made with.
export default function AdminSettings() {
  const [form, setForm] = useState({
    agency_fee: '', min_nurse_rate: '', max_nurse_rate: '', note: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest('/api/admin/settings/per-diem-billing')
      setForm({
        agency_fee: String(data.agency_fee ?? ''),
        min_nurse_rate: String(data.min_nurse_rate ?? ''),
        max_nurse_rate: String(data.max_nurse_rate ?? ''),
        note: ''
      })
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await apiRequest('/api/admin/settings/per-diem-billing', {
        method: 'PUT',
        body: {
          agency_fee: Number(form.agency_fee),
          min_nurse_rate: Number(form.min_nurse_rate),
          max_nurse_rate: Number(form.max_nurse_rate),
          note: form.note
        }
      })
      resetPricing()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  function handle(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  // Worked example, so a mistyped fee is obvious before saving.
  const fee = Number(form.agency_fee)
  const sample = 65
  const preview = Number.isFinite(fee) && fee > 0 ? sample + fee : null

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: 'var(--warm-white)',
    border: '1px solid var(--border)', borderRadius: '2px', fontSize: '14px',
    color: 'var(--deep-navy)', outline: 'none', fontFamily: 'DM Sans, sans-serif'
  }
  const labelStyle = {
    display: 'block', fontSize: '11px', letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--text-muted)',
    fontWeight: '500', marginBottom: '6px'
  }

  return (
    <AdminLayout title="Settings">
      <div style={{ maxWidth: '720px' }}>
        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(180,60,60,0.08)', border: '1px solid rgba(180,60,60,0.3)', borderRadius: '2px', fontSize: '13px', color: '#B43C3C', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={save}>
          <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '6px' }}>
              Per Diem Billing
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border)', lineHeight: 1.6 }}>
              The Seraphyn agency fee added to every nurse&rsquo;s desired pay to give
              the hospital bill rate. It is shown openly to hospitals and nurses. Applies
              to per diem and contract hourly work only &mdash; direct hire uses the
              placement fee in the signed agreement. Changes take effect immediately;
              open quotes and booked shifts keep the fee they were made with.
            </p>

            {loading ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</p>
            ) : (
              <>
                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Seraphyn Agency Fee ($/hr)</label>
                    <input name="agency_fee" type="number" min="0.01" max="500" step="0.5" value={form.agency_fee} onChange={handle} style={{ ...inputStyle, maxWidth: '200px' }} required />
                  </div>
                  <div>
                    <label style={labelStyle}>Minimum Nurse Rate ($/hr)</label>
                    <input name="min_nurse_rate" type="number" min="0.01" step="0.5" value={form.min_nurse_rate} onChange={handle} style={inputStyle} required />
                  </div>
                  <div>
                    <label style={labelStyle}>Maximum Nurse Rate ($/hr)</label>
                    <input name="max_nurse_rate" type="number" min="0.01" step="0.5" value={form.max_nurse_rate} onChange={handle} style={inputStyle} required />
                  </div>
                </div>

                <div style={{ padding: '14px 16px', background: 'var(--warm-white)', border: '1px solid var(--border)', borderRadius: '2px', marginBottom: '16px' }}>
                  <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>Worked Example</p>
                  <p style={{ fontSize: '14px', color: 'var(--deep-navy)' }}>
                    {preview
                      ? `A nurse asking ${formatHourly(sample)} is shown to hospitals at ${formatHourly(preview)} (${formatHourly(sample)} pay + ${formatHourly(fee)} Seraphyn fee).`
                      : 'Enter a fee to preview the effect.'}
                  </p>
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={labelStyle}>Change Note (optional)</label>
                  <input name="note" value={form.note} onChange={handle} style={inputStyle} placeholder="Why is this changing? Kept in the audit trail." />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <button type="submit" disabled={saving}
                    style={{ padding: '11px 24px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                  {saved && <span style={{ fontSize: '12px', color: 'var(--success)' }}>&#10003; Saved. Bill rates updated portal-wide.</span>}
                </div>
              </>
            )}
          </section>
        </form>
      </div>
    </AdminLayout>
  )
}
