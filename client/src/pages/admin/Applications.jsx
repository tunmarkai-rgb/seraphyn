import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from '../../components/AdminLayout'

const STATUS_CONFIG = {
  submitted:  { label: 'Submitted',    bg: 'rgba(126,181,200,0.12)', color: 'var(--sky-blue)' },
  reviewing:  { label: 'Reviewing',    bg: 'rgba(200,169,110,0.12)', color: 'var(--warm-gold)' },
  interview:  { label: 'Interview',    bg: 'rgba(200,169,110,0.18)', color: 'var(--warm-gold)' },
  offer:      { label: 'Offer',        bg: 'rgba(45,122,79,0.12)',   color: 'var(--success)' },
  hired:      { label: 'Hired',        bg: 'rgba(45,122,79,0.2)',    color: 'var(--success)' },
  rejected:   { label: 'Not Selected', bg: 'rgba(180,60,60,0.1)',    color: '#B43C3C' },
}

export default function AdminApplications() {
  const [apps, setApps] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [savingNote, setSavingNote] = useState(null)
  const [notes, setNotes] = useState({})
  const [placementFees, setPlacementFees] = useState({})

  useEffect(() => { loadApps() }, [filter])

  async function loadApps() {
    setLoading(true)
    const query = supabase
      .from('applications')
      .select(`
        *,
        jobs(title, city, state, specialty),
        nurse_profiles(first_name, last_name, specialty),
        employer_profiles(org_name)
      `)
      .order('created_at', { ascending: false })
    if (filter !== 'all') query.eq('status', filter)
    const { data } = await query
    setApps(data || [])
    const initialNotes = {}
    const initialFees = {};
    (data || []).forEach(a => {
      initialNotes[a.id] = a.admin_notes || ''
      initialFees[a.id] = a.placement_fee_pct || ''
    })
    setNotes(initialNotes)
    setPlacementFees(initialFees)
    setLoading(false)
  }

  async function saveNote(appId) {
    setSavingNote(appId)
    await supabase.from('applications').update({
      admin_notes: notes[appId],
      placement_fee_pct: placementFees[appId] ? parseFloat(placementFees[appId]) : null,
      updated_at: new Date().toISOString()
    }).eq('id', appId)
    setSavingNote(null)
  }

  return (
    <AdminLayout title="Applications">
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {[['all','All'], ...Object.entries(STATUS_CONFIG).map(([k,v]) => [k, v.label])].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            style={{ padding: '7px 16px', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer', border: filter === val ? '1px solid var(--deep-navy)' : '1px solid var(--border)', background: filter === val ? 'var(--deep-navy)' : 'white', color: filter === val ? 'white' : 'var(--text-muted)' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading...</div>
      ) : apps.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '60px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>No applications found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {apps.map(app => {
            const s = STATUS_CONFIG[app.status] || STATUS_CONFIG.submitted
            return (
              <div key={app.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '4px' }}>
                      {app.nurse_profiles?.first_name} {app.nurse_profiles?.last_name}
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '400' }}> → {app.jobs?.title}</span>
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {app.employer_profiles?.org_name} · {app.jobs?.city}, {app.jobs?.state}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Applied {new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: '2px', fontSize: '11px', fontWeight: '500', background: s.bg, color: s.color }}>{s.label}</span>
                </div>

                {app.cover_note && (
                  <div style={{ background: 'var(--warm-white)', borderRadius: '2px', padding: '10px 12px', marginBottom: '14px', fontSize: '13px', color: 'var(--deep-navy)', fontStyle: 'italic' }}>
                    "{app.cover_note}"
                  </div>
                )}

                {app.status === 'hired' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', padding: '12px', background: 'rgba(45,122,79,0.06)', borderRadius: '4px', flexWrap: 'wrap' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Placement Fee %</label>
                      <input type="number" min="0" max="100" step="0.5" value={placementFees[app.id] || ''} onChange={e => setPlacementFees({ ...placementFees, [app.id]: e.target.value })}
                        placeholder="e.g. 12.5"
                        style={{ width: '100px', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '13px', outline: 'none', fontFamily: 'DM Sans' }} />
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--success)', marginTop: '18px' }}>💰 Save the percentage so Kundayi can invoice this placement offline</p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Admin Note</label>
                    <input value={notes[app.id] || ''} onChange={e => setNotes({ ...notes, [app.id]: e.target.value })}
                      placeholder="Add a note for the employer..."
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '13px', outline: 'none', fontFamily: 'DM Sans', color: 'var(--deep-navy)' }} />
                  </div>
                  <button onClick={() => saveNote(app.id)} disabled={savingNote === app.id}
                    style={{ padding: '8px 16px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {savingNote === app.id ? 'Saving...' : 'Save Note'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
