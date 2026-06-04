import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Navbar from '../../components/Navbar'
import { US_STATES } from '../../lib/constants'
import { apiRequest } from '../../lib/api'
import { AGREEMENT_ORDER, AGREEMENT_TEMPLATES } from '../../lib/agreementTemplates'

const ORG_TYPES = [
  'Hospital', 'Urgent Care', 'Outpatient Clinic', 'Long-Term Care Facility',
  'Home Health Agency', 'Rehabilitation Center', 'Surgical Center',
  'Behavioral Health', 'School Health', 'Other'
]

const ONBOARDING_SECTIONS = [
  {
    title: 'Welcome to Seraphyn Care Solutions',
    body: 'We are honored to partner with you in delivering high-quality, reliable staffing solutions. Our goal is to make staffing seamless, compliant, and efficient so your organization can stay focused on patient care.'
  },
  {
    title: 'Review and Sign Your Agreements',
    body: 'Two agreements are required to activate your account: the Direct Hire Agreement and the Per Diem Staffing Agreement. Completing both lets Seraphyn support your organization across permanent and flexible staffing needs.'
  },
  {
    title: 'Welcome Kit Overview',
    body: 'Back Office Staffing Solutions (BOSS) serves as the Employer of Record for temporary staff and handles payroll, tax compliance, insurance coverage, timekeeping, and invoicing.'
  },
  {
    title: 'What Happens Next',
    body: 'After both agreements are signed, your account moves to final approval. Once approved, you can post jobs, review candidates, and begin staffing through the portal.'
  }
]

const AGREEMENT_CARDS = AGREEMENT_ORDER.map((documentType) => ({
  documentType,
  title: AGREEMENT_TEMPLATES[documentType].title
}))

function matchesAgreementRecord(record, documentType) {
  if (!record) return false
  return record.document_type === documentType || record.template_url === `portal-template:${documentType}`
}

function createSignatureDataUrl(name) {
  if (typeof document === 'undefined') return ''

  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 220
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#1F3145'
  ctx.textBaseline = 'middle'
  ctx.font = '72px "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive'
  ctx.fillText(name, 40, 118)

  return canvas.toDataURL('image/png')
}

