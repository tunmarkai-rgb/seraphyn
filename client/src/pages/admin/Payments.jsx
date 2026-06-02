import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'

const EMPTY_FORM = {
  employer_id: '',
  type: 'subscription',
  amount: '',
  currency: 'usd',
  placement_percentage: '',
  job_id: '',
  application_id: '',
  status: 'pending',
  notes: ''
}

export default function AdminPayments() {
  const [payments, setPayments] = useState([])
  const [employers, setEmployers] = useState([])
  const [filter, setFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    subscriptionRevenue: 0,
    placementRevenue: 0,
    succeededCount: 0,
    pendingCount: 0,
    failedCount: 0,
    refundedCount: 0,
    monthlyRevenue: []
  })
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    void loadPayments()
  }, [filter, statusFilter])

  useEffect(() => {
    void loadEmployers()
  }, [])

  async function loadPayments() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('type', filter)
      params.set('status', statusFilter)
      const data = await apiRequest(`/api/admin/payments?${params.toString()}`)
      setPayments(data.payments || [])
      setAnalytics(data.analytics || {})
    } finally {
      setLoading(false)
    }
  }

  async function loadEmployers() {
    const data = await apiRequest('/api/admin/employers')
    setEmployers(data || [])
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function startEdit(payment) {
    setEditingId(payment.id)
    setForm({
      employer_id: payment.employer_id || '',
      type: payment.type || 'subscription',
      amount: payment.amount != null ? String(payment.amount) : '',
      currency: payment.currency || 'usd',
      placement_percentage: payment.placement_percentage != null ? String(payment.placement_percentage) : '',
      job_id: payment.job_id || '',
      application_id: payment.application_id || '',
      status: payment.status || 'pending',
      notes: payment.notes || ''
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function savePayment(e) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      employer_id: form.employer_id,
      type: form.type,
      amount: Number(form.amount),
      currency: form.currency || 'usd',
      placement_percentage: form.placement_percentage ? Number(form.placement_percentage) : null,
      job_id: form.job_id || null,
      application_id: form.application_id || null,
      status: form.status,
      notes: form.notes
    }

    try {
      if (editingId) {
        const updated = await apiRequest(`/api/admin/payments/${editingId}`, {
          method: 'PUT',
          body: payload
        })
        setPayments((current) => current.map((payment) => (payment.id === editingId ? updated : payment)))
      } else {
        const created = await apiRequest('/api/admin/payments', {
          method: 'POST',
          body: payload
        })
        setPayments((current) => [created, ...current])
      }
      resetForm()
      await loadPayments()
    } finally {
      setSaving(false)
    }
  }

  async function deletePayment(paymentId) {
    setDeletingId(paymentId)
    try {
      await apiRequest(`/api/admin/payments/${paymentId}`, { method: 'DELETE' })
      setPayments((current) => current.filter((payment) => payment.id !== paymentId))
      await loadPayments()
      if (editingId === paymentId) resetForm()
    } finally {
      setDeletingId(null)
    }
  }

  function exportCSV() {
    const rows = [
      ['Date', 'Employer', 'Type', 'Amount (cents)', 'Status', 'Placement %', 'Notes'].join(','),
      ...payments.map((payment) => [
        new Date(payment.created_at).toISOString(),
        `"${payment.employer_profiles?.org_name || ''}"`,
        payment.type,
        payment.amount || '',
        payment.status,
        payment.placement_percentage || '',
        `"${(payment.notes || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([rows], { type: 'text/csv' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `seraphyn-payments-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  const monthlyRevenue = useMemo(() => analytics.monthlyRevenue || [], [analytics.monthlyRevenue])
  const formatAmount = (amount) => amount ? `$${(Number(amount) / 100).toFixed(2)}` : '$0.00'

  return (
    <AdminLayout title="Payments">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          ['Total Revenue', formatAmount(analytics.totalRevenue), 'var(--success)'],
          ['Subscriptions', formatAmount(analytics.subscriptionRevenue), 'var(--sky-blue)'],
          ['Placement Fees', formatAmount(analytics.placementRevenue), 'var(--warm-gold)'],
          ['Succeeded / Pending', `${analytics.succeededCount || 0} / ${analytics.pendingCount || 0}`, 'var(--deep-navy)']
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', color, marginBottom: '4px' }}>{value}</div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <form onSubmit={savePayment} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--deep-navy)' }}>
              {editingId ? 'Edit Payment' : 'Add Payment'}
            </h3>
            {editingId && (
              <button type="button" onClick={resetForm} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '2px', padding: '6px 12px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Cancel Edit
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Employer
              <select value={form.employer_id} onChange={(e) => updateForm('employer_id', e.target.value)} required style={fieldStyle}>
                <option value="">Select employer</option>
                {employers.map((employer) => (
                  <option key={employer.id} value={employer.id}>{employer.org_name}</option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Type
              <select value={form.type} onChange={(e) => updateForm('type', e.target.value)} style={fieldStyle}>
                <option value="subscription">Subscription</option>
                <option value="placement_fee">Placement Fee</option>
              </select>
            </label>
            <label style={labelStyle}>
              Amount (cents)
              <input value={form.amount} onChange={(e) => updateForm('amount', e.target.value)} required type="number" min="0" style={fieldStyle} />
            </label>
            <label style={labelStyle}>
              Status
              <select value={form.status} onChange={(e) => updateForm('status', e.target.value)} style={fieldStyle}>
                <option value="pending">Pending</option>
                <option value="succeeded">Succeeded</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </label>
            <label style={labelStyle}>
              Placement %
              <input value={form.placement_percentage} onChange={(e) => updateForm('placement_percentage', e.target.value)} type="number" min="0" step="0.01" style={fieldStyle} />
            </label>
            <label style={labelStyle}>
              Currency
              <input value={form.currency} onChange={(e) => updateForm('currency', e.target.value)} style={fieldStyle} />
            </label>
          </div>

          <label style={{ ...labelStyle, marginTop: '12px' }}>
            Notes
            <textarea value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button type="submit" disabled={saving} style={{ padding: '10px 18px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {saving ? 'Saving...' : editingId ? 'Update Payment' : 'Create Payment'}
            </button>
          </div>
        </form>

        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px' }}>
          <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', color: 'var(--deep-navy)', marginBottom: '16px' }}>Analytics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {[
              ['Succeeded', analytics.succeededCount || 0],
              ['Pending', analytics.pendingCount || 0],
              ['Failed', analytics.failedCount || 0],
              ['Refunded', analytics.refundedCount || 0]
            ].map(([label, value]) => (
              <div key={label} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '4px' }}>
                <div style={{ fontSize: '22px', color: 'var(--deep-navy)', marginBottom: '2px' }}>{value}</div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>

          <div>
            <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>Monthly Revenue</p>
            {monthlyRevenue.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No succeeded payments yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {monthlyRevenue.map((entry) => (
                  <div key={entry.month} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--deep-navy)' }}>
                    <span>{entry.month}</span>
                    <span>{formatAmount(entry.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[['all', 'All'], ['subscription', 'Subscriptions'], ['placement_fee', 'Placement Fees']].map(([value, label]) => (
            <button key={value} onClick={() => setFilter(value)} style={filterButtonStyle(filter === value)}>
              {label}
            </button>
          ))}
          {[['all', 'All Statuses'], ['pending', 'Pending'], ['succeeded', 'Succeeded'], ['failed', 'Failed'], ['refunded', 'Refunded']].map(([value, label]) => (
            <button key={value} onClick={() => setStatusFilter(value)} style={filterButtonStyle(statusFilter === value)}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={exportCSV} style={{ padding: '8px 16px', background: 'var(--warm-gold)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
          Export CSV
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : payments.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '60px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>No payment records found.</p>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--warm-white)' }}>
                {['Date', 'Employer', 'Type', 'Amount', 'Status', 'Placement %', 'Notes', 'Actions'].map((heading) => (
                  <th key={heading} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: '500', borderBottom: '1px solid var(--border)' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={cellStyle}>{new Date(payment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td style={cellStyle}>{payment.employer_profiles?.org_name || '—'}</td>
                  <td style={cellStyle}>{payment.type === 'placement_fee' ? 'Placement Fee' : 'Subscription'}</td>
                  <td style={{ ...cellStyle, fontFamily: 'Cormorant Garamond, serif', fontSize: '16px' }}>{formatAmount(payment.amount)}</td>
                  <td style={cellStyle}>{payment.status}</td>
                  <td style={cellStyle}>{payment.placement_percentage ? `${payment.placement_percentage}%` : '—'}</td>
                  <td style={cellStyle}>{payment.notes || '—'}</td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => startEdit(payment)} style={inlineActionStyle}>Edit</button>
                      <button onClick={() => deletePayment(payment.id)} disabled={deletingId === payment.id} style={{ ...inlineActionStyle, color: '#B43C3C', borderColor: 'rgba(180,60,60,0.2)' }}>
                        {deletingId === payment.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  )
}

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  fontSize: '11px',
  color: 'var(--text-muted)',
  textTransform: 'uppercase'
}

const fieldStyle = {
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: '2px',
  fontSize: '13px',
  outline: 'none',
  fontFamily: 'DM Sans',
  color: 'var(--deep-navy)',
  background: 'white'
}

const cellStyle = {
  padding: '12px 16px',
  fontSize: '13px',
  color: 'var(--deep-navy)'
}

const inlineActionStyle = {
  padding: '6px 10px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: '2px',
  fontSize: '11px',
  cursor: 'pointer',
  color: 'var(--deep-navy)'
}

function filterButtonStyle(active) {
  return {
    padding: '7px 16px',
    borderRadius: '2px',
    fontSize: '12px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontWeight: '500',
    cursor: 'pointer',
    border: active ? '1px solid var(--deep-navy)' : '1px solid var(--border)',
    background: active ? 'var(--deep-navy)' : 'white',
    color: active ? 'white' : 'var(--text-muted)'
  }
}
