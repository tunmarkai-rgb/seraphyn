const express = require('express')
const router = express.Router()
const multer = require('multer')
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole, requireSessionUser, optionalAuth } = require('../middleware/auth')
const { ensureNurseProfileRow, ensurePublicUserForAuthUser, normalizeShiftPreference } = require('../lib/user-bootstrap')
const {
  getBillingSettings,
  validateHourlyRate,
  employerRateShape,
  adminRateShape,
  nurseRateShape,
  loadRateRow,
  loadRateRows
} = require('../lib/rates')
const { setNurseDesiredRate } = require('../lib/nurse-rates')
const {
  nurseRequestShape,
  loadRequest,
  applyTransition,
  loadEmployerSummaries,
  EMPLOYER_STATUS_LABELS
} = require('../lib/nurse-requests')
const { notifyAdmins } = require('../lib/notifications')
const { employerHasFullAccess } = require('../lib/employer-access')
const upload = multer({ storage: multer.memoryStorage() })

// Columns a nurse (or admin) may write through PUT /api/nurses/:id. An
// allowlist, not a denylist -- a denylist silently exposes every column added
// to nurse_profiles later.
const NURSE_UPDATABLE_FIELDS = [
  'first_name', 'last_name', 'specialty', 'license_number', 'license_state',
  'years_experience', 'availability', 'shift_preference', 'bio',
  'certifications', 'profile_photo_url', 'resume_url', 'license_url'
]

// Fields returned to employers on the directory. Rates are attached separately
// from the nurse_rates table; they are never columns on nurse_profiles.
const DIRECTORY_BASE_FIELDS =
  'id, first_name, specialty, years_experience, availability, shift_preference, certifications, profile_photo_url, approved_at'
const DIRECTORY_FULL_FIELDS =
  'id, first_name, last_name, specialty, years_experience, availability, shift_preference, certifications, bio, profile_photo_url, approved_at'

function isNurseUser(req) {
  return req.user?.role === 'nurse' || req.authUser?.user_metadata?.role === 'nurse'
}

async function ensureCurrentNurseProfile(req) {
  const authUser = req.authUser || req.user
  const publicUser = await ensurePublicUserForAuthUser(authUser, 'nurse')
  const metadata = authUser?.user_metadata || {}
  const yearsExperience = metadata.years_experience
  return ensureNurseProfileRow(publicUser.id, {
    first_name: metadata.first_name || '',
    last_name: metadata.last_name || '',
    specialty: metadata.specialty || '',
    license_state: metadata.license_state || '',
    years_experience: yearsExperience !== undefined && yearsExperience !== null && String(yearsExperience).trim() !== ''
      ? Number(yearsExperience)
      : null,
    shift_preference: normalizeShiftPreference(metadata.shift_preference || '', null)
  })
}

async function createPrivateFileUrl(bucket, path) {
  if (!path) return ''
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data?.signedUrl || ''
}

