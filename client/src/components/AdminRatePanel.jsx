import { useMemo, useState } from 'react'
import { formatHourly } from '../lib/format'

// Admin control for a nurse's pay. The breakdown itself (pay + Seraphyn fee =
// bill rate) is public; what is admin-only here is the override and its reason.
// The bill rate derives live as you type.
export default function AdminRatePanel({ rate, onSave, saving = false }) {
  const [override, setOverride] = useState(rate?.admin_hourly != null ? String(rate.admin_hourly) : '')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  // Re-sync the inputs when a different rate row arrives. Done during render
  // rather than in an effect so it lands before paint and doesn't cascade.
  const [syncedRate, setSyncedRate] = useState(rate)
  if (syncedRate !== rate) {
    setSyncedRate(rate)
    setOverride(rate?.admin_hourly != null ? String(rate.admin_hourly) : '')
    setReason('')
    setError('')
  }

  const agencyFee = Number(rate?.agency_fee ?? 0)

  // Mirrors computeBillRate() in server/lib/rates.js: pay + flat fee.
  // Preview only -- the server recomputes.
  const preview = useMemo(() => {
    const base = override.trim() !== ''
      ? Number(override)
      : rate?.desired_hourly != null ? Number(rate.desired_hourly) : null

    if (base === null || !Number.isFinite(base) || base <= 0 || !agencyFee) return null
    return { base, billRate: Math.round((base + agencyFee) * 100) / 100 }
  }, [override, rate, agencyFee])

  async function submit() {
    setError('')
    setSaved(false)

    const trimmed = override.trim()
    if (trimmed !== '') {
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError('Enter a valid hourly rate.')
        return
      }
      if (!reason.trim()) {
        setError('A reason is required when overriding a nurse rate.')
        return
      }
    }

    try {
      await onSave({
        admin_hourly: trimmed === '' ? null : Number(trimmed),
        reason: reason.trim()
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  const cellLabel = {
    fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em',
    color: 'var(--text-muted)', marginBottom: '4px'
  }
  const cellValue = {
    fontFamily: 'Cormorant Garamond, serif', fontSize: '20px',
    fontWeight: '500', color: 'var(--deep-navy)', lineHeight: 1.2
  }
  const inputStyle = {
    width: '100%', padding: '8px 10px', background: 'white',
    border: '1px solid var(--border)', borderRadius: '2px', fontSize: '13px',
    color: 'var(--deep-navy)', outline: 'none', fontFamily: 'DM Sans, sans-serif'
  }

  if (!rate) {
    return (
      <div style={{ padding: '14px 16px', background: 'var(--warm-white)', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '12px', color: 'var(--text-muted)' }}>
        Rate data unavailable. Confirm docs/NURSE_RATES.sql has been applied.
      </div>
    )
  }

  return (
    <div style={{ padding: '16px', background: 'var(--warm-white)', border: '1px solid var(--border)', borderRadius: '2px', marginBottom: '16px' }}>
      <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warm-gold)', fontWeight: '600', marginBottom: '14px' }}>
        Rate
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
        <div>
          <p style={cellLabel}>Nurse Pay</p>
          <p style={cellValue}>{formatHourly(rate.nurse_rate, { empty: 'Not set' })}</p>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {rate.admin_hourly != null ? 'admin override' : rate.desired_hourly != null ? 'nurse-set' : '—'}
          </p>
        </div>
        <div>
          <p style={cellLabel}>Seraphyn Fee</p>
          <p style={cellValue}>{agencyFee ? formatHourly(agencyFee) : '—'}</p>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            flat, all nurses
          </p>
        </div>
        <div>
          <p style={cellLabel}>Bill Rate</p>
          <p style={{ ...cellValue, color: preview ? 'var(--deep-navy)' : 'var(--text-muted)' }}>
            {preview ? formatHourly(preview.billRate) : formatHourly(rate.bill_rate, { empty: '—' })}
          </p>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            what hospitals see
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: '10px', alignItems: 'end' }}>
        <div>
          <p style={cellLabel}>Override Rate</p>
          <input
            type="number" min="0" step="0.50" value={override}
            onChange={(e) => setOverride(e.target.value)}
            placeholder="leave blank to clear" style={inputStyle}
          />
        </div>
        <div>
          <p style={cellLabel}>Reason</p>
          <input
            value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Required when overriding" style={inputStyle}
          />
        </div>
        <button
          type="button" onClick={submit} disabled={saving}
          style={{ padding: '9px 16px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, whiteSpace: 'nowrap' }}
        >
          {saving ? 'Saving...' : 'Save Rate'}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: '11px', color: '#B43C3C', marginTop: '10px' }}>{error}</p>
      )}
      {saved && (
        <p style={{ fontSize: '11px', color: 'var(--success)', marginTop: '10px' }}>&#10003; Rate saved.</p>
      )}
    </div>
  )
}
