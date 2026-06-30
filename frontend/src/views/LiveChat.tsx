import React, { useEffect, useState, useRef } from 'react';
import { liveChatAPI } from '../api';
import { io, Socket } from 'socket.io-client';
import { Send, Image as ImageIcon, Loader2, Phone, Video, MoreVertical, ShieldCheck, User, ArrowLeft } from 'lucide-react';
import { formatGlobalDate } from '../utils/dateFormatter';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !session) return;

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
  }, [session]);

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

  const handleTypingChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
    
    if (socket && session) {
      socket.emit('live_chat_typing', { isTyping: true });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        socket?.emit('live_chat_typing', { isTyping: false });
      }, 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    autoResizeTextarea();
  }, [messageInput]);

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
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="spin" size={32} color="var(--accent-primary)" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in chat-app-container">
      {/* App-like Header */}
      <div className="chat-app-header">
        <div className="chat-app-header-left">
          <button onClick={() => window.history.back()} className="chat-back-btn">
            <ArrowLeft size={24} />
          </button>
          <div className="chat-avatar">
            <User size={24} color="#fff" />
            <span className="online-indicator"></span>
          </div>
          <div className="chat-user-info">
            <h3>Support Team</h3>
            <span className="chat-status-text">Live • Online</span>
          </div>
        </div>
        <div className="chat-app-header-right">
          <button className="chat-icon-btn"><MoreVertical size={20} /></button>
        </div>
      </div>

      <div className="chat-app-body">
        {/* End-to-end encryption notice */}
        <div className="encryption-notice">
          <ShieldCheck size={14} /> Messages are secured. No one outside of this chat, not even third parties, can read them.
        </div>

        {/* Chat Messages */}
        <div className="chat-messages-container hide-scrollbar">
          <div className="chat-date-divider">
            <span>Chat started. A support agent will be with you shortly.</span>
          </div>

          {messages.map((msg, index) => {
            const isUser = msg.sender_type === 'user';
            const showDate = index === 0 || new Date(msg.created_at).getDate() !== new Date(messages[index - 1].created_at).getDate();

            return (
              <React.Fragment key={index}>
                {showDate && (
                  <div className="chat-date-divider">
                    <span>{formatGlobalDate(msg.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                )}
                
                <div className={`chat-bubble-wrapper ${isUser ? 'is-user' : 'is-agent'}`}>
                  <div className="chat-bubble">
                    {msg.attachment_url && (
                      <div style={{ marginBottom: '8px' }}>
                        <img src={`${import.meta.env.VITE_API_URL}${msg.attachment_url}`} alt="Attachment" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                      </div>
                    )}
                    <div className="chat-bubble-text">{msg.message}</div>
                    <div className="chat-bubble-time">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          
          {isTyping && (
            <div className="chat-bubble-wrapper is-agent">
              <div className="chat-bubble typing-bubble">
                <span className="typing-dot"></span>
                <span className="typing-dot" style={{ animationDelay: '0.2s' }}></span>
                <span className="typing-dot" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Area */}
        <div className="chat-input-container">
          <form onSubmit={handleSendMessage} className="chat-input-form">
            <textarea 
              ref={textareaRef}
              className="chat-textarea"
              placeholder="Message Support Team..."
              value={messageInput}
              onChange={handleTypingChange}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button 
              type="submit" 
              className={`chat-send-btn ${messageInput.trim() ? 'active' : ''}`} 
              disabled={sending || !messageInput.trim()}
            >
              {sending ? <Loader2 size={20} className="spin" /> : <Send size={20} style={{ transform: 'translateX(2px)' }} />}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        .chat-app-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 120px);
          max-width: 1000px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0,0,0,0.08);
          border: 1px solid #e5e7eb;
          position: relative;
        }

        .chat-app-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          z-index: 10;
        }

        .chat-app-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .chat-back-btn {
          background: transparent;
          border: none;
          color: #6b7280;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          border-radius: 50%;
          transition: 0.2s ease;
        }
        
        .chat-back-btn:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .chat-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #9ca3af;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .online-indicator {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 12px;
          height: 12px;
          background: #22c55e;
          border: 2px solid #ffffff;
          border-radius: 50%;
        }

        .chat-user-info h3 {
          margin: 0 0 4px 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: #111827;
        }

        .chat-status-text {
          font-size: 0.85rem;
          color: #6b7280;
          display: block;
        }

        .chat-app-header-right {
          display: flex;
          gap: 8px;
        }

        .chat-icon-btn {
          background: transparent;
          border: none;
          color: #6b7280;
          cursor: pointer;
          padding: 10px;
          border-radius: 50%;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chat-icon-btn:hover {
          background: #f3f4f6;
          color: var(--accent-primary, #3b82f6);
        }

        .chat-app-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #f0f2f5; /* Light app-like background */
          position: relative;
          overflow: hidden;
        }

        .encryption-notice {
          text-align: center;
          font-size: 0.75rem;
          color: #6b7280;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: rgba(0,0,0,0.02);
        }

        .chat-messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .chat-date-divider {
          text-align: center;
          margin: 16px 0;
        }
        
        .chat-date-divider span {
          background: #e5e7eb;
          padding: 6px 14px;
          border-radius: 12px;
          font-size: 0.75rem;
          color: #4b5563;
        }

        .chat-bubble-wrapper {
          display: flex;
          flex-direction: column;
          width: 100%;
        }

        .chat-bubble-wrapper.is-user {
          align-items: flex-end;
        }

        .chat-bubble-wrapper.is-agent {
          align-items: flex-start;
        }

        .chat-bubble {
          max-width: 75%;
          padding: 12px 16px;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }

        .is-user .chat-bubble {
          background: #dcf8c6;
          color: #111827;
          border-radius: 20px 20px 4px 20px;
        }

        .is-agent .chat-bubble {
          background: #ffffff;
          color: #111827;
          border-radius: 20px 20px 20px 4px;
          border: 1px solid #e5e7eb;
        }
        
        .typing-bubble {
          display: flex;
          flex-direction: row !important;
          align-items: center;
          gap: 4px !important;
          padding: 16px !important;
        }

        .chat-bubble-text {
          font-size: 0.95rem;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .chat-bubble-time {
          font-size: 0.7rem;
          align-self: flex-end;
          opacity: 0.7;
          margin-top: 2px;
        }

        .is-user .chat-bubble-time {
          color: #6b7280;
        }
        
        .is-agent .chat-bubble-time {
          color: #6b7280;
        }

        .chat-input-container {
          padding: 16px 24px;
          background: #ffffff;
          border-top: 1px solid #e5e7eb;
        }

        .chat-input-form {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          background: #f3f4f6;
          border-radius: 24px;
          padding: 8px 12px;
          border: 1px solid transparent;
          transition: all 0.3s;
        }
        
        .chat-input-form:focus-within {
          border-color: var(--accent-primary, #3b82f6);
          background: #ffffff;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        .chat-textarea {
          flex: 1;
          background: transparent;
          border: none;
          color: #111827;
          padding: 10px 12px;
          font-size: 0.95rem;
          resize: none;
          max-height: 120px;
          min-height: 24px;
          outline: none;
          font-family: inherit;
        }

        .chat-textarea::placeholder {
          color: #9ca3af;
        }

        .chat-send-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #e5e7eb;
          border: none;
          color: #9ca3af;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
          flex-shrink: 0;
        }

        .chat-send-btn.active {
          background: var(--accent-primary, #3b82f6);
          color: #ffffff;
          box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
        }

        .typing-dot {
          width: 6px;
          height: 6px;
          background: #9ca3af;
          border-radius: 50%;
          animation: typing 1s infinite alternate;
        }
        
        @keyframes typing {
          0% { transform: translateY(0); opacity: 0.5; }
          100% { transform: translateY(-4px); opacity: 1; }
        }

        @media (max-width: 768px) {
          .chat-app-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            height: 100dvh;
            z-index: 9999;
            border-radius: 0;
            border: none;
            margin: 0;
          }
          
          .chat-app-header {
            padding: 12px 16px;
          }
          
          .chat-messages-container {
            padding: 16px;
          }
          
          .chat-input-container {
            padding: 12px;
          }
          
          .chat-avatar {
            width: 40px;
            height: 40px;
          }
        }
      `}</style>
    </div>
  );
};
