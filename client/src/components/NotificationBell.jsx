import { useEffect, useMemo, useState } from 'react'
import { Bell } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../lib/api'
import { useAuth } from '../context/AuthContext'

function resolveNotificationLink(item, role) {
  if (item.metadata?.applicationId) {
    return `/messages?app=${item.metadata.applicationId}`
  }

  if (item.metadata?.directUserId) {
    return `/messages?direct=${item.metadata.directUserId}`
  }

  if (item.entity_type === 'application') {
    return role === 'admin' ? '/admin/applications' : '/messages'
  }

  if (item.entity_type === 'nurse_profile') {
    return role === 'admin' ? '/admin/nurses' : '/nurse/profile'
  }

  if (item.entity_type === 'employer_profile') {
    return role === 'admin' ? '/admin/employers' : '/employer/dashboard'
  }

  return role === 'admin' ? '/admin' : '/messages'
}

export default function NotificationBell({ tone = 'dark' }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const role = profile?.role

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  )

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const data = await apiRequest('/api/notifications?limit=12')
        if (active) {
          setNotifications(data.notifications || [])
        }
      } catch {
        if (active) {
          setNotifications([])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()
    const interval = window.setInterval(load, 30000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  async function markOneRead(notificationId) {
    try {
      await apiRequest(`/api/notifications/${notificationId}/read`, {
        method: 'POST'
      })
      setNotifications((prev) => prev.map((item) => (
        item.id === notificationId
          ? { ...item, read: true, read_at: new Date().toISOString() }
          : item
      )))
    } catch {
      // Keep navigation smooth even if the read stamp fails.
    }
  }

  async function markAllRead() {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' })
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))
    } catch {
      // Ignore and keep the panel usable.
    }
  }

  async function handleOpenNotification(item) {
    setOpen(false)
    if (!item.read) {
      await markOneRead(item.id)
    }
    navigate(resolveNotificationLink(item, role))
  }

  const borderColor = tone === 'light' ? 'rgba(245,245,240,0.24)' : 'var(--border)'
  const iconColor = tone === 'light' ? 'rgba(245,245,240,0.92)' : 'var(--deep-navy)'
  const fallbackLink = role === 'admin' ? '/admin' : '/messages'

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((value) => !value)}
        style={{
          position: 'relative',
          width: '38px',
          height: '38px',
          borderRadius: '999px',
          border: `1px solid ${borderColor}`,
          background: 'transparent',
          color: iconColor,
          cursor: 'pointer',
          fontSize: '16px'
        }}
        aria-label="Notifications"
      >
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-2px',
              minWidth: '18px',
              height: '18px',
              borderRadius: '999px',
              background: 'var(--warm-gold)',
              color: 'white',
              fontSize: '10px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 5px'
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <Bell size={16} strokeWidth={2.1} aria-hidden="true" />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '48px',
            right: 0,
            width: '340px',
            maxHeight: '420px',
            overflowY: 'auto',
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: '0 20px 40px rgba(44,62,80,0.14)',
            zIndex: 120
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--deep-navy)' }}>Notifications</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{unreadCount} unread</p>
            </div>
            <button
              onClick={markAllRead}
              style={{ border: 'none', background: 'none', color: 'var(--sky-blue)', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
            >
              Mark all read
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '18px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>Loading...</div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '24px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
              No notifications yet.
            </div>
          ) : (
            notifications.map((item) => (
              <button
                key={item.id}
                onClick={() => handleOpenNotification(item)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 16px',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  background: item.read ? 'white' : 'rgba(126,181,200,0.08)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '5px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--deep-navy)' }}>{item.title}</p>
                  {!item.read && (
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warm-gold)', flexShrink: 0 }} />
                  )}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.45' }}>{item.body}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  {new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </button>
            ))
          )}

          <div style={{ padding: '12px 16px' }}>
            <Link
              to={fallbackLink}
              onClick={() => setOpen(false)}
              style={{ fontSize: '12px', color: 'var(--sky-blue)', textDecoration: 'none' }}
            >
              Open messages
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
