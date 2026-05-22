import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Navbar from '../../components/Navbar'
import { SPECIALTIES, US_STATES } from '../../lib/constants'
import { apiRequest } from '../../lib/api'

const CERTIFICATIONS = ['BLS','ACLS','PALS','TNCC','CCRN','CEN','CNOR','NRP','NIHSS','AWHONN']

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
  const [resumeUrl, setResumeUrl] = useState('')
  const [licenseUrl, setLicenseUrl] = useState('')
  const [certificationDocs, setCertificationDocs] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [uploadingLicense, setUploadingLicense] = useState(false)
  const [uploadingCertification, setUploadingCertification] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) loadProfile()
  }, [user])

  async function loadProfile() {
    const { data } = await supabase
      .from('nurse_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    const metadata = user.user_metadata || {}
    const source = data || {}

    setResumeUrl(source.resume_url || '')
    setLicenseUrl(source.license_url || '')
    setForm({
      first_name: source.first_name || metadata.first_name || '',
      last_name: source.last_name || metadata.last_name || '',
      specialty: source.specialty || metadata.specialty || '',
      license_number: source.license_number || '',
      license_state: source.license_state || metadata.license_state || '',
      years_experience: source.years_experience || metadata.years_experience || '',
      shift_preference: source.shift_preference || metadata.shift_preference || '',
      availability: source.availability || '',
      bio: source.bio || '',
      certifications: source.certifications || []
    })

    try {
      const docs = await apiRequest(`/api/nurses/${source.id || data?.id}/documents`)
      setCertificationDocs(docs || [])
    } catch (docsError) {
      if (!/Complete employer onboarding/i.test(docsError.message)) {
        console.error('Failed to load certification documents:', docsError.message)
      }
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

  async function uploadFile(file, bucket, setter, setUrl) {
    setter(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
      setUrl(publicUrl)
      return publicUrl
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
    const publicUrl = await uploadFile(file, 'resumes', setUploadingResume, setResumeUrl)
    if (publicUrl) {
      try {
        await supabase
          .from('nurse_profiles')
          .upsert({
            user_id: user.id,
            resume_url: publicUrl,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' })
        await apiRequest('/api/integrations/events/self', {
          method: 'POST',
          body: {
            event: 'nurse.document_uploaded',
            payload: {
              documentType: 'resume',
              bucket: 'resumes',
              fileUrl: publicUrl
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
    const publicUrl = await uploadFile(file, 'licenses', setUploadingLicense, setLicenseUrl)
    if (publicUrl) {
      try {
        await supabase
          .from('nurse_profiles')
          .upsert({
            user_id: user.id,
            license_url: publicUrl,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' })
        await apiRequest('/api/integrations/events/self', {
          method: 'POST',
          body: {
            event: 'nurse.document_uploaded',
            payload: {
              documentType: 'license',
              bucket: 'licenses',
              fileUrl: publicUrl
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
      setError(uploadError.message)
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
        resume_url: resumeUrl || undefined,
        license_url: licenseUrl || undefined,
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
                    <option value="Day">Day Shift</option>
                    <option value="Night">Night Shift</option>
                    <option value="Evening">Evening Shift</option>
                    <option value="Mixed">Mixed / Flexible</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Availability</label>
                <select name="availability" value={form.availability} onChange={handle} style={inputStyle}>
                  <option value="">Select...</option>
                  <option value="Immediately">Immediately Available</option>
                  <option value="2 Weeks">Available in 2 Weeks</option>
                  <option value="1 Month">Available in 1 Month</option>
                  <option value="Per Diem">Per Diem Only</option>
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
                { label: 'Resume / CV', ref: resumeRef, url: resumeUrl, uploading: uploadingResume, onChange: handleResumeUpload, bucket: 'resumes' },
                { label: 'Nursing License Copy', ref: licenseRef, url: licenseUrl, uploading: uploadingLicense, onChange: handleLicenseUpload, bucket: 'licenses' },
              ].map(doc => (
                <div key={doc.label} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--deep-navy)', marginBottom: '3px' }}>{doc.label}</p>
                      {doc.url ? (
                        <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--sky-blue)' }}>View uploaded file ↗</a>
                      ) : (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No file uploaded yet</p>
                      )}
                    </div>
                    <div>
                      <input type="file" ref={doc.ref} onChange={doc.onChange} accept=".pdf,.doc,.docx,.jpg,.png" style={{ display: 'none' }} />
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

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
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
