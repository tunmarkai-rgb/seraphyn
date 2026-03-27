import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'

export default function Messages() {
  const { user, profile } = useAuth()
  const [threads, setThreads] = useState([])
  const [selectedThread, setSelectedThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (user) loadThreads()
  }, [user])

  useEffect(() => {
    if (selectedThread) {
      loadMessages(selectedThread)
      markAsRead(selectedThread)
    }
  }, [selectedThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadThreads() {
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select(`
        application_id,
        applications(
          id, status,
          jobs(title, city, state),
          nurse_profiles(first_name, last_name),
          employer_profiles(org_name)
        )
      `)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    // Deduplicate by application_id
    const seen = new Set()
    const unique = (data || []).filter(m => {
      if (!m.application_id || seen.has(m.application_id)) return false
      seen.add(m.application_id)
      return true
    })
    setThreads(unique)
    setLoading(false)
  }

  async function loadMessages(thread) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('application_id', thread.application_id)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }

  async function markAsRead(thread) {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('application_id', thread.application_id)
      .eq('receiver_id', user.id)
      .eq('read', false)
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedThread) return
    setSending(true)

    const app = selectedThread.applications
    const receiverId = profile?.role === 'nurse'
      ? app?.employer_profiles?.user_id
      : app?.nurse_profiles?.user_id

    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      application_id: selectedThread.application_id,
      content: newMessage.trim(),
      read: false
    }).select().single()

    if (!error && data) {
      setMessages(prev => [...prev, data])
      setNewMessage('')
    }
    setSending(false)
  }

  function getThreadName(thread) {
    const app = thread.applications
    if (!app) return 'Unknown'
    return profile?.role === 'nurse'
      ? app.employer_profiles?.org_name || 'Employer'
      : `${app.nurse_profiles?.first_name || ''} ${app.nurse_profiles?.last_name || ''}`.trim() || 'Nurse'
  }

  function getThreadSub(thread) {
    return thread.applications?.jobs?.title || 'Job Application'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--warm-white)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '88px 24px 0' }}>
        <div style={{ display: 'flex', height: 'calc(100vh - 110px)', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>

          {/* Thread list */}
          <div style={{ width: '300px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }} className="msg-sidebar">
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
                threads.map(thread => {
                  const active = selectedThread?.application_id === thread.application_id
                  return (
                    <button key={thread.application_id} onClick={() => setSelectedThread(thread)}
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

          {/* Message area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {!selectedThread ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '40px', marginBottom: '16px' }}>💬</div>
                  <p style={{ fontSize: '16px', color: 'var(--text-muted)' }}>Select a conversation</p>
                </div>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--deep-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'Cormorant Garamond, serif', fontSize: '16px' }}>
                    {getThreadName(selectedThread)[0]}
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--deep-navy)' }}>{getThreadName(selectedThread)}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{getThreadSub(selectedThread)}</p>
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '40px' }}>
                      No messages yet. Start the conversation below.
                    </div>
                  ) : (
                    messages.map(msg => {
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

                {/* Input */}
                <form onSubmit={sendMessage} style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px' }}>
                  <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
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
    </div>
  )
}
