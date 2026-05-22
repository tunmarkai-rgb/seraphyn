const express = require('express')
const router = express.Router()
const multer = require('multer')
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')
const upload = multer({ storage: multer.memoryStorage() })

async function employerHasFullAccess(userId) {
  const { data: ep } = await supabase
    .from('employer_profiles')
    .select('onboarding_stage, approved_at')
    .eq('user_id', userId)
    .single()

  return ep?.onboarding_stage === 'approved' && ep?.approved_at
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

router.get('/:id/documents', requireAuth, requireRole('admin', 'employer'), async (req, res) => {
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

router.post('/documents/certifications', requireAuth, requireRole('nurse'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Certification file is required' })
  }

  const title = String(req.body?.title || req.file.originalname || 'Certification').trim()

  const { data: nurse, error: nurseError } = await supabase
    .from('nurse_profiles')
    .select('id')
    .eq('user_id', req.user.id)
    .single()

  if (nurseError || !nurse?.id) {
    return res.status(404).json({ error: 'Nurse profile not found' })
  }

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

router.delete('/documents/:documentId', requireAuth, requireRole('nurse'), async (req, res) => {
  const { data: nurse } = await supabase
    .from('nurse_profiles')
    .select('id')
    .eq('user_id', req.user.id)
    .single()

  if (!nurse?.id) {
    return res.status(404).json({ error: 'Nurse profile not found' })
  }

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
      select = 'id, first_name, last_name, specialty, years_experience, availability, shift_preference, certifications, bio, profile_photo_url'
    }
  }

  const { data, error } = await supabase
    .from('nurse_profiles')
    .select(select)
    .eq('id', req.params.id)
    .single()

  if (error) return res.status(404).json({ error: 'Nurse not found' })
  res.json(data)
})

// PUT /api/nurses/:id — nurse updates own profile
router.put('/:id', requireAuth, requireRole('nurse', 'admin'), async (req, res) => {
  const { id } = req.params
  const updates = req.body

  // Verify ownership unless admin
  if (req.user.role !== 'admin') {
    const { data: np } = await supabase.from('nurse_profiles').select('user_id').eq('id', id).single()
    if (!np || np.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' })
  }

  // Remove fields that shouldn't be updated via API
  delete updates.id
  delete updates.user_id
  delete updates.approved_at
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase.from('nurse_profiles').update(updates).eq('id', id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

module.exports = router
