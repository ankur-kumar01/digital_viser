import React, { useState, useEffect } from 'react';
import { supportAPI } from '../api';
import { MessageSquare, Plus, Clock, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { formatGlobalDate } from '../utils/dateFormatter';

export const SupportTickets: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchTickets = async () => {
    try {
      const data = await supportAPI.getTickets();
      setTickets(data);
    } catch (err) {
      console.error('Failed to load tickets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message) {
      setError('Subject and message are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await supportAPI.createTicket(subject, message, category, priority);
      setShowModal(false);
      setSubject('');
      setMessage('');
      fetchTickets();
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>Open</span>;
      case 'pending': return <span className="badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>Pending Reply</span>;
      case 'closed': return <span className="badge" style={{ background: 'rgba(107,114,128,0.1)', color: '#6b7280', border: '1px solid rgba(107,114,128,0.2)' }}>Closed</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: '2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <MessageSquare color="var(--accent-primary)" /> Support Tickets
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Need help? Raise a ticket and we'll get back to you.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> New Ticket
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><Clock className="animate-spin" /> Loading...</div>
      ) : tickets.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
          <CheckCircle2 size={48} color="var(--accent-success)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 8px' }}>No Support Tickets</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>You don't have any open or past tickets.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {tickets.map(t => (
            <a key={t.id} href={`#support/${t.id}`} className="glass-card" style={{ padding: '20px', textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', transition: 'all 0.2s', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>#{t.id} - {t.subject}</h3>
                  {getStatusBadge(t.status)}
                </div>
                <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> Updated: {formatGlobalDate(t.updated_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <span>Category: <strong style={{ textTransform: 'capitalize' }}>{t.category}</strong></span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-card animate-scale-up" style={{ width: '100%', maxWidth: '500px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>Create Ticket</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X /></button>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} /> {error}
              </div>
            )}

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="input-label">Subject</label>
                <input type="text" className="input-field" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief summary of issue" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="input-label">Category</label>
                  <select className="input-field" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="general">General</option>
                    <option value="billing">Billing / Payment</option>
                    <option value="technical">Technical Issue</option>
                    <option value="account">Account / Login</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Priority</label>
                  <select className="input-field" value={priority} onChange={e => setPriority(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="input-label">Message</label>
                <textarea className="input-field" value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder="Describe your issue in detail..." required></textarea>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
