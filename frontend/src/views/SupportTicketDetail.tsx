import React, { useState, useEffect, useRef } from 'react';
import { supportAPI } from '../api';
import { ArrowLeft, Send, CheckCircle2, AlertCircle, Phone, Video, MoreVertical, ShieldCheck, User } from 'lucide-react';
import { formatGlobalDate } from '../utils/dateFormatter';

interface Props {
  ticketId: string | number;
  onBack: () => void;
  user: any;
}

export const SupportTicketDetail: React.FC<Props> = ({ ticketId, onBack, user }) => {
  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTicket = async () => {
    try {
      const data = await supportAPI.getTicket(ticketId);
      setTicket(data.ticket);
      setMessages(data.messages);
      setTimeout(() => scrollToBottom(), 100);
    } catch (err) {
      console.error('Failed to load ticket', err);
      setError('Ticket not found or unauthorized.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
    const interval = setInterval(fetchTicket, 10000); // Poll for new replies
    return () => clearInterval(interval);
  }, [ticketId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await supportAPI.replyTicket(ticketId, reply);
      setReply('');
      fetchTicket();
    } catch (err: any) {
      setError(err.message || 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    if (!window.confirm('Are you sure you want to close this conversation?')) return;
    try {
      await supportAPI.closeTicket(ticketId);
      fetchTicket();
    } catch (err: any) {
      setError(err.message || 'Failed to close conversation.');
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spin"><CheckCircle2 size={32} color="var(--accent-primary)" /></div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', height: '100vh' }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ marginBottom: '20px' }}>&larr; Back</button>
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--accent-danger)' }}>
          <AlertCircle size={48} style={{ margin: '0 auto 16px' }} />
          <h3>{error || 'Conversation not found'}</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in chat-app-container">
      {/* App-like Header */}
      <div className="chat-app-header">
        <div className="chat-app-header-left">
          <button onClick={onBack} className="chat-back-btn">
            <ArrowLeft size={24} />
          </button>
          <div className="chat-avatar">
            <User size={24} color="#fff" />
            <span className="online-indicator"></span>
          </div>
          <div className="chat-user-info">
            <h3>Support Team</h3>
            <span className="chat-status-text">
              {ticket.status === 'closed' ? 'Offline (Closed)' : 'Online'} • {ticket.subject}
            </span>
          </div>
        </div>
        <div className="chat-app-header-right">
          {ticket.status !== 'closed' && (
            <button onClick={handleClose} className="chat-icon-btn" title="Mark as resolved">
              <CheckCircle2 size={20} />
            </button>
          )}
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
          {messages.map((msg, index) => {
            const isUser = msg.sender_type === 'user';
            
            // Group messages by date roughly (simple implementation)
            const showDate = index === 0 || new Date(msg.created_at).getDate() !== new Date(messages[index - 1].created_at).getDate();

            return (
              <React.Fragment key={msg.id}>
                {showDate && (
                  <div className="chat-date-divider">
                    <span>{formatGlobalDate(msg.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                )}
                
                <div className={`chat-bubble-wrapper ${isUser ? 'is-user' : 'is-agent'}`}>
                  <div className="chat-bubble">
                    <div className="chat-bubble-text">{msg.message}</div>
                    <div className="chat-bubble-time">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Area */}
        {ticket.status === 'closed' ? (
          <div className="chat-closed-notice">
            This conversation is closed. Please open a new ticket for further assistance.
          </div>
        ) : (
          <div className="chat-input-container">
            <form onSubmit={handleSend} className="chat-input-form">
              <textarea
                className="chat-textarea"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Message Support Team..."
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
              />
              <button 
                type="submit" 
                disabled={sending || !reply.trim()} 
                className={`chat-send-btn ${reply.trim() ? 'active' : ''}`}
              >
                <Send size={20} style={{ transform: 'translateX(2px)' }} />
              </button>
            </form>
          </div>
        )}
      </div>

      <style>{`
        .chat-app-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 80px);
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

        .chat-closed-notice {
          padding: 20px;
          text-align: center;
          background: #ffffff;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 0.9rem;
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
