// Nurse-facing: how the nurse's desired pay fits a job's budget. Coarse on
// purpose -- the label never says by how much, so a hospital's budget can't be
// read off it. Labels come from GET /api/nurses/self/market (job_fit).

const FIT_STYLES = {
  fits: { dot: '🟢', text: 'Fits your desired pay', color: 'var(--success)', bg: 'rgba(45,122,79,0.10)' },
  may_consider: { dot: '🟡', text: 'Above budget — urgent need, may consider', color: 'var(--warm-gold)', bg: 'rgba(200,169,110,0.15)' },
  above_budget: { dot: '🔴', text: "Above this hospital's budget", color: '#B43C3C', bg: 'rgba(180,60,60,0.08)' }
}

export default function FitBadge({ label, compact = false }) {
  const style = FIT_STYLES[label]
  if (!style) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: compact ? '3px 8px' : '4px 10px', borderRadius: '2px',
      background: style.bg, color: style.color,
      fontSize: compact ? '10px' : '11px', fontWeight: '500', letterSpacing: '0.02em'
    }}>
      <span aria-hidden="true">{style.dot}</span>{style.text}
    </span>
  )
}
