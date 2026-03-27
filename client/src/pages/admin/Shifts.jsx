import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/AdminLayout'

const STATUS_COLORS = {
  open:       { label: 'Open',       bg: 'rgba(45,122,79,0.1)',    color: 'var(--success)' },
  filled:     { label: 'Filled',     bg: 'rgba(126,181,200,0.12)', color: 'var(--sky-blue)' },
  completed:  { label: 'Completed',  bg: 'rgba(90,107,122,0.1)',   color: 'var(--text-muted)' },
  cancelled:  { label: 'Cancelled',  bg: 'rgba(180,60,60,0.1)',    color: '#B43C3C' },
}

export default function AdminShifts() {
  const [shifts, setShifts] = useState([])
  const [filter, setFilter] = useState('open')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => { loadShifts() }, [filter])

  async function loadShifts() {
    setLoading(true)
    const query = supabase
      .from('per_diem_shifts')
      .select(`
        *,
        employer_profiles(org_name, city, state),
        nurse_profiles(first_name, last_name)
      `)
      .order('shift_date', { ascending: true })
    if (filter !== 'all') query.eq('status', filter)
    const { data } = await query
    setShifts(data || [])
    setLoading(false)
  }

  async function updateStatus(shiftId, status) {
    setActionLoading(shiftId)
    await supabase.from('per_diem_shifts').update({ status, updated_at: new Date().toISOString() }).eq('id', shiftId)
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, status } : s))
    setActionLoading(null)
  }

  async function updateAdminNote(shiftId, note) {
    await supabase.from('per_diem_shifts').update({ admin_notes: note }).eq('id', shiftId)
  }

  return (
    <AdminLayout title="Per Diem Shifts">
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {[['all','All'],['open','Open'],['filled','Filled'],['completed','Completed'],['cancelled','Cancelled']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            style={{ padding: '7px 16px', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer', border: filter === val ? '1px solid var(--deep-navy)' : '1px solid var(--border)', background: filter === val ? 'var(--deep-navy)' : 'white', color: filter === val ? 'white' : 'var(--text-muted)' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : shifts.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '60px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>No shifts found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {shifts.map(shift => {
            const s = STATUS_COLORS[shift.status] || STATUS_COLORS.open
            const date = shift.shift_date ? new Date(shift.shift_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'
            return (
              <div key={shift.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '4px' }}>
                      {shift.specialty} · {shift.employer_profiles?.org_name}
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      📅 {date} · {shift.start_time} – {shift.end_time}
                      {shift.hourly_rate && ` · $${shift.hourly_rate}/hr`}
                    </p>
                    {shift.nurse_profiles && (
                      <p style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px' }}>
                        👤 Assigned: {shift.nurse_profiles.first_name} {shift.nurse_profiles.last_name}
                      </p>
                    )}
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: '2px', fontSize: '10px', fontWeight: '500', background: s.bg, color: s.color }}>{s.label}</span>
                </div>

                {shift.notes && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', fontStyle: 'italic' }}>"{shift.notes}"</p>
                )}

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {shift.status === 'open' && (
                    <>
                      <button onClick={() => updateStatus(shift.id, 'filled')} disabled={actionLoading === shift.id}
                        style={{ padding: '6px 12px', background: 'rgba(126,181,200,0.12)', color: 'var(--sky-blue)', border: 'none', borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontWeight: '500' }}>
                        Mark Filled
                      </button>
                      <button onClick={() => updateStatus(shift.id, 'cancelled')} disabled={actionLoading === shift.id}
                        style={{ padding: '6px 12px', background: 'rgba(180,60,60,0.1)', color: '#B43C3C', border: 'none', borderRadius: '2px', fontSize: '11px', cursor: 'pointer' }}>
                        Cancel Shift
                      </button>
                    </>
                  )}
                  {shift.status === 'filled' && (
                    <button onClick={() => updateStatus(shift.id, 'completed')} disabled={actionLoading === shift.id}
                      style={{ padding: '6px 12px', background: 'rgba(45,122,79,0.1)', color: 'var(--success)', border: 'none', borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontWeight: '500' }}>
                      ✓ Mark Completed
                    </button>
                  )}
                  <input
                    defaultValue={shift.admin_notes || ''}
                    onBlur={e => updateAdminNote(shift.id, e.target.value)}
                    placeholder="Admin note..."
                    style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '12px', outline: 'none', fontFamily: 'DM Sans', color: 'var(--deep-navy)', flex: 1, minWidth: '160px' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
