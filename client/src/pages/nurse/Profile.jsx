import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Navbar from '../../components/Navbar'
import { NURSE_AVAILABILITY_OPTIONS, NURSE_SHIFT_PREFERENCES, SPECIALTIES, US_STATES } from '../../lib/constants'
import { apiRequest } from '../../lib/api'
import { formatHourly } from '../../lib/format'

const CERTIFICATIONS = ['BLS','ACLS','PALS','TNCC','CCRN','CEN','CNOR','NRP','NIHSS','AWHONN']

const SHIFT_VALUES = new Set(NURSE_SHIFT_PREFERENCES.map((option) => option.value))
const AVAILABILITY_VALUES = new Set(NURSE_AVAILABILITY_OPTIONS.map((option) => option.value))

// Anything that is not a live enum value (e.g. a legacy label) is treated as
// unset rather than sent to Postgres and rejected.
function normalizeShiftPreference(value) {
  return SHIFT_VALUES.has(value) ? value : ''
}

function normalizeAvailability(value) {
  return AVAILABILITY_VALUES.has(value) ? value : ''
}

export default function NurseProfile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const resumeRef = useRef()
  const licenseRef = useRef()
  const certificationRef = useRef()

  const [form, setForm] = useState({
    first_name: '', last_name: '', specialty: '', license_number: '',
    license_state: '', years_experience: '', shift_preference: '',
    availability: '', bio: '', certifications: []
  })
  const [profileId, setProfileId] = useState('')
  const [resumeUrl, setResumeUrl] = useState('')
  const [licenseUrl, setLicenseUrl] = useState('')
  const [resumePath, setResumePath] = useState('')
  const [licensePath, setLicensePath] = useState('')
  const [certificationDocs, setCertificationDocs] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [uploadingLicense, setUploadingLicense] = useState(false)
  const [uploadingCertification, setUploadingCertification] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [prefilledFromLead, setPrefilledFromLead] = useState(false)

  // Rate lives in its own table behind the API, so it gets its own state and
  // its own save action rather than joining the profile upsert below.
  const [rate, setRate] = useState(null)
  const [rateInput, setRateInput] = useState('')
  const [rateSaving, setRateSaving] = useState(false)
  const [rateSaved, setRateSaved] = useState(false)
  const [rateError, setRateError] = useState('')
  const [rateAvailable, setRateAvailable] = useState(true)

  useEffect(() => {
    if (user) loadProfile()
  }, [user])

  async function loadProfile() {
    const bootstrap = await apiRequest('/api/nurses/self/bootstrap', { method: 'POST' })
    const data = bootstrap?.profile || null
    const metadata = user.user_metadata || {}
    const source = data || {}

    setProfileId(source.id || '')
    setPrefilledFromLead(Boolean(bootstrap?.prefilledFromLead))
    setResumePath(source.resume_url || '')
    setLicensePath(source.license_url || '')
    setResumeUrl(bootstrap?.fileUrls?.resume || '')
    setLicenseUrl(bootstrap?.fileUrls?.license || '')
    setForm({
      first_name: source.first_name || metadata.first_name || '',
      last_name: source.last_name || metadata.last_name || '',
      specialty: source.specialty || metadata.specialty || '',
      license_number: source.license_number || '',
      license_state: source.license_state || metadata.license_state || '',
      years_experience: source.years_experience || metadata.years_experience || '',
      shift_preference: normalizeShiftPreference(source.shift_preference),
      availability: normalizeAvailability(source.availability || ''),
      bio: source.bio || '',
      certifications: source.certifications || []
    })

    if (source.id) {
      try {
        const docs = await apiRequest(`/api/nurses/${source.id}/documents`)
        setCertificationDocs(docs || [])
      } catch (docsError) {
        if (!/Complete employer onboarding/i.test(docsError.message)) {
          console.error('Failed to load certification documents:', docsError.message)
        }
      }
    }

    try {
      const rateData = await apiRequest('/api/nurses/self/rate')
      setRate(rateData)
      setRateInput(rateData?.desired_hourly != null ? String(rateData.desired_hourly) : '')
      setRateAvailable(true)
    } catch (rateLoadError) {
      // Never let the rate section break the rest of the profile page.
      console.error('Failed to load rate:', rateLoadError.message)
      setRateAvailable(false)
    }
  }

  async function saveRate() {
    setRateError('')
    setRateSaved(false)

    const trimmed = String(rateInput).trim()
    if (trimmed !== '') {
      const parsed = Number(trimmed)
      const min = rate?.min_rate ?? 15
      const max = rate?.max_rate ?? 400
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setRateError('Enter a valid hourly rate.')
        return
      }
      if (parsed < min) {
        setRateError(`Rate must be at least $${min}/hr.`)
        return
      }
      if (parsed > max) {
        setRateError(`Rate must be $${max}/hr or less.`)
        return
      }
    }

    setRateSaving(true)
    try {
      const updated = await apiRequest('/api/nurses/self/rate', {
        method: 'PUT',
        body: { hourly_rate: trimmed === '' ? null : Number(trimmed) }
      })
      setRate(updated)
      setRateInput(updated?.desired_hourly != null ? String(updated.desired_hourly) : '')
      setRateSaved(true)
      setTimeout(() => setRateSaved(false), 2500)
    } catch (saveError) {
      setRateError(saveError.message)
    } finally {
      setRateSaving(false)
    }
  }

  function handle(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function toggleCert(cert) {
    const certs = form.certifications.includes(cert)
      ? form.certifications.filter(c => c !== cert)
      : [...form.certifications, cert]
    setForm({ ...form, certifications: certs })
  }

  async function uploadFile(file, kind, setter, setUrl, setPath) {
    setter(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const data = await apiRequest(`/api/nurses/self/files/${kind}`, {
        method: 'POST',
        body: formData
      })
      setUrl(data.downloadUrl || '')
      setPath(data.filePath || '')
      setProfileId(data.profile?.id || profileId)
      return data
    } catch (err) {
      setError(`Upload failed: ${err.message}`)
      return null
    } finally {
      setter(false)
    }
  }

  async function handleResumeUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const upload = await uploadFile(file, 'resume', setUploadingResume, setResumeUrl, setResumePath)
    if (upload?.filePath) {
      try {
        await apiRequest('/api/integrations/events/self', {
          method: 'POST',
          body: {
            event: 'nurse.document_uploaded',
            payload: {
              documentType: 'resume',
              bucket: 'resumes',
              fileUrl: upload.filePath
            }
          }
        })
        await apiRequest('/api/integrations/nurse/profile-completion', {
          method: 'POST'
        })
      } catch (eventError) {
        console.error('Resume upload event failed:', eventError.message)
      }
    }
  }

  async function handleLicenseUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const upload = await uploadFile(file, 'license', setUploadingLicense, setLicenseUrl, setLicensePath)
    if (upload?.filePath) {
      try {
        await apiRequest('/api/integrations/events/self', {
          method: 'POST',
          body: {
            event: 'nurse.document_uploaded',
            payload: {
              documentType: 'license',
              bucket: 'licenses',
              fileUrl: upload.filePath
            }
          }
        })
        await apiRequest('/api/integrations/nurse/profile-completion', {
          method: 'POST'
        })
      } catch (eventError) {
        console.error('License upload event failed:', eventError.message)
      }
    }
  }

  async function handleCertificationUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingCertification(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name.replace(/\.[^.]+$/, ''))
      const created = await apiRequest('/api/nurses/documents/certifications', {
        method: 'POST',
        body: formData
      })
      setCertificationDocs((current) => [created, ...current])
    } catch (uploadError) {
      setError(`Upload failed: ${uploadError.message}`)
    } finally {
      setUploadingCertification(false)
      if (certificationRef.current) {
        certificationRef.current.value = ''
      }
    }
  }

  async function openCertification(documentId) {
    try {
      const data = await apiRequest(`/api/nurses/documents/${documentId}/download`)
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      }
    } catch (downloadError) {
      setError(downloadError.message)
    }
  }

  async function removeCertification(documentId) {
    try {
      await apiRequest(`/api/nurses/documents/${documentId}`, { method: 'DELETE' })
      setCertificationDocs((current) => current.filter((doc) => doc.id !== documentId))
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const updates = {
        ...form,
        years_experience: form.years_experience ? parseInt(form.years_experience) : null,
        shift_preference: normalizeShiftPreference(form.shift_preference) || null,
        availability: normalizeAvailability(form.availability) || null,
        resume_url: resumePath || undefined,
        license_url: licensePath || undefined,
        updated_at: new Date().toISOString()
      }
      const { error: saveError } = await supabase
        .from('nurse_profiles')
        .upsert({ ...updates, user_id: user.id }, { onConflict: 'user_id' })
      if (saveError) throw saveError
      await apiRequest('/api/integrations/nurse/profile-completion', {
        method: 'POST'
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '100px 24px 60px' }}>

        <div style={{ marginBottom: '36px' }}>
          <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--warm-gold)', marginBottom: '8px' }}>Nurse Portal</p>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: '300', color: 'var(--deep-navy)' }}>
            Edit Your Profile
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>Keep your information current for better job matches.</p>
        </div>

        {prefilledFromLead && (
          <div style={{ background: 'rgba(126,181,200,0.12)', border: '1px solid rgba(126,181,200,0.3)', borderRadius: '2px', padding: '12px 16px', marginBottom: '24px', fontSize: '13px', color: 'var(--deep-navy)', lineHeight: '1.6' }}>
            We've filled in what you told us on your Seraphyn application. Check it over and add anything that's missing.
          </div>
        )}
        {error && (
          <div style={{ background: 'rgba(180,60,60,0.08)', border: '1px solid rgba(180,60,60,0.25)', borderRadius: '2px', padding: '12px 16px', marginBottom: '24px', fontSize: '13px', color: '#B43C3C' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(45,122,79,0.08)', border: '1px solid rgba(45,122,79,0.25)', borderRadius: '2px', padding: '12px 16px', marginBottom: '24px', fontSize: '13px', color: 'var(--success)' }}>
            ✓ Profile saved successfully.
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* Personal Info */}
          <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              Personal Information
            </h2>
            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[['first_name','First Name'],['last_name','Last Name']].map(([name, label]) => (
                <div key={name}>
                  <label style={labelStyle}>{label}</label>
                  <input name={name} value={form[name]} onChange={handle} style={inputStyle} placeholder={label} />
                </div>
              ))}
            </div>
          </section>

          {/* Professional Info */}
          <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              Professional Details
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Specialty</label>
                <select name="specialty" value={form.specialty} onChange={handle} style={inputStyle}>
                  <option value="">Select specialty...</option>
                  {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Years of Experience</label>
                  <input name="years_experience" type="number" min="0" max="50" value={form.years_experience} onChange={handle} style={inputStyle} placeholder="e.g. 5" />
                </div>
                <div>
                  <label style={labelStyle}>Shift Preference</label>
                  <select name="shift_preference" value={form.shift_preference} onChange={handle} style={inputStyle}>
                    <option value="">Select...</option>
                    {NURSE_SHIFT_PREFERENCES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Availability</label>
                <select name="availability" value={form.availability} onChange={handle} style={inputStyle}>
                  <option value="">Select...</option>
                  {NURSE_AVAILABILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Bio / About You</label>
                <textarea name="bio" value={form.bio} onChange={handle} rows={4}
                  placeholder="Brief professional summary highlighting your experience, strengths, and what you're looking for..."
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
          </section>

          {/* Rate. Own save action -- the profile form below writes straight to
              Supabase, while the rate goes through the API. */}
          {rateAvailable && (
          <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              Your Rate
            </h2>

            <label style={labelStyle}>Desired Hourly Rate</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '320px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', pointerEvents: 'none' }}>$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={rate?.min_rate ?? 15}
                  max={rate?.max_rate ?? 400}
                  step="0.50"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: '28px' }}
                  placeholder="e.g. 65.00"
                />
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>/ hour</span>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.6 }}>
              This is your take-home rate for per diem and contract assignments.
              Seraphyn bills facilities separately, so what a facility pays is not
              what you are paid. Leave this blank if you would rather discuss it
              with your coordinator.
            </p>

            {!rate?.effective_hourly && (
              <div style={{ marginTop: '14px', padding: '12px 14px', background: 'rgba(201,169,110,0.12)', border: '1px solid var(--warm-gold)', borderRadius: '2px', fontSize: '12px', color: 'var(--deep-navy)', lineHeight: 1.6 }}>
                You have not set a rate yet. Facilities see &ldquo;Rate on request&rdquo; until you do &mdash;
                setting one gets you into rate-filtered searches.
              </div>
            )}

            {rate?.is_admin_overridden && (
              <div style={{ marginTop: '14px', padding: '12px 14px', background: 'rgba(74,144,164,0.12)', border: '1px solid var(--sky-blue)', borderRadius: '2px', fontSize: '12px', color: 'var(--deep-navy)', lineHeight: 1.6 }}>
                Seraphyn is currently placing you at {formatHourly(rate.effective_hourly)}.
                {rate.desired_hourly != null && ` Your requested rate of ${formatHourly(rate.desired_hourly)} is on file.`}
                {' '}Contact your coordinator to discuss.
              </div>
            )}

            {rateError && (
              <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(180,60,60,0.08)', border: '1px solid rgba(180,60,60,0.3)', borderRadius: '2px', fontSize: '12px', color: '#B43C3C' }}>
                {rateError}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '18px' }}>
              <button
                type="button"
                onClick={saveRate}
                disabled={rateSaving}
                style={{ padding: '10px 22px', background: 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500', cursor: rateSaving ? 'not-allowed' : 'pointer', opacity: rateSaving ? 0.6 : 1 }}
              >
                {rateSaving ? 'Saving...' : 'Save Rate'}
              </button>
              {rateSaved && (
                <span style={{ fontSize: '12px', color: 'var(--success)' }}>&#10003; Rate saved.</span>
              )}
            </div>
          </section>
          )}

          {/* License */}
          <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              Nursing License
            </h2>
            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>License Number</label>
                <input name="license_number" value={form.license_number} onChange={handle} style={inputStyle} placeholder="RN1234567" />
              </div>
              <div>
                <label style={labelStyle}>License State</label>
                <select name="license_state" value={form.license_state} onChange={handle} style={inputStyle}>
                  <option value="">Select state...</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Certifications */}
          <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px', marginBottom: '20px' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              Certifications
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {CERTIFICATIONS.map(cert => {
                const active = form.certifications.includes(cert)
                return (
                  <button key={cert} type="button" onClick={() => toggleCert(cert)}
                    style={{ padding: '8px 14px', borderRadius: '2px', fontSize: '12px', fontWeight: '500', letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.2s', border: active ? '1px solid var(--sky-blue)' : '1px solid var(--border)', background: active ? 'rgba(126,181,200,0.12)' : 'transparent', color: active ? 'var(--sky-blue)' : 'var(--text-muted)' }}>
                    {active ? '✓ ' : ''}{cert}
                  </button>
                )
              })}
            </div>

            <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '4px' }}>Certification Proof Files</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Upload current certification documents to strengthen your profile.</p>
                </div>
                <div>
                  <input type="file" ref={certificationRef} onChange={handleCertificationUpload} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: 'none' }} />
                  <button type="button" onClick={() => certificationRef.current.click()} disabled={uploadingCertification}
                    style={{ padding: '8px 16px', border: '1px solid var(--sky-blue)', background: 'transparent', color: 'var(--sky-blue)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                    {uploadingCertification ? 'Uploading...' : 'Upload Proof'}
                  </button>
                </div>
              </div>

              {certificationDocs.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No certification proof files uploaded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {certificationDocs.map((doc) => (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '4px', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ fontSize: '13px', color: 'var(--deep-navy)', fontWeight: '500' }}>{doc.title}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Uploaded {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" onClick={() => openCertification(doc.id)}
                          style={{ padding: '8px 14px', border: '1px solid var(--sky-blue)', background: 'transparent', color: 'var(--sky-blue)', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          View
                        </button>
                        <button type="button" onClick={() => removeCertification(doc.id)}
                          style={{ padding: '8px 14px', border: '1px solid rgba(180,60,60,0.25)', background: 'transparent', color: '#B43C3C', borderRadius: '2px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Document Uploads */}
          <section style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px', padding: '28px', marginBottom: '28px' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
              Documents
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                // Resume accept is narrower than the license one: only these
                // formats can be read by the resume parser. A .doc or a photo
                // uploads fine and is then silently never parsed.
                { label: 'Resume / CV', ref: resumeRef, url: resumeUrl, uploading: uploadingResume, onChange: handleResumeUpload, bucket: 'resumes', accept: '.pdf,.docx,.doc,.rtf,.txt,.png,.jpg,.jpeg', hint: 'PDF, Word, RTF, TXT or a clear photo' },
                { label: 'Nursing License Copy', ref: licenseRef, url: licenseUrl, uploading: uploadingLicense, onChange: handleLicenseUpload, bucket: 'licenses', accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png', hint: 'PDF or a photo/scan' },
              ].map(doc => (
                <div key={doc.label} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '3px' }}>{doc.label}</p>
                      {doc.url ? (
                        <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--sky-blue)' }}>View uploaded file ↗</a>
                      ) : (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No file uploaded yet &middot; {doc.hint}</p>
                      )}
                    </div>
                    <div>
                      <input type="file" ref={doc.ref} onChange={doc.onChange} accept={doc.accept} style={{ display: 'none' }} />
                      <button type="button" onClick={() => doc.ref.current.click()} disabled={doc.uploading}
                        style={{ padding: '8px 16px', border: '1px solid var(--sky-blue)', background: 'transparent', color: 'var(--sky-blue)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: 'pointer' }}>
                        {doc.uploading ? 'Uploading...' : doc.url ? 'Replace' : 'Upload'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px' }}>
              Accepted formats: PDF, DOC, DOCX, JPG, PNG. Max file size: 10MB.
            </p>
          </section>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => navigate('/nurse/dashboard')}
              style={{ padding: '11px 24px', border: '1px solid var(--sky-blue)', background: 'transparent', color: 'var(--sky-blue)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Go to Dashboard
            </button>
            <button type="button" onClick={() => navigate('/nurse/dashboard')}
              style={{ padding: '11px 24px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '11px 32px', background: saving ? 'var(--text-muted)' : 'var(--deep-navy)', color: 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
