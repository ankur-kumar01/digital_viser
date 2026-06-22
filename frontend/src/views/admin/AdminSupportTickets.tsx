import React, { useState, useEffect } from 'react';
import { adminSupportAPI } from '../../api';
import { MessageSquare, Clock, Filter, Search } from 'lucide-react';
import { formatGlobalDate } from '../../utils/dateFormatter';

export const AdminSupportTickets: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchTickets = async () => {
    try {
      const data = await adminSupportAPI.getTickets({ status: statusFilter, search });
      setTickets(data);
    } catch (err) {
      console.error('Failed to load admin tickets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, search]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>Open</span>;
      case 'pending': return <span className="badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>Pending</span>;
      case 'closed': return <span className="badge" style={{ background: 'rgba(107,114,128,0.1)', color: '#6b7280', border: '1px solid rgba(107,114,128,0.2)' }}>Closed</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.85rem' }}>High</span>;
      case 'medium': return <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem' }}>Medium</span>;
      case 'low': return <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>Low</span>;
      default: return <span>{priority}</span>;
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Manage Support Tickets</h2>
        <p style={{ color: 'var(--text-secondary)' }}>View and respond to user inquiries and support requests.</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', flexWrap: 'wrap' }}>
        <Search size={18} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search by subject or user email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.95rem',
            minWidth: '200px'
          }}
        />
        <div style={{ width: '1px', height: '24px', background: 'var(--border-glass)', margin: '0 8px' }}></div>
        <Filter size={18} color="var(--text-muted)" />
        <select 
          value={statusFilter} 
          onChange={e => setStatusFilter(e.target.value)} 
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.95rem',
            cursor: 'pointer'
          }}
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Subject</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Updated</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}><Clock className="animate-spin" /> Loading...</td></tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <MessageSquare size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  {search || statusFilter ? 'No tickets match your filters.' : 'No tickets found.'}
                </td>
              </tr>
            ) : tickets.map(t => (
              <tr key={t.id}>
                <td style={{ color: 'var(--text-muted)' }}>#{t.id}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{t.user_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.user_email}</div>
                </td>
                <td style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject}</td>
                <td style={{ textTransform: 'capitalize' }}>{t.category}</td>
                <td>{getPriorityBadge(t.priority)}</td>
                <td>{getStatusBadge(t.status)}</td>
                <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatGlobalDate(t.updated_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td style={{ textAlign: 'right' }}>
                  <a href={`#admin/support/${t.id}`} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    View & Reply
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
