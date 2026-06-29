import React, { useEffect, useState, useRef } from 'react';
import { liveChatAPI } from '../api';
import { io, Socket } from 'socket.io-client';
import { Send, Image as ImageIcon, Loader2, HelpCircle } from 'lucide-react';

export const LiveChat: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem('token');
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

  // Fetch session and messages
  useEffect(() => {
    const fetchChat = async () => {
      try {
        const data = await liveChatAPI.getLiveChatSession();
        setSession(data.session);
        setMessages(data.messages);
      } catch (err) {
        console.error('Failed to fetch chat session');
      } finally {
        setLoading(false);
      }
    };

    fetchChat();
  }, []);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: any) => {
      // Data looks like: { sender_type: 'admin', message: '...', created_at: '...' }
      setMessages(prev => [...prev, data]);
    };

    const handleTyping = (data: any) => {
      if (data.sender_type === 'admin') {
        setIsTyping(data.isTyping);
      }
    };

    socket.on('new_live_chat_message', handleNewMessage);
    socket.on('live_chat_typing', handleTyping);

    return () => {
      socket.off('new_live_chat_message', handleNewMessage);
      socket.off('live_chat_typing', handleTyping);
    };
  }, [socket]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleTypingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    
    if (socket && session) {
      socket.emit('live_chat_typing', { isTyping: true });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('live_chat_typing', { isTyping: false });
      }, 2000);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    if (!session) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket?.emit('live_chat_typing', { isTyping: false });

    setSending(true);

    try {
      if (fileInputRef.current?.files?.length) {
        const formData = new FormData();
        formData.append('message', messageInput);
        formData.append('attachment', fileInputRef.current.files[0]);
        
        const res = await liveChatAPI.sendLiveChatMessage(formData);
        
        socket?.emit('live_chat_message', {
          message: messageInput,
          sessionId: session.id,
          attachment_url: res.message.attachment_url
        });

        setMessages(prev => [...prev, res.message]);
        
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        socket?.emit('live_chat_message', {
          message: messageInput,
          sessionId: session.id
        });

        const newMsg = {
          id: Date.now(),
          session_id: session.id,
          sender_type: 'user',
          message: messageInput,
          created_at: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, newMsg]);
        
        const formData = new FormData();
        formData.append('message', messageInput);
        liveChatAPI.sendLiveChatMessage(formData).catch(console.error);
      }

      setMessageInput('');
    } catch (err) {
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Loader2 className="spin" size={32} style={{ margin: '0 auto' }} />
        <p style={{ marginTop: '16px' }}>Connecting to Live Support...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            Live Support <span className="badge badge-active" style={{ fontSize: '0.8rem' }}>Online</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Chat directly with our support team</p>
        </div>
      </div>

      <div className="glass-card glow-card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--accent-primary)' }}>
        
        {/* Chat Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-glass)', background: 'rgba(0, 245, 160, 0.05)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
            <HelpCircle size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent-primary)' }}>Digital Viser Support</h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Typically replies in a few minutes</div>
          </div>
        </div>

        {/* Chat Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-secondary)' }} className="hide-scrollbar">
          
          <div style={{ alignSelf: 'center', background: 'var(--bg-tertiary)', padding: '8px 16px', borderRadius: '20px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Chat started. A support agent will be with you shortly.
          </div>

          {messages.map((msg, idx) => {
            const isUser = msg.sender_type === 'user';
            return (
              <div key={idx} style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                <div style={{
                  background: isUser ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: isUser ? '#000' : 'var(--text-primary)',
                  padding: '12px 16px',
                  borderRadius: '16px',
                  borderBottomRightRadius: isUser ? '4px' : '16px',
                  borderBottomLeftRadius: isUser ? '16px' : '4px',
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
                  <div style={{ fontSize: '0.7rem', color: isUser ? 'rgba(0,0,0,0.6)' : 'var(--text-muted)', marginTop: '4px', textAlign: isUser ? 'right' : 'left' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
          
          {isTyping && (
            <div style={{ alignSelf: 'flex-start', maxWidth: '75%' }}>
              <div style={{ background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: '16px', borderBottomLeftRadius: '4px', display: 'flex', gap: '4px' }}>
                <span className="typing-dot"></span>
                <span className="typing-dot" style={{ animationDelay: '0.2s' }}></span>
                <span className="typing-dot" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
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
              placeholder="Type your message here..."
              value={messageInput}
              onChange={handleTypingChange}
              style={{ flex: 1, borderRadius: 'var(--radius-full)', padding: '12px 20px', background: 'var(--bg-secondary)' }}
            />
            
            <button type="submit" className="btn btn-primary" style={{ padding: '12px', borderRadius: '50%' }} disabled={sending || !messageInput.trim()}>
              {sending ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
            </button>
          </form>
        </div>

      </div>

      <style>{`
        .typing-dot {
          width: 6px;
          height: 6px;
          background: var(--text-secondary);
          border-radius: 50%;
          animation: typing 1s infinite alternate;
        }
        @keyframes typing {
          0% { transform: translateY(0); opacity: 0.5; }
          100% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
