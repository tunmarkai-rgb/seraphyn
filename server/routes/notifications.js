const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const {
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead
} = require('../lib/notifications')

router.use(requireAuth)

router.get('/', async (req, res) => {
  const unreadOnly = req.query.unread === 'true'
  const limit = Math.min(parseInt(req.query.limit || '25', 10), 100)
  const notifications = await listNotificationsForUser(req.user.id, { unreadOnly, limit })
  const unreadOnlyNotifications = await listNotificationsForUser(req.user.id, { unreadOnly: true, limit: 100 })
  const unreadCount = unreadOnlyNotifications.length

  res.json({
    notifications,
    unreadCount
  })
})

router.post('/:id/read', async (req, res) => {
  const notification = await markNotificationRead(req.user.id, req.params.id)
  res.json({ notification })
})

router.post('/read-all', async (req, res) => {
  await markAllNotificationsRead(req.user.id)
  res.json({ message: 'Notifications marked as read' })
})

module.exports = router
