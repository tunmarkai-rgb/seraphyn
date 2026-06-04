import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { apiRequest } from '../lib/api'

export default function Messages() {
  const { user, profile } = useAuth()
  const [searchParams] = useSearchParams()
  const [threads, setThreads] = useState([])
  const [selectedThread, setSelectedThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState('threads')
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const bottomRef = useRef(null)
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (user) void loadThreads()
  }, [user])

  useEffect(() => {
    const appId = searchParams.get('app')
    if (appId && threads.length > 0) {
      const match = threads.find((thread) => thread.application_id === appId)
      if (match) {
        setSelectedThread(match)
        if (isMobile) setActiveView('conversation')
      }
    }
  }, [searchParams, threads, isMobile])

  useEffect(() => {
    const appId = searchParams.get('app')
    const directUserId = searchParams.get('direct')
    if ((!appId && !directUserId) || (threads.length === 0 && loading)) return
    if (appId && selectedThread?.application_id === appId) return
    if (directUserId && selectedThread?.direct_user_id === directUserId) return

    const match = appId
      ? threads.find((thread) => thread.application_id === appId)
      : threads.find((thread) => thread.direct_user_id === directUserId)

    if (match) {
      setSelectedThread(match)
      if (isMobile) setActiveView('conversation')
      return
    }

    if (appId) void loadThreadContext(appId)
    if (directUserId) void loadDirectThreadContext(directUserId)
  }, [searchParams, threads, loading, selectedThread, isMobile])

  useEffect(() => {
    if (selectedThread) {
      void loadMessages(selectedThread)
      void markAsRead(selectedThread)
    }
  }, [selectedThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadThreads() {
    setLoading(true)
    try {
      const data = await apiRequest('/api/messages/threads')
      setThreads(data || [])
    } catch (error) {
      console.error('Failed to load threads:', error.message)
      setThreads([])
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(thread) {
    try {
      const data = thread.thread_type === 'direct'
        ? await apiRequest(`/api/messages/direct/${thread.direct_user_id}`)
        : await apiRequest(`/api/messages/${thread.application_id}`)
      setMessages(data || [])
    } catch (error) {
      console.error('Failed to load messages:', error.message)
      setMessages([])
    }
  }

  async function loadDirectThreadContext(userId) {
    try {
      const thread = await apiRequest(`/api/messages/thread/direct/${userId}`)
      if (!thread) return
      setThreads((previous) => previous.some((item) => item.thread_id === thread.thread_id)
        ? previous
        : [thread, ...previous])
      setSelectedThread(thread)
      if (isMobile) setActiveView('conversation')
    } catch (error) {
      console.error('Failed to load direct thread context:', error.message)
    }
  }

  async function loadThreadContext(applicationId) {
    try {
      const thread = await apiRequest(`/api/messages/thread/${applicationId}`)
      if (!thread) return
      setThreads((previous) => previous.some((item) => item.application_id === thread.application_id)
        ? previous
        : [thread, ...previous])
      setSelectedThread(thread)
      if (isMobile) setActiveView('conversation')
    } catch (error) {
      console.error('Failed to load thread context:', error.message)
    }
  }

  async function markAsRead(thread) {
    try {
      const path = thread.thread_type === 'direct'
        ? `/api/messages/direct/${thread.direct_user_id}/read`
        : `/api/messages/${thread.application_id}/read`
      await apiRequest(path, { method: 'POST' })
    } catch (error) {
      console.error('Failed to mark thread as read:', error.message)
    }
  }

  async function sendMessage(event) {
    event.preventDefault()
    if (!newMessage.trim() || !selectedThread) return
    setSending(true)

    try {
      const data = await apiRequest('/api/messages', {
        method: 'POST',
        body: {
          applicationId: selectedThread.thread_type === 'application' ? selectedThread.application_id : undefined,
          directUserId: selectedThread.thread_type === 'direct' ? selectedThread.direct_user_id : undefined,
          content: newMessage.trim()
        }
      })

      if (data) {
        setMessages((prev) => [...prev, data])
        setNewMessage('')
        void loadThreads()
      }
    } catch (error) {
      console.error('Failed to send message:', error.message)
    } finally {
      setSending(false)
    }
  }

  function getThreadName(thread) {
    if (thread.thread_type === 'direct') {
      return thread.direct_user?.full_name || thread.direct_user?.email || 'Portal user'
    }

    const app = thread.applications
    if (!app) return 'Unknown'
    return profile?.role === 'nurse'
      ? app.employer_profiles?.org_name || 'Employer'
      : `${app.nurse_profiles?.first_name || ''} ${app.nurse_profiles?.last_name || ''}`.trim() || 'Nurse'
  }

  function getThreadSub(thread) {
    if (thread.thread_type === 'direct') {
      return thread.direct_user?.role ? `${thread.direct_user.role} conversation` : 'Direct conversation'
    }

    return thread.applications?.jobs?.title || 'Job Application'
  }

  const panel = (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: isAdmin ? 0 : '88px 24px 0' }}>
      <div style={{ display: 'flex', height: isAdmin ? 'calc(100vh - 124px)' : 'calc(100vh - 110px)', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: isMobile ? '100%' : '300px', borderRight: isMobile ? 'none' : '1px solid var(--border)', display: isMobile && activeView !== 'threads' ? 'none' : 'flex', flexDirection: 'column', flexShrink: 0 }} className="msg-sidebar">
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: '500', color: 'var(--deep-navy)' }}>Messages</h2>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>
            ) : threads.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No messages yet.</p>
              </div>
            ) : (
              threads.map((thread) => {
                const active = selectedThread?.thread_id === thread.thread_id
                return (
                  <button key={thread.thread_id || thread.application_id || thread.direct_user_id} onClick={() => { setSelectedThread(thread); if (isMobile) setActiveView('conversation') }}
                    style={{ width: '100%', padding: '16px 20px', border: 'none', textAlign: 'left', cursor: 'pointer', background: active ? 'rgba(126,181,200,0.1)' : 'transparent', borderBottom: '1px solid var(--border)', borderLeft: active ? '3px solid var(--sky-blue)' : '3px solid transparent', transition: 'all 0.15s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: active ? 'var(--sky-blue)' : 'var(--deep-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontFamily: 'Cormorant Garamond, serif', flexShrink: 0 }}>
                        {getThreadName(thread)[0]}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--deep-navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {getThreadName(thread)}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {getThreadSub(thread)}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: isMobile && activeView !== 'conversation' ? 'none' : 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!selectedThread ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>Messages</div>
                <p style={{ fontSize: '16px', color: 'var(--text-muted)' }}>Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isMobile && (
                  <button onClick={() => setActiveView('threads')} style={{ background: 'none', border: 'none', color: 'var(--sky-blue)', fontSize: '20px', cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0 }}>{'<'}</button>
                )}
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--deep-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px' }}>
                  {getThreadName(selectedThread)[0]}
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--deep-navy)' }}>{getThreadName(selectedThread)}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{getThreadSub(selectedThread)}</p>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '40px' }}>
                    No messages yet. Start the conversation below.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === user.id
                    return (
                      <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '70%', padding: '10px 14px', borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                          background: isMe ? 'var(--deep-navy)' : 'var(--warm-white)',
                          color: isMe ? 'white' : 'var(--deep-navy)',
                          border: isMe ? 'none' : '1px solid var(--border)'
                        }}>
                          <p style={{ fontSize: '14px', lineHeight: '1.5' }}>{msg.content}</p>
                          <p style={{ fontSize: '10px', marginTop: '4px', opacity: 0.6 }}>
                            {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={sendMessage} style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px' }}>
                <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  style={{ flex: 1, padding: '10px 14px', background: 'var(--warm-white)', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '14px', color: 'var(--deep-navy)', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
                <button type="submit" disabled={sending || !newMessage.trim()}
                  style={{ padding: '10px 20px', background: sending || !newMessage.trim() ? 'var(--border)' : 'var(--deep-navy)', color: sending || !newMessage.trim() ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: '2px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: '500', cursor: sending || !newMessage.trim() ? 'not-allowed' : 'pointer' }}>
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )

  if (isAdmin) {
    return <AdminLayout title="Messages">{panel}</AdminLayout>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />
      {panel}
    </div>
  )
}
