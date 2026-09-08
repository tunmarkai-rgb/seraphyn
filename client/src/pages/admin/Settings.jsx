import { useEffect, useState } from 'react'
import { apiRequest } from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'
import { formatHourly } from '../../lib/format'

// CONFIDENTIAL. The markup set here decides Seraphyn's margin on every per diem
// and contract placement. It is never shown to employers or nurses.
export default function AdminSettings() {
  const [form, setForm] = useState({
    markup_pct: '', rounding_increment: '', min_nurse_rate: '', max_nurse_rate: '', note: ''
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
        markup_pct: String(data.markup_pct ?? ''),
        rounding_increment: String(data.rounding_increment ?? ''),
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
          markup_pct: Number(form.markup_pct),
          rounding_increment: Number(form.rounding_increment),
          min_nurse_rate: Number(form.min_nurse_rate),
          max_nurse_rate: Number(form.max_nurse_rate),
          note: form.note
        }
      })
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

  // Worked example, so a mistyped margin is obvious before saving.
  const markup = Number(form.markup_pct)
  const increment = Number(form.rounding_increment) || 0.5
  const sample = 60
  const preview = Number.isFinite(markup) && markup > 0
    ? Math.ceil((sample * (1 + markup / 100)) / increment) * increment
    : null

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
              The agency markup added to a nurse&rsquo;s rate to produce the bill rate an
              employer sees. Applies to per diem and contract hourly work only &mdash;
              direct hire uses the placement fee in the signed agreement. Changes take
              effect immediately across the portal.
            </p>

            {loading ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</p>
            ) : (
              <>
                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Agency Markup (%)</label>
                    <input name="markup_pct" type="number" min="0.01" max="500" step="0.5" value={form.markup_pct} onChange={handle} style={inputStyle} required />
                  </div>
                  <div>
                    <label style={labelStyle}>Round Up To ($)</label>
                    <input name="rounding_increment" type="number" min="0.01" step="0.25" value={form.rounding_increment} onChange={handle} style={inputStyle} required />
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
                      ? `A ${formatHourly(sample)} nurse bills at ${formatHourly(preview)} — a margin of ${formatHourly(preview - sample)}.`
                      : 'Enter a markup to preview the effect.'}
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
