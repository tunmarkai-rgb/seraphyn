const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')
const { createMessageNotification } = require('../lib/notifications')

router.use(requireAuth, requireRole('nurse', 'employer', 'admin'))

async function loadApplicationForMessaging(applicationId) {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id,
      status,
      employer_id,
      nurse_id,
      nurse_profiles!inner(id, user_id, first_name, last_name),
      employer_profiles!inner(id, user_id, org_name),
      jobs(title, city, state)
    `)
    .eq('id', applicationId)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

function userCanAccessApplication(application, user) {
  if (!application || !user) return false
  if (user.role === 'admin') return true
  if (user.role === 'nurse') return application.nurse_profiles?.user_id === user.id
  if (user.role === 'employer') return application.employer_profiles?.user_id === user.id
  return false
}

router.get('/threads', async (req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      application_id,
      sender_id,
      receiver_id,
      created_at,
      read,
      applications(
        id, status,
        jobs(title, city, state),
        nurse_profiles(first_name, last_name, user_id),
        employer_profiles(org_name, user_id)
      )
    `)
    .or(`sender_id.eq.${req.user.id},receiver_id.eq.${req.user.id}`)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const seen = new Set()
  const threads = (data || []).filter((message) => {
    const key = message.application_id
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  res.json(threads)
})

router.get('/thread/:applicationId', async (req, res) => {
  const application = await loadApplicationForMessaging(req.params.applicationId)
  if (!application) {
    return res.status(404).json({ error: 'Application not found' })
  }

  if (!userCanAccessApplication(application, req.user)) {
    return res.status(403).json({ error: 'Not authorized to access this application thread' })
  }

  res.json({
    application_id: application.id,
    sender_id: null,
    receiver_id: null,
    created_at: null,
    read: true,
    applications: application
  })
})

router.get('/:applicationId', async (req, res) => {
  const application = await loadApplicationForMessaging(req.params.applicationId)
  if (!application) {
    return res.status(404).json({ error: 'Application not found' })
  }

  if (!userCanAccessApplication(application, req.user)) {
    return res.status(403).json({ error: 'Not authorized to access this application thread' })
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('application_id', req.params.applicationId)
    .order('created_at', { ascending: true })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(data || [])
})

router.post('/:applicationId/read', async (req, res) => {
  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('application_id', req.params.applicationId)
    .eq('receiver_id', req.user.id)
    .eq('read', false)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json({ message: 'Messages marked as read' })
})

router.post('/', async (req, res) => {
  const { applicationId, content, receiverId } = req.body || {}
  if (!applicationId || !content?.trim()) {
    return res.status(400).json({ error: 'applicationId and content are required' })
  }

  const application = await loadApplicationForMessaging(applicationId)
  if (!application) {
    return res.status(404).json({ error: 'Application not found' })
  }

  if (!userCanAccessApplication(application, req.user)) {
    return res.status(403).json({ error: 'Not authorized to message on this application' })
  }

  let resolvedReceiverId = receiverId || null
  if (!resolvedReceiverId) {
    if (req.user.role === 'nurse') {
      resolvedReceiverId = application.employer_profiles?.user_id
    } else if (req.user.role === 'employer') {
      resolvedReceiverId = application.nurse_profiles?.user_id
    }
  }

  if (!resolvedReceiverId) {
    return res.status(400).json({ error: 'Unable to determine message receiver' })
  }

  const { data: inserted, error } = await supabase
    .from('messages')
    .insert({
      sender_id: req.user.id,
      receiver_id: resolvedReceiverId,
      application_id: applicationId,
      content: content.trim(),
      read: false
    })
    .select('*')
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const { data: receiverUser } = await supabase
    .from('users')
    .select('email')
    .eq('id', resolvedReceiverId)
    .maybeSingle()

  await createMessageNotification({
    receiverId: resolvedReceiverId,
    senderName: req.user.full_name,
    message: inserted,
    applicationId,
    recipientEmail: receiverUser?.email || null
  })

  res.status(201).json(inserted)
})

module.exports = router