export default function EmployerOnboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const agreementScrollRef = useRef(null)

  const [empProfile, setEmpProfile] = useState(null)
  const [contractRecords, setContractRecords] = useState([])
  const [stage, setStage] = useState(1)
  const [form, setForm] = useState({
    org_name: '', org_type: '', contact_name: '', contact_title: '',
    city: '', state: '', bed_count: '', description: ''
  })
  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState('')
  const [syncingContact, setSyncingContact] = useState(false)
  const [signatureConsent, setSignatureConsent] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signerTitle, setSignerTitle] = useState('')
  const [activeAgreement, setActiveAgreement] = useState(null)
  const [reviewReady, setReviewReady] = useState(false)
  const [reviewedAgreements, setReviewedAgreements] = useState({})
  const [agreementFields, setAgreementFields] = useState(() => ({
    direct_hire: {
      organizationName: '',
      organizationType: '',
      contactName: '',
      contactTitle: '',
      contactEmail: '',
      signerName: '',
      signerTitle: '',
      signerInitials: '',
      effectiveDate: '',
      acknowledgements: []
    },
    staffing_boss: {
      organizationName: '',
      organizationType: '',
      contactName: '',
      contactTitle: '',
      contactEmail: '',
      signerName: '',
      signerTitle: '',
      signerInitials: '',
      effectiveDate: '',
      acknowledgements: []
    }
  }))

  const allAgreementsReviewed = useMemo(
    () => AGREEMENT_CARDS.every((agreement) => reviewedAgreements[agreement.documentType]),
    [reviewedAgreements]
  )

  useEffect(() => {
    if (user) void loadProfile()
  }, [user])

  useEffect(() => {
    if (!user || stage !== 2) return

    const interval = setInterval(() => {
      void loadProfile()
    }, 5000)

    return () => clearInterval(interval)
  }, [user, stage])

  useEffect(() => {
    setAgreementFields((previous) => {
      const next = { ...previous }
      for (const agreement of AGREEMENT_CARDS) {
        next[agreement.documentType] = {
          ...previous[agreement.documentType],
          signerName,
          signerTitle
        }
      }
      return next
    })
  }, [signerName, signerTitle])

  async function loadProfile() {
    const { data } = await supabase
      .from('employer_profiles')
      .select('*, contracts(*)')
      .eq('user_id', user.id)
      .single()

    const metadata = user.user_metadata || {}
    const source = data || {
      org_name: metadata.org_name || '',
      org_type: metadata.org_type || '',
      contact_name: metadata.contact_name || metadata.full_name || '',
      state: metadata.state || '',
      onboarding_stage: metadata.onboarding_stage || 'profile'
    }

    const records = source.contracts || []
    setEmpProfile(source)
    setContractRecords(records)
    setReviewedAgreements((previous) => {
      const next = { ...previous }
      for (const agreement of AGREEMENT_CARDS) {
        if (records.some((record) => record.document_type === agreement.documentType && record.status === 'signed')) {
          next[agreement.documentType] = true
        }
      }
      return next
    })

    const STAGE_MAP = { profile: 1, contract: 2, approved: 3 }
    const nextStage = source.onboarding_stage === 'approved'
      ? 3
      : source.contract_signed
        ? 3
        : STAGE_MAP[source.onboarding_stage] || 1

    setStage((previousStage) => Math.max(previousStage, nextStage))
    setForm({
      org_name: source.org_name || '',
      org_type: source.org_type || '',
      contact_name: source.contact_name || '',
      contact_title: source.contact_title || '',
      city: source.city || '',
      state: source.state || '',
      bed_count: source.bed_count || '',
      description: source.description || ''
    })
    setSignerName(source.contact_name || metadata.contact_name || metadata.full_name || '')
    setSignerTitle(source.contact_title || '')
    setAgreementFields((previous) => {
      const contactEmail = user?.email || ''
      const effectiveDate = new Date().toISOString().slice(0, 10)
      const next = { ...previous }
      for (const agreement of AGREEMENT_CARDS) {
        const current = previous[agreement.documentType] || {}
        next[agreement.documentType] = {
          organizationName: current.organizationName || source.org_name || '',
          organizationType: current.organizationType || source.org_type || '',
          contactName: current.contactName || source.contact_name || '',
          contactTitle: current.contactTitle || source.contact_title || '',
          contactEmail: current.contactEmail || contactEmail,
          signerName: current.signerName || source.contact_name || metadata.contact_name || metadata.full_name || '',
          signerTitle: current.signerTitle || source.contact_title || '',
          signerInitials: current.signerInitials || '',
          effectiveDate: current.effectiveDate || effectiveDate,
          acknowledgements: current.acknowledgements || []
        }
      }
      return next
    })

    if (data && !data.ghl_contact_id && !syncingContact) {
      void syncContact()
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
      const result = await apiRequest('/api/employers/onboarding/profile', {
        method: 'POST',
        body: {
          ...form,
          bed_count: form.bed_count ? parseInt(form.bed_count, 10) : null
        }
      })

      setEmpProfile(result.employer)
      setContractRecords(result.employer?.contracts || [])
      setSignerName(result.employer?.contact_name || form.contact_name || '')
      setSignerTitle(result.employer?.contact_title || form.contact_title || '')
      setStage(2)

      void syncContact()
      void apiRequest('/api/integrations/events/self', {
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
      }).catch((forwardError) => {
        console.error('Employer signup event forwarding failed:', forwardError.message)
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function openAgreement(agreement) {
    setReviewReady(false)
    setError('')
    setActiveAgreement({ ...agreement })
  }

  function closeAgreementModal() {
    setActiveAgreement(null)
    setReviewReady(false)
  }

  function onAgreementScroll(event) {
    const target = event.currentTarget
    const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 16
    if (atBottom) {
      setReviewReady(true)
    }
  }

  function markAgreementReviewed() {
    if (!activeAgreement || !reviewReady) return

    const fields = agreementFields[activeAgreement.documentType]
    const requiredFieldValues = [
      fields?.organizationName,
      fields?.organizationType,
      fields?.contactName,
      fields?.contactEmail,
      fields?.signerName,
      fields?.signerInitials,
      fields?.effectiveDate
    ]

    const template = AGREEMENT_TEMPLATES[activeAgreement.documentType]
    const allAcknowledged = (template?.acknowledgements || []).every((_, index) => fields?.acknowledgements?.includes(index))

    if (requiredFieldValues.some((value) => !String(value || '').trim()) || !allAcknowledged) {
      setError(`Complete all required fields and acknowledgements for ${template?.title || 'this agreement'} before marking it reviewed.`)
      return
    }

    setReviewedAgreements((previous) => ({
      ...previous,
      [activeAgreement.documentType]: true
    }))
    closeAgreementModal()
  }

  function agreementIsComplete(documentType) {
    const fields = agreementFields[documentType] || {}
    const requiredFieldValues = [
      fields.organizationName,
      fields.organizationType,
      fields.contactName,
      fields.contactEmail,
      fields.signerName,
      fields.signerInitials,
      fields.effectiveDate
    ]
    const template = AGREEMENT_TEMPLATES[documentType]
    const allAcknowledged = (template?.acknowledgements || []).every((_, index) => fields?.acknowledgements?.includes(index))

    return !requiredFieldValues.some((value) => !String(value || '').trim()) && allAcknowledged
  }

  function toggleInlineReviewed(documentType, checked) {
    if (checked && !agreementIsComplete(documentType)) {
      const template = AGREEMENT_TEMPLATES[documentType]
      setError(`Complete all required fields and acknowledgements for ${template?.title || 'this agreement'} before marking it reviewed.`)
      return
    }

    setError('')
    setReviewedAgreements((previous) => ({
      ...previous,
      [documentType]: checked
    }))
  }

  async function downloadContract(contractId) {
    try {
      const data = await apiRequest(`/api/contracts/${contractId}/download`)
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      }
    } catch (downloadError) {
      setError(downloadError.message)
    }
  }

  async function signContracts() {
    setError('')
    if (!allAgreementsReviewed) {
      setError('Review both agreements to the end before signing.')
      return
    }
    if (!signatureConsent) {
      setError('You must consent to electronic signing before continuing.')
      return
    }
    if (!signerName.trim()) {
      setError('Signer name is required.')
      return
    }

    for (const agreement of AGREEMENT_CARDS) {
      const fields = agreementFields[agreement.documentType] || {}
      const requiredFieldValues = [
        fields.organizationName,
        fields.organizationType,
        fields.contactName,
        fields.contactEmail,
        fields.signerName,
        fields.signerInitials,
        fields.effectiveDate
      ]
      const template = AGREEMENT_TEMPLATES[agreement.documentType]
      const allAcknowledged = (template?.acknowledgements || []).every((_, index) => fields?.acknowledgements?.includes(index))
      if (requiredFieldValues.some((value) => !String(value || '').trim()) || !allAcknowledged) {
        setError(`Complete all required fields in ${template?.title || 'each agreement'} before signing.`)
        return
      }
    }

    const signatureDataUrl = createSignatureDataUrl(signerName.trim())
    if (!signatureDataUrl) {
      setError('Failed to generate electronic signature preview.')
      return
    }

    setSigning(true)
    try {
      await apiRequest('/api/employers/contracts/sign', {
        method: 'POST',
        body: {
          signerName: signerName.trim(),
          signerTitle: signerTitle.trim(),
          signatureDataUrl,
          consentAccepted: true,
          agreementFields
        }
      })

      await loadProfile()
      setStage(3)
    } catch (signError) {
      setError(signError.message)
    } finally {
      setSigning(false)
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
    { num: 3, label: 'Pending Approval' }
  ]

  function updateAgreementField(documentType, field, value) {
    setAgreementFields((previous) => ({
      ...previous,
      [documentType]: {
        ...previous[documentType],
        [field]: value
      }
    }))
  }

  function toggleAgreementAcknowledgement(documentType, index) {
    setAgreementFields((previous) => {
      const current = previous[documentType] || {}
      const currentAcks = current.acknowledgements || []
      const nextAcks = currentAcks.includes(index)
        ? currentAcks.filter((value) => value !== index)
        : [...currentAcks, index]

      return {
        ...previous,
        [documentType]: {
          ...current,
          acknowledgements: nextAcks
        }
      }
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '100px 24px 60px' }}>
        <div style={{ marginBottom: '40px' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '8px' }}>Employer Portal</p>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '300', color: 'var(--deep-navy)' }}>
            Account Setup
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Complete these three steps to start posting jobs and connecting with nurses.
          </p>
        </div>

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
                    {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
                      {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
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

        {stage === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '32px' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '18px' }}>
                Client Onboarding
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {ONBOARDING_SECTIONS.map((section) => (
                  <div key={section.title}>
                    <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warm-gold)', marginBottom: '6px' }}>
                      {section.title}
                    </p>
                    <p style={{ fontSize: '14px', color: 'var(--deep-navy)', lineHeight: '1.7' }}>{section.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '32px' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '18px' }}>
                Review and Sign Both Agreements
              </h2>
              <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
                {AGREEMENT_CARDS.map((agreement) => {
                  const signedRecord = contractRecords.find((record) => matchesAgreementRecord(record, agreement.documentType))
                  const reviewed = reviewedAgreements[agreement.documentType]
                  return (
                    <div key={agreement.documentType} style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                        <div>
                          <p style={{ fontSize: '14px', color: 'var(--deep-navy)', fontWeight: '500', marginBottom: '4px' }}>{agreement.title}</p>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {signedRecord?.status === 'signed'
                              ? `Signed ${new Date(signedRecord.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                              : reviewed
                                ? 'Reviewed and ready for electronic signature'
                                : 'Open the agreement, complete all required fields, and scroll to the end to unlock signing'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {reviewed && !signedRecord?.id && (
                            <span style={{ padding: '5px 10px', background: 'rgba(45,122,79,0.12)', color: 'var(--success)', borderRadius: '999px', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '600' }}>
                              Reviewed
                            </span>
                          )}
                          <a
                            href={signedRecord?.id ? undefined : `#agreement-${agreement.documentType}`}
                            onClick={(event) => {
                              if (signedRecord?.id) {
                                event.preventDefault()
                                downloadContract(signedRecord.id)
                              }
                            }}
                            style={{ padding: '8px 14px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', background: 'transparent', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}
                          >
                            {signedRecord?.id ? 'View Signed Copy' : 'Open Agreement'}
                          </a>
                          {signedRecord?.id && (
                            <button type="button" onClick={() => downloadContract(signedRecord.id)}
                              style={{ padding: '8px 14px', border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'transparent', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                              Download
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginBottom: '28px' }}>
                {AGREEMENT_CARDS.map((agreement) => {
                  const template = AGREEMENT_TEMPLATES[agreement.documentType]
                  const fields = agreementFields[agreement.documentType] || {}
                  const reviewed = Boolean(reviewedAgreements[agreement.documentType])

                  return (
                    <section
                      key={`inline-${agreement.documentType}`}
                      id={`agreement-${agreement.documentType}`}
                      style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '24px', background: 'var(--warm-white)', scrollMarginTop: '96px' }}
                    >
                      <p style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '8px' }}>
                        Agreement Review
                      </p>
                      <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '30px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '6px' }}>
                        {template.title}
                      </h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>{template.subtitle}</p>
                      <p style={{ fontSize: '14px', color: 'var(--deep-navy)', lineHeight: '1.8', marginBottom: '24px' }}>{template.intro}</p>

                      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div>
                          <label style={labelStyle}>Organization Name *</label>
                          <input value={fields.organizationName || ''} onChange={(e) => updateAgreementField(agreement.documentType, 'organizationName', e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Organization Type *</label>
                          <input value={fields.organizationType || ''} onChange={(e) => updateAgreementField(agreement.documentType, 'organizationType', e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Contact Name *</label>
                          <input value={fields.contactName || ''} onChange={(e) => updateAgreementField(agreement.documentType, 'contactName', e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Contact Title</label>
                          <input value={fields.contactTitle || ''} onChange={(e) => updateAgreementField(agreement.documentType, 'contactTitle', e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Contact Email *</label>
                          <input value={fields.contactEmail || ''} onChange={(e) => updateAgreementField(agreement.documentType, 'contactEmail', e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Effective Date *</label>
                          <input type="date" value={fields.effectiveDate || ''} onChange={(e) => updateAgreementField(agreement.documentType, 'effectiveDate', e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Signer Name *</label>
                          <input value={fields.signerName || ''} onChange={(e) => updateAgreementField(agreement.documentType, 'signerName', e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Signer Title</label>
                          <input value={fields.signerTitle || ''} onChange={(e) => updateAgreementField(agreement.documentType, 'signerTitle', e.target.value)} style={inputStyle} />
                        </div>
                      </div>

                      {template.sections.map((section) => (
                        <div key={`${agreement.documentType}-${section.heading}`} style={{ marginBottom: '22px' }}>
                          <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warm-gold)', marginBottom: '8px' }}>
                            {section.heading}
                          </p>
                          {section.paragraphs.map((paragraph) => (
                            <p key={paragraph} style={{ fontSize: '14px', color: 'var(--deep-navy)', lineHeight: '1.8', marginBottom: '12px' }}>
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      ))}

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '24px' }}>
                        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warm-gold)', marginBottom: '10px' }}>
                          Required Acknowledgements
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                          {template.acknowledgements.map((item, index) => (
                            <label key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--deep-navy)', lineHeight: '1.6' }}>
                              <input
                                type="checkbox"
                                checked={(fields.acknowledgements || []).includes(index)}
                                onChange={() => toggleAgreementAcknowledgement(agreement.documentType, index)}
                              />
                              {item}
                            </label>
                          ))}
                        </div>

                        <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                          <div>
                            <label style={labelStyle}>Signer Initials *</label>
                            <input
                              value={fields.signerInitials || ''}
                              onChange={(e) => updateAgreementField(agreement.documentType, 'signerInitials', e.target.value.toUpperCase().slice(0, 4))}
                              style={inputStyle}
                              placeholder="DR"
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Signature Preview</label>
                            <div style={{ ...inputStyle, minHeight: '52px', display: 'flex', alignItems: 'center', fontFamily: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive', fontSize: '34px' }}>
                              {fields.signerName || signerName || 'Signer name'}
                            </div>
                          </div>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--deep-navy)', lineHeight: '1.6' }}>
                          <input
                            type="checkbox"
                            checked={reviewed}
                            onChange={(e) => toggleInlineReviewed(agreement.documentType, e.target.checked)}
                          />
                          I have read this agreement to the end, completed the required fields, and authorize it for electronic signing.
                        </label>
                      </div>
                    </section>
                  )
                })}
              </div>

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Signer Name *</label>
                  <input value={signerName} onChange={(e) => setSignerName(e.target.value)} style={inputStyle} placeholder="Authorized signer" />
                </div>
                <div>
                  <label style={labelStyle}>Signer Title</label>
                  <input value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} style={inputStyle} placeholder="Chief Nursing Officer" />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Electronic Signature *</label>
                <div style={{ border: '1px solid var(--border)', borderRadius: '4px', background: 'white', padding: '18px 20px', minHeight: '132px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                      Your signature will be generated automatically from the signer name above.
                    </p>
                    <div style={{ minHeight: '62px', display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        fontFamily: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive',
                        fontSize: signerName.trim() ? '54px' : '28px',
                        color: signerName.trim() ? 'var(--deep-navy)' : 'var(--text-muted)',
                        lineHeight: 1.1
                      }}>
                        {signerName.trim() || 'Signature preview'}
                      </span>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    This signature is applied to both agreements and included in the signed PDF copies.
                  </div>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--deep-navy)', lineHeight: '1.6', marginBottom: '20px' }}>
                <input type="checkbox" checked={signatureConsent} onChange={(e) => setSignatureConsent(e.target.checked)} />
                I consent to signing the Direct Hire Agreement and Per Diem Staffing Agreement electronically in the Seraphyn portal.
              </label>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {allAgreementsReviewed
                    ? `Signed copies of both agreements will be emailed to ${user?.email} and copied to info@seraphyncare.com.`
                    : 'Complete both agreement forms and review them to the end before signing is unlocked.'}
                </p>
                <button type="button" onClick={signContracts} disabled={signing || !allAgreementsReviewed}
                  style={{ padding: '12px 28px', background: signing || !allAgreementsReviewed ? 'var(--text-muted)' : 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500', cursor: signing || !allAgreementsReviewed ? 'not-allowed' : 'pointer' }}>
                  {signing ? 'Signing...' : 'Sign Both Agreements →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {stage === 3 && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(45,122,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '28px' }}>
              🎉
            </div>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '26px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '12px' }}>
              {empProfile?.approved_at ? 'Account Approved!' : 'Pending Final Approval'}
            </h2>

            <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 24px', lineHeight: '1.7' }}>
              {empProfile?.approved_at
                ? 'Your account is fully approved. You can now post jobs, browse nurse profiles, and start hiring.'
                : 'Your signed agreements are in and our team is completing the final review. You will receive an email confirmation once approved.'}
            </p>

            {contractRecords.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '520px', margin: '0 auto 24px', textAlign: 'left' }}>
                {contractRecords.map((contract) => (
                  <div key={contract.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--warm-white)' }}>
                    <div>
                      <p style={{ fontSize: '13px', color: 'var(--deep-navy)', fontWeight: '500' }}>{contract.title}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Signed {contract.signed_at ? new Date(contract.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'recently'}
                      </p>
                    </div>
                    <button type="button" onClick={() => downloadContract(contract.id)}
                      style={{ padding: '8px 14px', border: '1px solid var(--sky-blue)', color: 'var(--sky-blue)', background: 'transparent', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!empProfile?.approved_at && (
              <div style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => navigate('/employer/dashboard')}
                  style={{ padding: '12px 32px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}
                >
                  Open Dashboard {'->'}
                </button>
              </div>
            )}

            {empProfile?.approved_at && (
              <button onClick={() => navigate('/employer/dashboard')}
                style={{ padding: '12px 32px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                Go to Dashboard →
              </button>
            )}
          </div>
        )}
      </div>

      {activeAgreement && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(18,31,44,0.72)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ width: 'min(960px, 100%)', maxHeight: '90vh', background: 'white', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 24px 60px rgba(18,31,44,0.22)' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '4px' }}>
                  Agreement Review
                </p>
                <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '28px', fontWeight: '500', color: 'var(--deep-navy)' }}>
                  {activeAgreement.title}
                </h3>
              </div>
              <button type="button" onClick={closeAgreementModal}
                style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', borderRadius: '2px', padding: '8px 12px', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Close
              </button>
            </div>

            <div
              ref={agreementScrollRef}
              onScroll={onAgreementScroll}
              style={{ maxHeight: 'calc(90vh - 168px)', overflowY: 'auto', padding: '20px', background: '#F8F7F3' }}
            >
              {(() => {
                const template = AGREEMENT_TEMPLATES[activeAgreement.documentType]
                const fields = agreementFields[activeAgreement.documentType] || {}
                return (
                  <div style={{ maxWidth: '820px', margin: '0 auto', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px' }}>
                    <p style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '8px' }}>
                      Employer Agreement
                    </p>
                    <h4 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '34px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '6px' }}>
                      {template.title}
                    </h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>{template.subtitle}</p>
                    <p style={{ fontSize: '14px', color: 'var(--deep-navy)', lineHeight: '1.8', marginBottom: '26px' }}>{template.intro}</p>

                    <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                      <div>
                        <label style={labelStyle}>Organization Name *</label>
                        <input value={fields.organizationName || ''} onChange={(e) => updateAgreementField(activeAgreement.documentType, 'organizationName', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Organization Type *</label>
                        <input value={fields.organizationType || ''} onChange={(e) => updateAgreementField(activeAgreement.documentType, 'organizationType', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Contact Name *</label>
                        <input value={fields.contactName || ''} onChange={(e) => updateAgreementField(activeAgreement.documentType, 'contactName', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Contact Title</label>
                        <input value={fields.contactTitle || ''} onChange={(e) => updateAgreementField(activeAgreement.documentType, 'contactTitle', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Contact Email *</label>
                        <input value={fields.contactEmail || ''} onChange={(e) => updateAgreementField(activeAgreement.documentType, 'contactEmail', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Effective Date *</label>
                        <input type="date" value={fields.effectiveDate || ''} onChange={(e) => updateAgreementField(activeAgreement.documentType, 'effectiveDate', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Signer Name *</label>
                        <input value={fields.signerName || ''} onChange={(e) => updateAgreementField(activeAgreement.documentType, 'signerName', e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Signer Title</label>
                        <input value={fields.signerTitle || ''} onChange={(e) => updateAgreementField(activeAgreement.documentType, 'signerTitle', e.target.value)} style={inputStyle} />
                      </div>
                    </div>

                    {template.sections.map((section) => (
                      <div key={section.heading} style={{ marginBottom: '22px' }}>
                        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warm-gold)', marginBottom: '8px' }}>
                          {section.heading}
                        </p>
                        {section.paragraphs.map((paragraph) => (
                          <p key={paragraph} style={{ fontSize: '14px', color: 'var(--deep-navy)', lineHeight: '1.8', marginBottom: '12px' }}>
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    ))}

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '24px' }}>
                      <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--warm-gold)', marginBottom: '10px' }}>
                        Required Acknowledgements
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                        {template.acknowledgements.map((item, index) => (
                          <label key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--deep-navy)', lineHeight: '1.6' }}>
                            <input
                              type="checkbox"
                              checked={(fields.acknowledgements || []).includes(index)}
                              onChange={() => toggleAgreementAcknowledgement(activeAgreement.documentType, index)}
                            />
                            {item}
                          </label>
                        ))}
                      </div>

                      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={labelStyle}>Signer Initials *</label>
                          <input
                            value={fields.signerInitials || ''}
                            onChange={(e) => updateAgreementField(activeAgreement.documentType, 'signerInitials', e.target.value.toUpperCase().slice(0, 4))}
                            style={inputStyle}
                            placeholder="KR"
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Signature Preview</label>
                          <div style={{ ...inputStyle, minHeight: '52px', display: 'flex', alignItems: 'center', fontFamily: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive', fontSize: '34px' }}>
                            {fields.signerName || signerName || 'Signer name'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '12px', color: reviewReady ? 'var(--success)' : 'var(--text-muted)' }}>
                {reviewReady
                  ? 'You reached the end of this agreement.'
                  : 'Scroll to the end of the document to unlock review completion.'}
              </p>
              <button
                type="button"
                disabled={!reviewReady}
                onClick={markAgreementReviewed}
                style={{ padding: '10px 18px', background: reviewReady ? 'var(--deep-navy)' : 'var(--text-muted)', color: 'white', border: 'none', borderRadius: '2px', cursor: reviewReady ? 'pointer' : 'not-allowed', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500' }}
              >
                Mark as Reviewed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