// GET /api/nurses — admin gets all fields, employer gets limited fields
router.get('/', requireAuth, requireRole('admin', 'employer'), async (req, res) => {
  const isAdmin = req.user.role === 'admin'
  const isApprovedEmployer = req.user.role === 'employer' && req.user.status === 'approved'

  let select = isAdmin
    ? '*'
    : 'id, first_name, specialty, years_experience, availability, shift_preference, certifications, profile_photo_url, approved_at'

  // Approved employers with signed contracts get more fields
  if (isApprovedEmployer) {
    const { data: ep } = await supabase
      .from('employer_profiles')
      .select('onboarding_stage, approved_at')
      .eq('user_id', req.user.id)
      .single()

    if (ep?.onboarding_stage === 'approved' && ep?.approved_at) {
      select = 'id, first_name, last_name, specialty, years_experience, availability, shift_preference, certifications, bio, profile_photo_url, approved_at'
    }
  }

  const { data, error } = await supabase
    .from('nurse_profiles')
    .select(select)
    .not('approved_at', 'is', null)
    .order('approved_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/nurses/featured — public, anonymised preview for homepage
router.get('/featured', async (req, res) => {
  const { data, error } = await supabase
    .from('nurse_profiles')
    .select('id, first_name, last_name, specialty, years_experience, certifications, shift_preference')
    .not('approved_at', 'is', null)
    .order('approved_at', { ascending: false })
    .limit(3)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/nurses/directory — serves guests, nurses, employers and admins from
// one handler. Bill rates are attached only for full-access employers and
// admins; the nurse's own rate and the markup never appear in this payload.
router.get('/directory', optionalAuth, async (req, res) => {
  try {
    const role = req.user?.role
    const isAdmin = role === 'admin'

    const hasFullAccess =
      isAdmin || (role === 'employer' && (await employerHasFullAccess(req.user.id)))

    const { data, error } = await supabase
      .from('nurse_profiles')
      .select(hasFullAccess ? DIRECTORY_FULL_FIELDS : DIRECTORY_BASE_FIELDS)
      .not('approved_at', 'is', null)
      .order('approved_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })

    const nurses = data || []

    // Only these two roles ever see a rate.
    if (!hasFullAccess) {
      return res.json({ nurses, rates_visible: false })
    }

    // Rate attachment must not be able to take the directory down -- if the
    // rate tables or settings row are missing, serve the profiles without rates.
    try {
      const settings = await getBillingSettings()
      const rateRows = await loadRateRows(nurses.map((n) => n.id))

      const withRates = nurses.map((nurse) => ({
        ...nurse,
        ...employerRateShape(rateRows.get(nurse.id) || null, settings)
      }))

      return res.json({ nurses: withRates, rates_visible: true })
    } catch (rateError) {
      console.error('Failed to attach directory rates:', rateError.message)
      return res.json({ nurses, rates_visible: false })
    }
  } catch (error) {
    console.error('Nurse directory failed:', error.message)
    res.status(500).json({ error: 'Failed to load nurse directory' })
  }
})

// GET /api/nurses/self/rate — the nurse's own rate. Never returns the bill rate
// or the markup.
router.get('/self/rate', requireSessionUser, async (req, res) => {
  try {
    if (!isNurseUser(req)) {
      return res.status(403).json({ error: 'Nurse access required' })
    }

    const profile = await ensureCurrentNurseProfile(req)
    const settings = await getBillingSettings()
    const rateRow = await loadRateRow(profile.id)

    res.json(nurseRateShape(rateRow, settings))
  } catch (error) {
    console.error('Nurse rate read failed:', error.message)
    res.status(500).json({ error: 'Failed to load your rate' })
  }
})

// PUT /api/nurses/self/rate — body { hourly_rate: number | null }
router.put('/self/rate', requireSessionUser, async (req, res) => {
  try {
    if (!isNurseUser(req)) {
      return res.status(403).json({ error: 'Nurse access required' })
    }

    const settings = await getBillingSettings()
    const check = validateHourlyRate(req.body?.hourly_rate, settings)
    if (!check.valid) return res.status(400).json({ error: check.error })

    const profile = await ensureCurrentNurseProfile(req)
    const updated = await setNurseDesiredRate(profile.id, check.value, req.user?.id)

    res.json(nurseRateShape(updated, settings))
  } catch (error) {
    console.error('Nurse rate update failed:', error.message)
    res.status(500).json({ error: 'Failed to save your rate' })
  }
})

router.post('/self/bootstrap', requireSessionUser, async (req, res) => {
  try {
    if (!isNurseUser(req)) {
      return res.status(403).json({ error: 'Nurse access required' })
    }

    const profile = await ensureCurrentNurseProfile(req)
    const resumeUrl = await createPrivateFileUrl('resumes', profile.resume_url)
    const licenseUrl = await createPrivateFileUrl('licenses', profile.license_url)

    res.json({
      profile,
      fileUrls: {
        resume: resumeUrl,
        license: licenseUrl
      }
    })
  } catch (error) {
    console.error('Nurse profile bootstrap failed:', error.message)
    res.status(500).json({ error: error.message || 'Failed to prepare nurse profile' })
  }
})

router.get('/self/files/:kind/download', requireSessionUser, async (req, res) => {
  try {
    if (!isNurseUser(req)) {
      return res.status(403).json({ error: 'Nurse access required' })
    }

    const profile = await ensureCurrentNurseProfile(req)
    const kind = req.params.kind
    const bucket = kind === 'resume' ? 'resumes' : kind === 'license' ? 'licenses' : ''
    const filePath = kind === 'resume' ? profile.resume_url : kind === 'license' ? profile.license_url : ''

    if (!bucket) {
      return res.status(400).json({ error: 'Unsupported document type' })
    }
    if (!filePath) {
      return res.status(404).json({ error: 'File not uploaded yet' })
    }

    const url = await createPrivateFileUrl(bucket, filePath)
    res.json({ url, filePath })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to create signed file URL' })
  }
})

router.post('/self/files/:kind', requireSessionUser, upload.single('file'), async (req, res) => {
  try {
    if (!isNurseUser(req)) {
      return res.status(403).json({ error: 'Nurse access required' })
    }
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' })
    }

    const profile = await ensureCurrentNurseProfile(req)
    const kind = req.params.kind
    const bucket = kind === 'resume' ? 'resumes' : kind === 'license' ? 'licenses' : ''
    const profileField = kind === 'resume' ? 'resume_url' : kind === 'license' ? 'license_url' : ''

    if (!bucket || !profileField) {
      return res.status(400).json({ error: 'Unsupported document type' })
    }

    const extension = req.file.originalname.includes('.') ? req.file.originalname.split('.').pop() : 'pdf'
    const filePath = `${profile.id}/${kind}-${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, req.file.buffer, {
      contentType: req.file.mimetype || 'application/octet-stream',
      upsert: true
    })

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message })
    }

    const now = new Date().toISOString()
    const { data: updatedProfile, error: updateError } = await supabase
      .from('nurse_profiles')
      .update({
        [profileField]: filePath,
        updated_at: now
      })
      .eq('id', profile.id)
      .select('*')
      .single()

    if (updateError) {
      return res.status(500).json({ error: updateError.message })
    }

    const downloadUrl = await createPrivateFileUrl(bucket, filePath)
    res.json({
      filePath,
      downloadUrl,
      profile: updatedProfile
    })
  } catch (error) {
    console.error('Nurse file upload failed:', error.message)
    res.status(500).json({ error: error.message || 'Failed to upload file' })
  }
})

router.get('/:id/documents', requireAuth, requireRole('nurse', 'admin', 'employer'), async (req, res) => {
  if (req.user.role === 'nurse') {
    const { data: nurse } = await supabase
      .from('nurse_profiles')
      .select('id')
      .eq('user_id', req.user.id)
      .single()

    if (!nurse?.id || nurse.id !== req.params.id) {
      return res.status(403).json({ error: 'Not authorized to access these documents' })
    }
  }

  if (req.user.role === 'employer') {
    const allowed = await employerHasFullAccess(req.user.id)
    if (!allowed) {
      return res.status(403).json({ error: 'Complete employer onboarding before viewing private nurse documents' })
    }
  }

  const { data, error } = await supabase
    .from('nurse_documents')
    .select('id, nurse_id, document_type, title, file_url, created_at, updated_at')
    .eq('nurse_id', req.params.id)
    .eq('document_type', 'certification')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

router.get('/:id/files/:kind/download', requireAuth, requireRole('nurse', 'admin', 'employer'), async (req, res) => {
  const kind = req.params.kind
  const bucket = kind === 'resume' ? 'resumes' : kind === 'license' ? 'licenses' : ''
  const profileField = kind === 'resume' ? 'resume_url' : kind === 'license' ? 'license_url' : ''

  if (!bucket || !profileField) {
    return res.status(400).json({ error: 'Unsupported document type' })
  }

  const { data: nurse, error } = await supabase
    .from('nurse_profiles')
    .select(`id, user_id, ${profileField}`)
    .eq('id', req.params.id)
    .single()

  if (error || !nurse) {
    return res.status(404).json({ error: 'Nurse not found' })
  }

  if (req.user.role === 'nurse' && nurse.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to access this file' })
  }

  if (req.user.role === 'employer') {
    const allowed = await employerHasFullAccess(req.user.id)
    if (!allowed) {
      return res.status(403).json({ error: 'Complete employer onboarding before viewing private nurse documents' })
    }
  }

  const filePath = nurse[profileField]
  if (!filePath) {
    return res.status(404).json({ error: 'File not uploaded yet' })
  }

  try {
    const url = await createPrivateFileUrl(bucket, filePath)
    res.json({ url, filePath })
  } catch (signedError) {
    res.status(500).json({ error: signedError.message })
  }
})

router.get('/documents/:documentId/download', requireAuth, requireRole('nurse', 'admin', 'employer'), async (req, res) => {
  const { data: document, error } = await supabase
    .from('nurse_documents')
    .select('id, nurse_id, document_type, title, file_url')
    .eq('id', req.params.documentId)
    .single()

  if (error || !document) {
    return res.status(404).json({ error: 'Document not found' })
  }

  if (req.user.role === 'nurse') {
    const { data: nurse } = await supabase
      .from('nurse_profiles')
      .select('id')
      .eq('user_id', req.user.id)
      .single()

    if (!nurse?.id || nurse.id !== document.nurse_id) {
      return res.status(403).json({ error: 'Not authorized to access this document' })
    }
  }

  if (req.user.role === 'employer') {
    const allowed = await employerHasFullAccess(req.user.id)
    if (!allowed) {
      return res.status(403).json({ error: 'Complete employer onboarding before viewing private nurse documents' })
    }
  }

  const { data: signed, error: signedError } = await supabase
    .storage
    .from('certifications')
    .createSignedUrl(document.file_url, 60 * 10)

  if (signedError) {
    return res.status(500).json({ error: signedError.message })
  }

  res.json({ url: signed?.signedUrl || '' })
})

router.post('/documents/certifications', requireSessionUser, upload.single('file'), async (req, res) => {
  if (!isNurseUser(req)) {
    return res.status(403).json({ error: 'Nurse access required' })
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Certification file is required' })
  }

  const title = String(req.body?.title || req.file.originalname || 'Certification').trim()
  const nurse = await ensureCurrentNurseProfile(req)

  const fileExt = req.file.originalname.includes('.') ? req.file.originalname.split('.').pop() : 'pdf'
  const filePath = `${nurse.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
  const { error: uploadError } = await supabase
    .storage
    .from('certifications')
    .upload(filePath, req.file.buffer, {
      contentType: req.file.mimetype || 'application/octet-stream',
      upsert: true
    })

  if (uploadError) {
    return res.status(500).json({ error: uploadError.message })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('nurse_documents')
    .insert({
      nurse_id: nurse.id,
      document_type: 'certification',
      title,
      file_url: filePath,
      created_at: now,
      updated_at: now
    })
    .select('*')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.delete('/documents/:documentId', requireSessionUser, async (req, res) => {
  if (!isNurseUser(req)) {
    return res.status(403).json({ error: 'Nurse access required' })
  }
  const nurse = await ensureCurrentNurseProfile(req)

  const { data: document, error } = await supabase
    .from('nurse_documents')
    .select('id, nurse_id, file_url')
    .eq('id', req.params.documentId)
    .single()

  if (error || !document) {
    return res.status(404).json({ error: 'Document not found' })
  }

  if (document.nurse_id !== nurse.id) {
    return res.status(403).json({ error: 'Not authorized to delete this document' })
  }

  await supabase.storage.from('certifications').remove([document.file_url])
  await supabase.from('nurse_documents').delete().eq('id', document.id)

  res.json({ message: 'Certification document removed' })
})

// GET /api/nurses/:id
router.get('/:id', requireAuth, requireRole('admin', 'employer'), async (req, res) => {
  const isAdmin = req.user.role === 'admin'
  let select = isAdmin ? '*' : 'id, first_name, specialty, years_experience, availability'

  if (req.user.role === 'employer') {
    if (await employerHasFullAccess(req.user.id)) {
      select = 'id, user_id, first_name, last_name, specialty, years_experience, availability, shift_preference, certifications, bio, profile_photo_url'
    }
  }

  const { data, error } = await supabase
    .from('nurse_profiles')
    .select(select)
    .eq('id', req.params.id)
    .single()

  if (error) return res.status(404).json({ error: 'Nurse not found' })

  // Attach the rate for the two roles allowed to see one. Employers get the
  // bill rate only; admins additionally get the nurse rate and the markup.
  try {
    const fullAccess = isAdmin || (await employerHasFullAccess(req.user.id))
    if (fullAccess) {
      const settings = await getBillingSettings()
      const rateRow = await loadRateRow(req.params.id)
      const shape = isAdmin
        ? adminRateShape(rateRow, settings)
        : employerRateShape(rateRow, settings)

      // So the employer's "Request This Nurse" button can show existing state
      // instead of letting them submit a duplicate.
      let myRequest = null
      if (req.user.role === 'employer') {
        const { data: ep } = await supabase
          .from('employer_profiles')
          .select('id')
          .eq('user_id', req.user.id)
          .maybeSingle()

        if (ep?.id) {
          const { data: existing } = await supabase
            .from('nurse_requests')
            .select('id, status')
            .eq('employer_id', ep.id)
            .eq('nurse_id', req.params.id)
            .not('status', 'in', '(nurse_declined,placed,rejected,closed)')
            .maybeSingle()

          if (existing) {
            myRequest = {
              id: existing.id,
              status_label: EMPLOYER_STATUS_LABELS[existing.status] || 'In Review'
            }
          }
        }
      }

      return res.json({ ...data, ...shape, my_request: myRequest })
    }
  } catch (rateError) {
    console.error('Failed to attach nurse rate:', rateError.message)
  }

  res.json(data)
})

// PUT /api/nurses/:id — nurse updates own profile
router.put('/:id', requireAuth, requireRole('nurse', 'admin'), async (req, res) => {
  const { id } = req.params

  // Verify ownership unless admin
  if (req.user.role !== 'admin') {
    const { data: np } = await supabase.from('nurse_profiles').select('user_id').eq('id', id).single()
    if (!np || np.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' })
  }

  // Allowlist rather than deleting a few known-bad keys, so columns added to
  // nurse_profiles later are not writable through here by default.
  const updates = {}
  for (const field of NURSE_UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
      updates[field] = req.body[field]
    }
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No updatable fields provided' })
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('nurse_profiles')
    .update(updates)
    .eq('id', id)
    .select(`id, user_id, ${NURSE_UPDATABLE_FIELDS.join(', ')}, approved_at, created_at, updated_at`)
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/nurses/self/requests
// Only requests an admin has presented. Nothing at submitted/reviewing --
// that is the admin gate, and the nurse must not see a request that has not
// been vetted and priced.
router.get('/self/requests', requireSessionUser, async (req, res) => {
  try {
    if (!isNurseUser(req)) return res.status(403).json({ error: 'Nurse access required' })

    const profile = await ensureCurrentNurseProfile(req)
    const { data, error } = await supabase
      .from('nurse_requests')
      .select('*')
      .eq('nurse_id', profile.id)
      .in('status', ['presented', 'nurse_accepted', 'nurse_declined', 'placed'])
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })

    const rows = data || []
    const employers = await loadEmployerSummaries(rows.map((r) => r.employer_id))
    res.json(rows.map((r) => nurseRequestShape(r, employers.get(r.employer_id) || null)))
  } catch (error) {
    console.error('Nurse request list failed:', error.message)
    res.status(500).json({ error: 'Failed to load your requests' })
  }
})

// POST /api/nurses/self/requests/:id/respond
// body { accept: boolean, note?: string }
// The nurse answers directly -- admin gates the introduction, not the answer.
router.post('/self/requests/:id/respond', requireSessionUser, async (req, res) => {
  try {
    if (!isNurseUser(req)) return res.status(403).json({ error: 'Nurse access required' })

    const profile = await ensureCurrentNurseProfile(req)
    const request = await loadRequest(req.params.id)
    if (!request || request.nurse_id !== profile.id) {
      return res.status(404).json({ error: 'Request not found' })
    }

    if (typeof req.body?.accept !== 'boolean') {
      return res.status(400).json({ error: 'accept must be true or false' })
    }

    const toStatus = req.body.accept ? 'nurse_accepted' : 'nurse_declined'
    const note = String(req.body.note || '').trim()

    const result = await applyTransition(request, {
      role: 'nurse',
      actorId: req.user?.id,
      toStatus,
      patch: { nurse_response_note: note },
      note
    })
    if (result.error) return res.status(result.status).json({ error: result.error })

    await notifyAdmins({
      type: `nurse_request.${toStatus}`,
      title: req.body.accept ? 'Nurse accepted a request' : 'Nurse declined a request',
      body: `${profile.first_name || 'A nurse'} ${req.body.accept ? 'accepted' : 'declined'}${note ? `: ${note}` : '.'}`,
      entityType: 'nurse_request',
      entityId: request.id
    })

    const employers = await loadEmployerSummaries([request.employer_id])
    res.json(nurseRequestShape(result.request, employers.get(request.employer_id) || null))
  } catch (error) {
    console.error('Nurse request respond failed:', error.message)
    res.status(500).json({ error: 'Failed to record your response' })
  }
})

module.exports = router
