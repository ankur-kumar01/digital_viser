import React, { useEffect, useState, useRef } from 'react';
import { adminAPI } from '../../api';
import { io, Socket } from 'socket.io-client';
import { Send, Image as ImageIcon, CheckCheck, Loader2, User, Search, RefreshCw } from 'lucide-react';
import { formatGlobalDate } from '../../utils/dateFormatter';

export const AdminLiveChat: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    const newSocket = io(import.meta.env.VITE_API_URL || '', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      newSocket.emit('join_live_chat');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Fetch all sessions
  const fetchSessions = async () => {
    try {
      const data = await adminAPI.getLiveChatSessions();
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch chat sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // Socket message listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: any) => {
      // Data looks like: { sender_type: 'user', user_id: 123, message: '...', created_at: '...' }
      
      // Update session list order & unread count
      setSessions(prev => {
        const updated = [...prev];
        const sessionIndex = updated.findIndex(s => s.user_id === data.user_id);
        
        if (sessionIndex > -1) {
          const session = updated[sessionIndex];
          session.last_message_at = data.created_at;
          // Only increment unread if it's from a user AND it's not the active session
          if (data.sender_type === 'user' && session.id !== activeSessionId) {
            session.user_unread_count = (session.user_unread_count || 0) + 1;
          }
          // Move to top
          updated.splice(sessionIndex, 1);
          updated.unshift(session);
        } else if (data.sender_type === 'user') {
          // New session entirely! Refresh list.
          fetchSessions();
        }
        return updated;
      });

      // Update active messages if this message belongs to the current open chat
      if (activeSessionId) {
        const activeSession = sessions.find(s => s.id === activeSessionId);
        if (activeSession && activeSession.user_id === data.user_id) {
          setMessages(prev => [...prev, data]);
          
          // Since we are viewing it, optionally tell server to mark as read here (or let them fetch again on reload)
          // Just reset local unread to 0
          setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, user_unread_count: 0 } : s));
        }
      }
    };

    socket.on('new_live_chat_message', handleNewMessage);

    return () => {
      socket.off('new_live_chat_message', handleNewMessage);
    };
  }, [socket, activeSessionId, sessions]);

  // Load messages for a session
  useEffect(() => {
    if (!activeSessionId) return;

    const loadMessages = async () => {
      setMessagesLoading(true);
      try {
        const msgs = await adminAPI.getLiveChatMessages(activeSessionId);
        setMessages(msgs);
        
        // Clear local unread
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, user_unread_count: 0 } : s));
      } catch (err) {
        console.error('Failed to load messages');
      } finally {
        setMessagesLoading(false);
      }
    };

    loadMessages();
  }, [activeSessionId]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    if (!activeSessionId) return;

    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;

    setSending(true);

    try {
      // If there's a file, we MUST use the REST API to upload it
      if (fileInputRef.current?.files?.length) {
        const formData = new FormData();
        formData.append('message', messageInput);
        formData.append('attachment', fileInputRef.current.files[0]);
        
        const res = await adminAPI.sendLiveChatMessage(activeSessionId, formData);
        
        // Emit socket so user sees it instantly
        socket?.emit('live_chat_message', {
          message: messageInput,
          sessionId: activeSessionId,
          targetUserId: session.user_id,
          attachment_url: res.message.attachment_url
        });

        setMessages(prev => [...prev, res.message]);
        
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        // Just text, emit socket for instant delivery
        socket?.emit('live_chat_message', {
          message: messageInput,
          sessionId: activeSessionId,
          targetUserId: session.user_id
        });

        // Optimistic UI update
        const newMsg = {
          id: Date.now(),
          session_id: activeSessionId,
          sender_type: 'admin',
          message: messageInput,
          created_at: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, newMsg]);
        
        // Let REST API save it in background so attachments logic is consistent, or we can just rely on REST for everything.
        // Actually, to make sure it saves in DB, let's just REST call it too.
        const formData = new FormData();
        formData.append('message', messageInput);
        adminAPI.sendLiveChatMessage(activeSessionId, formData).catch(console.error);
      }

      setMessageInput('');
    } catch (err) {
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase()) || 
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.user_id.toString().includes(search)
  );

  const activeSessionDetails = sessions.find(s => s.id === activeSessionId);

  return (
    <div className="animate-fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            Live Support Chat
            <span className="badge badge-active" style={{ fontSize: '0.8rem' }}>Live</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Real-time WhatsApp style chat with users</p>
        </div>
        <button onClick={fetchSessions} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="glass-card" style={{ flex: 1, padding: 0, display: 'flex', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
        
        {/* Left Pane: Users List */}
        <div style={{ width: '320px', borderRight: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', background: 'var(--bg-tertiary)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-glass)' }}>
            <div className="search-box" style={{ margin: 0 }}>
              <Search size={18} />
              <input 
                type="text" 
                placeholder="Search user..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }} className="hide-scrollbar">
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}><Loader2 className="spin" size={24} style={{ margin: '0 auto' }} /></div>
            ) : filteredSessions.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No active chats found.</div>
            ) : (
              filteredSessions.map(session => (
                <div 
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  style={{ 
                    padding: '16px', 
                    borderBottom: '1px solid var(--border-glass)',
                    cursor: 'pointer',
                    background: activeSessionId === session.id ? 'var(--accent-primary-glow)' : 'transparent',
                    borderLeft: activeSessionId === session.id ? '3px solid var(--accent-primary)' : '3px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    <User size={20} />
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {session.name} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>#{session.user_id}</span>
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(session.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {session.email}
                    </div>
                  </div>
                  {session.user_unread_count > 0 && (
                    <div style={{ background: 'var(--accent-primary)', color: '#000', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                      {session.user_unread_count}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Pane: Chat Window */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
          {activeSessionId ? (
            <>
              {/* Chat Header */}
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  <User size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{activeSessionDetails?.name}</h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}>Online</div>
                </div>
              </div>

              {/* Chat Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="hide-scrollbar">
                {messagesLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}><Loader2 className="spin" /></div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No messages in this conversation yet.</div>
                ) : (
                  messages.map((msg, idx) => {
                    const isAdmin = msg.sender_type === 'admin';
                    return (
                      <div key={idx} style={{ alignSelf: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                        <div style={{
                          background: isAdmin ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                          color: isAdmin ? '#000' : 'var(--text-primary)',
                          padding: '12px 16px',
                          borderRadius: '16px',
                          borderBottomRightRadius: isAdmin ? '4px' : '16px',
                          borderBottomLeftRadius: isAdmin ? '16px' : '4px',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                        }}>
                          {msg.attachment_url && (
                            <div style={{ marginBottom: '8px' }}>
                              <img src={`${import.meta.env.VITE_API_URL}${msg.attachment_url}`} alt="Attachment" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                            </div>
                          )}
                          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.95rem' }}>
                            {msg.message}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: isAdmin ? 'rgba(0,0,0,0.6)' : 'var(--text-muted)', marginTop: '4px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '4px', alignItems: 'center' }}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {isAdmin && <CheckCheck size={14} color="rgba(0,0,0,0.6)" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-glass)', background: 'var(--bg-tertiary)' }}>
                <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {/* Temporarily disabled image upload
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="btn btn-secondary" style={{ padding: '12px', borderRadius: '50%' }}>
                    <ImageIcon size={20} />
                  </button>
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" />
                  */}
                  
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    style={{ flex: 1, borderRadius: 'var(--radius-full)', padding: '12px 20px', background: 'var(--bg-secondary)' }}
                  />
                  
                  <button type="submit" className="btn btn-primary" style={{ padding: '12px', borderRadius: '50%' }} disabled={sending || !messageInput.trim()}>
                    {sending ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '16px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={40} color="var(--accent-primary)" />
              </div>
              <h3 style={{ margin: 0 }}>Digital Viser Live Support</h3>
              <p>Select a user from the left pane to start chatting.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
