import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/AdminLayout'

export default function AdminPayments() {
  const [payments, setPayments] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [totals, setTotals] = useState({ total: 0, subscription: 0, placement: 0 })

  useEffect(() => { loadPayments() }, [filter])

  async function loadPayments() {
    setLoading(true)
    const query = supabase
      .from('payments')
      .select('*, employer_profiles(org_name)')
      .order('created_at', { ascending: false })
    if (filter !== 'all') query.eq('type', filter)
    const { data } = await query
    setPayments(data || [])

    const allData = data || []
    setTotals({
      total: allData.filter(p => p.status === 'succeeded').reduce((s, p) => s + (p.amount || 0), 0),
      subscription: allData.filter(p => p.status === 'succeeded' && p.type === 'subscription').reduce((s, p) => s + (p.amount || 0), 0),
      placement: allData.filter(p => p.status === 'succeeded' && p.type === 'placement_fee').reduce((s, p) => s + (p.amount || 0), 0),
    })
    setLoading(false)
  }

  function exportCSV() {
    const rows = [
      ['Date', 'Employer', 'Type', 'Amount', 'Status', 'Notes'].join(','),
      ...payments.map(p => [
        new Date(p.created_at).toLocaleDateString(),
        p.employer_profiles?.org_name || '',
        p.type,
        p.amount ? `$${(p.amount / 100).toFixed(2)}` : '',
        p.status,
        p.notes || ''
      ].join(','))
    ].join('\n')
    const blob = new Blob([rows], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `seraphyn-payments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const STATUS_COLORS = {
    succeeded: { label: 'Succeeded', bg: 'rgba(45,122,79,0.1)',    color: 'var(--success)' },
    pending:   { label: 'Pending',   bg: 'rgba(200,169,110,0.12)', color: 'var(--warm-gold)' },
    failed:    { label: 'Failed',    bg: 'rgba(180,60,60,0.1)',    color: '#B43C3C' },
    refunded:  { label: 'Refunded',  bg: 'rgba(90,107,122,0.12)',  color: 'var(--text-muted)' },
  }

  const formatAmount = (amount) => amount ? `$${(amount / 100).toFixed(2)}` : '—'

  return (
    <AdminLayout title="Payments">
      <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
        Payments remain offline in M2. This screen is for manual revenue tracking only.
      </div>
      {/* Totals */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total Revenue', value: formatAmount(totals.total), icon: '💰', color: 'var(--success)' },
          { label: 'Subscriptions', value: formatAmount(totals.subscription), icon: '🔄', color: 'var(--sky-blue)' },
          { label: 'Placement Fees', value: formatAmount(totals.placement), icon: '🤝', color: 'var(--warm-gold)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px' }}>
            <div style={{ fontSize: '22px', marginBottom: '8px' }}>{s.icon}</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: '300', color: s.color, marginBottom: '4px' }}>{s.value}</div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[['all','All'],['subscription','Subscriptions'],['placement_fee','Placement Fees']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              style={{ padding: '7px 16px', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer', border: filter === val ? '1px solid var(--deep-navy)' : '1px solid var(--border)', background: filter === val ? 'var(--deep-navy)' : 'white', color: filter === val ? 'white' : 'var(--text-muted)' }}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={exportCSV}
          style={{ padding: '8px 16px', background: 'var(--warm-gold)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
          ↓ Export CSV
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : payments.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '60px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>No payment records yet.</p>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--warm-white)' }}>
                {['Date', 'Employer', 'Type', 'Amount', 'Placement %', 'Status', 'Notes'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: '500', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => {
                const s = STATUS_COLORS[p.status] || STATUS_COLORS.pending
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--deep-navy)' }}>{p.employer_profiles?.org_name || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '2px', fontSize: '10px', fontWeight: '500', background: p.type === 'subscription' ? 'rgba(126,181,200,0.1)' : 'rgba(200,169,110,0.1)', color: p.type === 'subscription' ? 'var(--sky-blue)' : 'var(--warm-gold)', textTransform: 'capitalize' }}>
                        {p.type === 'placement_fee' ? 'Placement Fee' : 'Subscription'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', fontWeight: '500', color: 'var(--deep-navy)' }}>
                      {formatAmount(p.amount)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      {p.placement_percentage ? `${p.placement_percentage}%` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '2px', fontSize: '10px', fontWeight: '500', background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.notes || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}
