const express = require('express')
const router = express.Router()
const { supabase } = require('../config/supabase')
const { requireAuth, requireRole } = require('../middleware/auth')
const { createMessageNotification } = require('../lib/notifications')

router.use(requireAuth, requireRole('nurse', 'employer', 'admin'))

function applicationThreadId(applicationId) {
  return `app:${applicationId}`
}

function directThreadId(userId) {
  return `direct:${userId}`
}

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

  if (error || !data) return null
  return data
}

async function loadUserForDirectMessaging(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, role, status, full_name')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data
}

function userCanAccessApplication(application, user) {
  if (!application || !user) return false
  if (user.role === 'admin') return true
  if (user.role === 'nurse') return application.nurse_profiles?.user_id === user.id
  if (user.role === 'employer') return application.employer_profiles?.user_id === user.id
  return false
}

async function employerIsApproved(userId) {
  const { data: employer } = await supabase
    .from('employer_profiles')
    .select('onboarding_stage, approved_at')
    .eq('user_id', userId)
    .maybeSingle()

  return employer?.onboarding_stage === 'approved' && Boolean(employer?.approved_at)
}

async function userCanStartDirectThread(sender, receiver) {
  if (!sender || !receiver || sender.id === receiver.id) return false
  if (sender.role === 'admin') return ['nurse', 'employer', 'admin'].includes(receiver.role)
  if (sender.role === 'employer') return receiver.role === 'nurse' && await employerIsApproved(sender.id)
  if (sender.role === 'nurse') return ['employer', 'admin'].includes(receiver.role)
  return false
}

async function directThreadExists(userA, userB) {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .is('application_id', null)
    .or(`and(sender_id.eq.${userA},receiver_id.eq.${userB}),and(sender_id.eq.${userB},receiver_id.eq.${userA})`)

  if (error) return false
  return Boolean(count)
}

async function canAccessDirectThread(currentUser, otherUser) {
  if (await userCanStartDirectThread(currentUser, otherUser)) return true
  return directThreadExists(currentUser.id, otherUser.id)
}

function toApplicationThread(message) {
  return {
    ...message,
    thread_id: applicationThreadId(message.application_id),
    thread_type: 'application'
  }
}

function toDirectThread(message, currentUserId, directUsersById = {}) {
  const otherUserId = message.sender_id === currentUserId ? message.receiver_id : message.sender_id
  return {
    ...message,
    application_id: null,
    thread_id: directThreadId(otherUserId),
    thread_type: 'direct',
    direct_user_id: otherUserId,
    direct_user: directUsersById[otherUserId] || null
  }
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

  if (error) return res.status(500).json({ error: error.message })

  const directUserIds = Array.from(new Set((data || [])
    .filter((message) => !message.application_id)
    .map((message) => message.sender_id === req.user.id ? message.receiver_id : message.sender_id)
    .filter(Boolean)))

  let directUsersById = {}
  if (directUserIds.length > 0) {
    const { data: directUsers } = await supabase
      .from('users')
      .select('id, email, role, full_name')
      .in('id', directUserIds)

    directUsersById = (directUsers || []).reduce((accumulator, user) => {
      accumulator[user.id] = user
      return accumulator
    }, {})
  }

  const seen = new Set()
  const threads = (data || [])
    .filter((message) => {
      const otherUserId = message.sender_id === req.user.id ? message.receiver_id : message.sender_id
      const key = message.application_id ? applicationThreadId(message.application_id) : directThreadId(otherUserId)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((message) => message.application_id
      ? toApplicationThread(message)
      : toDirectThread(message, req.user.id, directUsersById))

  res.json(threads)
})

router.get('/thread/direct/:userId', async (req, res) => {
  const receiver = await loadUserForDirectMessaging(req.params.userId)
  if (!receiver) return res.status(404).json({ error: 'User not found' })
  if (!await canAccessDirectThread(req.user, receiver)) {
    return res.status(403).json({ error: 'Not authorized to start this message thread' })
  }

  res.json({
    application_id: null,
    sender_id: null,
    receiver_id: receiver.id,
    created_at: null,
    read: true,
    thread_id: directThreadId(receiver.id),
    thread_type: 'direct',
    direct_user_id: receiver.id,
    direct_user: receiver
  })
})

router.get('/thread/:applicationId', async (req, res) => {
  const application = await loadApplicationForMessaging(req.params.applicationId)
  if (!application) return res.status(404).json({ error: 'Application not found' })
  if (!userCanAccessApplication(application, req.user)) {
    return res.status(403).json({ error: 'Not authorized to access this application thread' })
  }

  res.json({
    application_id: application.id,
    sender_id: null,
    receiver_id: null,
    created_at: null,
    read: true,
    thread_id: applicationThreadId(application.id),
    thread_type: 'application',
    applications: application
  })
})

router.get('/direct/:userId', async (req, res) => {
  const receiver = await loadUserForDirectMessaging(req.params.userId)
  if (!receiver) return res.status(404).json({ error: 'User not found' })
  if (!await canAccessDirectThread(req.user, receiver)) {
    return res.status(403).json({ error: 'Not authorized to access this message thread' })
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .is('application_id', null)
    .or(`and(sender_id.eq.${req.user.id},receiver_id.eq.${receiver.id}),and(sender_id.eq.${receiver.id},receiver_id.eq.${req.user.id})`)
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

router.get('/:applicationId', async (req, res) => {
  const application = await loadApplicationForMessaging(req.params.applicationId)
  if (!application) return res.status(404).json({ error: 'Application not found' })
  if (!userCanAccessApplication(application, req.user)) {
    return res.status(403).json({ error: 'Not authorized to access this application thread' })
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('application_id', req.params.applicationId)
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

router.post('/direct/:userId/read', async (req, res) => {
  const receiver = await loadUserForDirectMessaging(req.params.userId)
  if (!receiver) return res.status(404).json({ error: 'User not found' })

  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .is('application_id', null)
    .eq('sender_id', receiver.id)
    .eq('receiver_id', req.user.id)
    .eq('read', false)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Messages marked as read' })
})

router.post('/:applicationId/read', async (req, res) => {
  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('application_id', req.params.applicationId)
    .eq('receiver_id', req.user.id)
    .eq('read', false)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Messages marked as read' })
})

router.post('/', async (req, res) => {
  const { applicationId, content, receiverId, directUserId } = req.body || {}
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' })
  if (!applicationId && !directUserId) {
    return res.status(400).json({ error: 'applicationId or directUserId is required' })
  }

  if (directUserId && !applicationId) {
    const receiver = await loadUserForDirectMessaging(directUserId)
    if (!receiver) return res.status(404).json({ error: 'User not found' })
    if (!await canAccessDirectThread(req.user, receiver)) {
      return res.status(403).json({ error: 'Not authorized to message this user' })
    }

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({
        sender_id: req.user.id,
        receiver_id: receiver.id,
        application_id: null,
        content: content.trim(),
        read: false
      })
      .select('*')
      .single()

    if (error) return res.status(500).json({ error: error.message })

    await createMessageNotification({
      receiverId: receiver.id,
      senderName: req.user.full_name,
      message: inserted,
      directUserId: req.user.id,
      recipientEmail: receiver.email || null
    })

    return res.status(201).json(inserted)
  }

  const application = await loadApplicationForMessaging(applicationId)
  if (!application) return res.status(404).json({ error: 'Application not found' })
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

  if (error) return res.status(500).json({ error: error.message })

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
