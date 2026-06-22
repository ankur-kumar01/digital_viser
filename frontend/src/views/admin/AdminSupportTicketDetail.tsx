import React, { useState, useEffect, useRef } from 'react';
import { adminSupportAPI } from '../../api';
import { ArrowLeft, Send, Save, AlertCircle } from 'lucide-react';
import { formatGlobalDate } from '../../utils/dateFormatter';

interface Props {
  ticketId: string | number;
  onBack: () => void;
}

export const AdminSupportTicketDetail: React.FC<Props> = ({ ticketId, onBack }) => {
  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const fetchTicket = async () => {
    try {
      const data = await adminSupportAPI.getTicket(ticketId);
      setTicket(data.ticket);
      setMessages(data.messages);
      setStatus(data.ticket.status);
      setPriority(data.ticket.priority);
      setTimeout(() => scrollToBottom(), 100);
    } catch (err) {
      console.error('Failed to load ticket', err);
      setError('Ticket not found.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
    const interval = setInterval(fetchTicket, 10000);
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
      await adminSupportAPI.replyTicket(ticketId, reply);
      setReply('');
      fetchTicket();
    } catch (err: any) {
      setError(err.message || 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async () => {
    setUpdating(true);
    try {
      await adminSupportAPI.updateStatus(ticketId, status, priority);
      fetchTicket();
      alert('Ticket updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update ticket.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Ticket...</div>;
  }

  if (!ticket) {
    return (
      <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ marginBottom: '20px' }}>&larr; Back</button>
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--accent-danger)' }}>
          <AlertCircle size={48} style={{ margin: '0 auto 16px' }} />
          <h3>{error || 'Ticket not found'}</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', height: 'calc(100vh - 120px)', display: 'flex', gap: '20px' }}>
      
      {/* Left side: Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <button onClick={onBack} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>#{ticket.id} - {ticket.subject}</h2>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              User: <strong>{ticket.user_name} ({ticket.user_email})</strong>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(0,0,0,0.1)' }}>
            {messages.map((msg) => {
              const isAdmin = msg.sender_type === 'admin';
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', padding: '0 4px' }}>
                    {isAdmin ? 'You (Admin)' : ticket.user_name} • {formatGlobalDate(msg.created_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{
                    background: isAdmin ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: isAdmin ? '#fff' : 'var(--text-primary)',
                    padding: '12px 16px',
                    borderRadius: '16px',
                    borderBottomRightRadius: isAdmin ? '4px' : '16px',
                    borderBottomLeftRadius: isAdmin ? '16px' : '4px',
                    maxWidth: '85%',
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

          <form onSubmit={handleSend} style={{ padding: '16px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px' }}>
            <textarea
              className="input-field"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your reply here to the user..."
              style={{ flex: 1, minHeight: '60px', maxHeight: '150px', resize: 'vertical', padding: '12px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />
            <button type="submit" disabled={sending || !reply.trim()} className="btn btn-primary" style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px', alignSelf: 'flex-end', height: '60px' }}>
              <Send size={18} /> Reply
            </button>
          </form>
        </div>
      </div>

      {/* Right side: Ticket Info / Controls */}
      <div className="glass-card" style={{ width: '300px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', height: 'fit-content' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Ticket Details</h3>
        
        <div>
          <label className="input-label" style={{ fontSize: '0.85rem' }}>Status</label>
          <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="open">Open</option>
            <option value="pending">Pending Reply</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div>
          <label className="input-label" style={{ fontSize: '0.85rem' }}>Priority</label>
          <select className="input-field" value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label className="input-label" style={{ fontSize: '0.85rem' }}>Category</label>
          <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', textTransform: 'capitalize', fontSize: '0.95rem' }}>
            {ticket.category}
          </div>
        </div>

        <div>
          <label className="input-label" style={{ fontSize: '0.85rem' }}>Created At</label>
          <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '0.95rem' }}>
            {formatGlobalDate(ticket.created_at, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <button 
          className="btn btn-primary" 
          onClick={handleUpdateStatus} 
          disabled={updating || (status === ticket.status && priority === ticket.priority)}
          style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <Save size={18} /> Update Details
        </button>
      </div>

    </div>
  );
};
