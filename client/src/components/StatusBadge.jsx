export default function StatusBadge({ status }) {
  const cfg = {
    pending:   { label: 'Pending',   bg: 'rgba(200,169,110,0.12)', color: 'var(--warm-gold)' },
    approved:  { label: 'Approved',  bg: 'rgba(45,122,79,0.1)',    color: 'var(--success)' },
    rejected:  { label: 'Rejected',  bg: 'rgba(180,60,60,0.1)',    color: '#B43C3C' },
    suspended: { label: 'Suspended', bg: 'rgba(90,107,122,0.12)',  color: 'var(--text-muted)' },
  }[status] || { label: status || '—', bg: 'var(--border)', color: 'var(--text-muted)' }
  return (
    <span style={{ padding: '4px 10px', borderRadius: '2px', fontSize: '10px', fontWeight: '500', letterSpacing: '0.06em', background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}
