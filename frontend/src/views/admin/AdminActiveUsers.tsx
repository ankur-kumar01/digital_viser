import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api';
import { Users, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Clock, Eye } from 'lucide-react';
import { formatGlobalDate } from '../../utils/dateFormatter';

type Period = '1h' | '24h' | 'yesterday' | 'last7days';

const periodLabels: Record<Period, string> = {
  '1h': 'Last Hour',
  '24h': 'Last 24 Hours',
  'yesterday': 'Yesterday',
  'last7days': 'Last 7 Days',
};

export const AdminActiveUsers: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [period, setPeriod] = useState<Period>('24h');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const totalPages = Math.ceil(total / limit);

  const fetchActiveUsers = async () => {
    try {
      setIsLoading(true);
      const data = await adminAPI.getActiveUsers(period, currentPage, limit);
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch active users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [period]);

  useEffect(() => {
    fetchActiveUsers();
  }, [period, currentPage, limit]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Users size={28} color="var(--accent-primary)" />
          Active Users
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>See which users were active in a given time period.</p>
      </div>

      {/* Period Filter */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(Object.keys(periodLabels) as Period[]).map((key) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            style={{
              padding: '8px 18px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: period === key ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: period === key ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: period === key ? 600 : 400,
              fontSize: '0.9rem',
              transition: 'all 0.2s',
            }}
          >
            {periodLabels[key]}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <Eye size={24} color="var(--accent-primary)" />
        <span style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
          <strong>{total}</strong> unique user{total !== 1 ? 's' : ''} active in <strong>{periodLabels[period].toLowerCase()}</strong>
        </span>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Last Active</th>
              <th>Page Visits</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No active users found in this period.</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.user_id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.user_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.user_email}</div>
                  </td>
                  <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} color="var(--text-muted)" />
                      {formatGlobalDate(u.last_active)}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.9rem', fontWeight: 600 }}>{u.page_visits}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <span>Show</span>
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setCurrentPage(1); }}
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '4px 8px', outline: 'none', cursor: 'pointer' }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>entries per page (Total: {total})</span>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} style={{ padding: '6px 10px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ padding: '6px 12px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>
              <ArrowLeft size={16} /> Prev
            </button>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '0 8px' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ padding: '6px 12px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>
              Next <ArrowRight size={16} />
            </button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} style={{ padding: '6px 10px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
