import React, { useState, useEffect, useRef } from 'react';
import { supportAPI } from '../api';
import { ArrowLeft, Send, CheckCircle2, AlertCircle } from 'lucide-react';
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
    if (!window.confirm('Are you sure you want to close this ticket?')) return;
    try {
      await supportAPI.closeTicket(ticketId);
      fetchTicket();
    } catch (err: any) {
      setError(err.message || 'Failed to close ticket.');
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Ticket...</div>;
  }

  if (!ticket) {
    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ marginBottom: '20px' }}>&larr; Back</button>
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--accent-danger)' }}>
          <AlertCircle size={48} style={{ margin: '0 auto 16px' }} />
          <h3>{error || 'Ticket not found'}</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <button onClick={onBack} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>#{ticket.id} - {ticket.subject}</h2>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', gap: '12px', marginTop: '4px' }}>
            <span style={{ textTransform: 'capitalize' }}>Status: <strong style={{ color: ticket.status === 'open' ? '#3b82f6' : ticket.status === 'pending' ? '#f59e0b' : '#6b7280' }}>{ticket.status}</strong></span>
            <span>Priority: <strong style={{ textTransform: 'capitalize' }}>{ticket.priority}</strong></span>
            <span>Created: {formatGlobalDate(ticket.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
        {ticket.status !== 'closed' && (
          <button onClick={handleClose} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} /> Mark Closed
          </button>
        )}
      </div>

      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        {/* Chat Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(0,0,0,0.1)' }}>
          {messages.map((msg) => {
            const isUser = msg.sender_type === 'user';
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', padding: '0 4px' }}>
                  {isUser ? 'You' : 'Support Team'} • {formatGlobalDate(msg.created_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{
                  background: isUser ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: isUser ? '#fff' : 'var(--text-primary)',
                  padding: '12px 16px',
                  borderRadius: '16px',
                  borderBottomRightRadius: isUser ? '4px' : '16px',
                  borderBottomLeftRadius: isUser ? '16px' : '4px',
                  maxWidth: '80%',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                }}>
                  {msg.message}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {ticket.status === 'closed' ? (
          <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            This ticket is closed. If you need further assistance, please open a new ticket.
          </div>
        ) : (
          <form onSubmit={handleSend} style={{ padding: '16px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px' }}>
            <textarea
              className="input-field"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your reply here..."
              style={{ flex: 1, minHeight: '50px', maxHeight: '150px', resize: 'vertical', padding: '12px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />
            <button type="submit" disabled={sending || !reply.trim()} className="btn btn-primary" style={{ width: '50px', height: '50px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', alignSelf: 'flex-end' }}>
              <Send size={20} style={{ transform: 'translateX(2px)' }} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
