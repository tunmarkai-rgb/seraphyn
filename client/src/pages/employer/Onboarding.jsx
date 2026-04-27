import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Navbar from '../../components/Navbar'
import { US_STATES } from '../../lib/constants'
import { apiRequest } from '../../lib/api'

const ORG_TYPES = [
  'Hospital', 'Urgent Care', 'Outpatient Clinic', 'Long-Term Care Facility',
  'Home Health Agency', 'Rehabilitation Center', 'Surgical Center',
  'Behavioral Health', 'School Health', 'Other'
]

export default function EmployerOnboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [empProfile, setEmpProfile] = useState(null)
  const [contractRecord, setContractRecord] = useState(null)
  const [stage, setStage] = useState(1)
  const [form, setForm] = useState({
    org_name: '', org_type: '', contact_name: '', contact_title: '',
    city: '', state: '', bed_count: '', description: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [syncingContact, setSyncingContact] = useState(false)

  useEffect(() => {
    if (user) loadProfile()
  }, [user])

  useEffect(() => {
    if (!user || stage !== 2) return

    const interval = setInterval(() => {
      loadProfile()
    }, 5000)

    return () => clearInterval(interval)
  }, [user, stage])

  async function loadProfile() {
    const { data } = await supabase
      .from('employer_profiles')
      .select('*, contracts(status, sent_at, signed_at, signed_url)')
      .eq('user_id', user.id)
      .single()
    if (data) {
      setEmpProfile(data)
      setContractRecord(data.contracts?.[0] || null)
      const STAGE_MAP = { profile: 1, contract: 2, approved: 3 }
      const nextStage = data.onboarding_stage === 'approved'
        ? 3
        : data.contract_signed
          ? 3
          : STAGE_MAP[data.onboarding_stage] || 1
      setStage(nextStage)
      setForm({
        org_name: data.org_name || '',
        org_type: data.org_type || '',
        contact_name: data.contact_name || '',
        contact_title: data.contact_title || '',
        city: data.city || '',
        state: data.state || '',
        bed_count: data.bed_count || '',
        description: data.description || ''
      })

      if (!data.ghl_contact_id && !syncingContact) {
        void syncContact()
      }
    }
  }

  async function syncContact() {
    if (syncingContact) return
    setSyncingContact(true)
    try {
      await apiRequest('/api/integrations/ghl/sync-self', { method: 'POST' })
    } catch (syncError) {
      console.error('Employer onboarding GHL sync failed:', syncError.message)
    } finally {
      setSyncingContact(false)
    }
  }

  function handle(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function submitStage1(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { error: err } = await supabase
        .from('employer_profiles')
        .upsert({
          ...form,
          user_id: user.id,
          bed_count: form.bed_count ? parseInt(form.bed_count) : null,
          onboarding_stage: 'contract',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
      if (err) throw err
      await syncContact()
      await apiRequest('/api/integrations/events/self', {
        method: 'POST',
        body: {
          event: 'employer.signup_confirmed',
          payload: {
            orgType: form.org_type,
            city: form.city,
            state: form.state,
            bedCount: form.bed_count ? parseInt(form.bed_count, 10) : null
          }
        }
      })
      setStage(2)
      loadProfile()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px',
    background: 'var(--warm-white)', border: '1px solid var(--border)',
    borderRadius: '2px', fontSize: '14px', color: 'var(--deep-navy)',
    outline: 'none', fontFamily: 'DM Sans, sans-serif'
  }
  const labelStyle = {
    display: 'block', fontSize: '11px', letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--text-muted)',
    fontWeight: '500', marginBottom: '6px'
  }

  const steps = [
    { num: 1, label: 'Organization Profile' },
    { num: 2, label: 'Sign Agreement' },
    { num: 3, label: 'Pending Approval' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '100px 24px 60px' }}>

        <div style={{ marginBottom: '40px' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '8px' }}>Employer Portal</p>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '300', color: 'var(--deep-navy)' }}>
            Account Setup
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Complete these three steps to start posting jobs and connecting with nurses.
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
          {steps.map((s, i) => (
            <div key={s.num} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '14px', fontWeight: '500', flexShrink: 0,
                  background: stage > s.num ? 'var(--success)' : stage === s.num ? 'var(--deep-navy)' : 'transparent',
                  color: stage >= s.num ? 'white' : 'var(--text-muted)',
                  border: stage < s.num ? '1px solid var(--border)' : 'none'
                }}>
                  {stage > s.num ? '✓' : s.num}
                </div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: stage >= s.num ? 'var(--deep-navy)' : 'var(--text-muted)', fontWeight: stage === s.num ? '500' : '400', whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: '1px', background: stage > s.num ? 'var(--success)' : 'var(--border)', margin: '0 12px', marginBottom: '22px' }} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ background: 'rgba(180,60,60,0.08)', border: '1px solid rgba(180,60,60,0.25)', borderRadius: '2px', padding: '12px 16px', marginBottom: '24px', fontSize: '13px', color: '#B43C3C' }}>
            {error}
          </div>
        )}

        {/* ── STAGE 1: Org Profile ── */}
        {stage === 1 && (
          <form onSubmit={submitStage1}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '32px' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                Tell us about your organization
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Organization Name *</label>
                  <input name="org_name" value={form.org_name} onChange={handle} required style={inputStyle} placeholder="St. Mary's Medical Center" />
                </div>
                <div>
                  <label style={labelStyle}>Organization Type *</label>
                  <select name="org_type" value={form.org_type} onChange={handle} required style={inputStyle}>
                    <option value="">Select type...</option>
                    {ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>Contact Name *</label>
                    <input name="contact_name" value={form.contact_name} onChange={handle} required style={inputStyle} placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label style={labelStyle}>Contact Title</label>
                    <input name="contact_title" value={form.contact_title} onChange={handle} style={inputStyle} placeholder="Chief Nursing Officer" />
                  </div>
                </div>
                <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>City *</label>
                    <input name="city" value={form.city} onChange={handle} required style={inputStyle} placeholder="Chicago" />
                  </div>
                  <div>
                    <label style={labelStyle}>State *</label>
                    <select name="state" value={form.state} onChange={handle} required style={inputStyle}>
                      <option value="">Select...</option>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Number of Beds</label>
                  <input name="bed_count" type="number" min="1" value={form.bed_count} onChange={handle} style={inputStyle} placeholder="e.g. 250" />
                </div>
                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea name="description" value={form.description} onChange={handle} rows={3} placeholder="Brief overview of your organization..." style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="submit" disabled={saving}
                style={{ padding: '12px 32px', background: saving ? 'var(--text-muted)' : 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save & Continue →'}
              </button>
            </div>
          </form>
        )}

        {/* ── STAGE 2: Under Review ── */}
        {stage === 2 && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(126,181,200,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '28px' }}>
              📋
            </div>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '12px' }}>
              Sign Your Agreement
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 24px', lineHeight: '1.7' }}>
              {contractRecord?.status === 'sent'
                ? <>We emailed your staffing agreement to <strong>{user?.email}</strong>. Please review and sign it there to continue onboarding.</>
                : <>Your organization profile has been received. Kundayi is preparing your agreement now, and it will be sent to <strong>{user?.email}</strong>.</>}
            </p>
            <div style={{ background: 'rgba(44,62,80,0.04)', border: '1px solid var(--border)', borderRadius: '4px', padding: '16px', maxWidth: '440px', margin: '0 auto 18px', textAlign: 'left' }}>
              <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>Contract Status</p>
              <p style={{ fontSize: '14px', color: 'var(--deep-navy)', marginBottom: '4px' }}>
                {contractRecord?.status === 'sent' ? 'Sent - awaiting your signature' : 'Pending send from Seraphyn team'}
              </p>
              {contractRecord?.sent_at && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Sent {new Date(contractRecord.sent_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
            <div style={{ background: 'rgba(126,181,200,0.08)', border: '1px solid rgba(126,181,200,0.3)', borderRadius: '4px', padding: '16px', maxWidth: '400px', margin: '0 auto' }}>
              <p style={{ fontSize: '13px', color: 'var(--sky-blue)' }}>
                Once signed, this page updates automatically and moves you to final approval.
              </p>
            </div>
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Questions? Contact us at{' '}
                <a href="mailto:support@seraphyncare.com" style={{ color: 'var(--sky-blue)' }}>support@seraphyncare.com</a>
              </p>
            </div>
          </div>
        )}

        {/* ── STAGE 3: Pending Approval ── */}
        {stage === 3 && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(45,122,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '28px' }}>
              🎉
            </div>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '12px' }}>
              {empProfile?.approved_at ? 'Account Approved!' : 'Pending Final Approval'}
            </h2>
            {empProfile?.approved_at ? (
              <>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 28px', lineHeight: '1.7' }}>
                  Your account is fully approved. You can now post jobs, browse nurse profiles, and start hiring.
                </p>
                <button onClick={() => navigate('/employer/dashboard')}
                  style={{ padding: '12px 32px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                  Go to Dashboard →
                </button>
              </>
            ) : (
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto', lineHeight: '1.7' }}>
                Your signed agreement is in and our team is completing the final review. You'll receive an email confirmation once approved.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
