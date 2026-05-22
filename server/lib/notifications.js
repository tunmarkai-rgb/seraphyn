const { supabase } = require('../config/supabase')
const { sendPortalEmail } = require('./mail')

function isMissingRelation(error) {
  return error?.code === '42P01' || /does not exist/i.test(error?.message || '')
}

async function createNotification({
  userId,
  type,
  title,
  body,
  entityType = null,
  entityId = null,
  metadata = {},
  emailSentAt = null
}) {
  if (!userId || !type || !title) {
    return { skipped: true, reason: 'Missing notification fields' }
  }

  const payload = {
    user_id: userId,
    type,
    title,
    body: body || '',
    entity_type: entityType,
    entity_id: entityId,
    metadata,
    ...(emailSentAt ? { email_sent_at: emailSentAt } : {})
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    if (!isMissingRelation(error)) {
      console.error('Failed to create notification:', error.message)
    }
    return { skipped: true, reason: error.message }
  }

  return { success: true, notification: data }
}

async function listNotificationsForUser(userId, { unreadOnly = false, limit = 25 } = {}) {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) {
    query = query.eq('read', false)
  }

  const { data, error } = await query

  if (error) {
    if (!isMissingRelation(error)) {
      console.error('Failed to list notifications:', error.message)
    }
    return []
  }

  return data || []
}

async function markNotificationRead(userId, notificationId) {
  const { data, error } = await supabase
    .from('notifications')
    .update({
      read: true,
      read_at: new Date().toISOString()
    })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    if (!isMissingRelation(error)) {
      throw error
    }
    return null
  }

  return data
}

async function markAllNotificationsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({
      read: true,
      read_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('read', false)

  if (error && !isMissingRelation(error)) {
    throw error
  }
}

async function getExistingNotification(userId, type, entityType, entityId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (!isMissingRelation(error)) {
      console.error('Failed to lookup notification:', error.message)
    }
    return null
  }

  return data || null
}

async function stampNotificationEmailSent(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', notificationId)

  if (error && !isMissingRelation(error)) {
    console.error('Failed to stamp notification email:', error.message)
  }
}

async function notifyAdmins({ type, title, body, entityType = null, entityId = null, metadata = {} }) {
  const { data: admins, error } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')

  if (error) {
    console.error('Failed to load admin users for notification:', error.message)
    return
  }

  await Promise.all((admins || []).map((admin) => createNotification({
    userId: admin.id,
    type,
    title,
    body,
    entityType,
    entityId,
    metadata
  })))
}

async function createMessageNotification({ receiverId, senderName, message, applicationId, recipientEmail }) {
  const type = 'message.new'
  const title = `New message from ${senderName || 'Seraphyn'}`
  const body = message?.content?.slice(0, 160) || 'You have a new message in the Seraphyn portal.'
  const entityType = 'message'
  const entityId = message?.id || applicationId

  let notification = await getExistingNotification(receiverId, type, entityType, entityId)
  if (!notification) {
    const created = await createNotification({
      userId: receiverId,
      type,
      title,
      body,
      entityType,
      entityId,
      metadata: {
        applicationId,
        messageId: message?.id || null,
        senderName: senderName || null
      }
    })
    notification = created.notification || null
  }

  if (notification?.email_sent_at || !recipientEmail) {
    return notification
  }

  const portalBase = process.env.CLIENT_URL || process.env.VITE_APP_URL || ''
  const messageUrl = `${portalBase.replace(/\/+$/, '')}/messages?app=${applicationId}`
  const emailResult = await sendPortalEmail({
    to: recipientEmail,
    subject: title,
    text: `You have a new message in Seraphyn.\n\n${body}\n\nOpen the portal: ${messageUrl}`,
    html: `<p>You have a new message in Seraphyn.</p><p>${body}</p><p><a href="${messageUrl}">Open the portal</a></p>`
  })

  if (emailResult.success && notification?.id) {
    await stampNotificationEmailSent(notification.id)
  }

  return notification
}

module.exports = {
  createNotification,
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  notifyAdmins,
  createMessageNotification,
  getExistingNotification
}
