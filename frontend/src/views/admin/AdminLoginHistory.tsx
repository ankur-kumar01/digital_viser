import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api';
import { History, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Monitor, Globe } from 'lucide-react';
import { formatGlobalDate } from '../../utils/dateFormatter';

export const AdminLoginHistory: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const totalPages = Math.ceil(total / limit);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const data = await adminAPI.getLoginHistory(currentPage, limit);
      setHistory(data.history);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch login history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [currentPage, limit]);

  const parseDeviceInfo = (info: string | null) => {
    if (!info) return null;
    try {
      return JSON.parse(info);
    } catch {
      return null;
    }
  };

  const getBrowserInfo = (ua: string) => {
    if (!ua) return 'Unknown';
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
    return 'Other';
  };

  const getOSInfo = (ua: string) => {
    if (!ua) return 'Unknown';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS')) return 'macOS';
    if (ua.includes('Linux') && !ua.includes('Android')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Other';
  };

  if (isLoading) return <div style={{ padding: '32px' }}>Loading login history...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <History size={28} color="var(--accent-primary)" />
          User Login History
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>Track all user login attempts with device and location info.</p>
      </div>

      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Login Time</th>
              <th>User</th>
              <th>IP Address</th>
              <th>Device</th>
              <th>Browser / OS</th>
              <th>Screen</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No login history found.</td>
              </tr>
            ) : (
              history.map((entry) => {
                const di = parseDeviceInfo(entry.device_info);
                return (
                  <tr key={entry.id}>
                    <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatGlobalDate(entry.login_at)}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{entry.user_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{entry.user_email}</div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{entry.ip_address}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                        <Monitor size={14} color="var(--text-muted)" />
                        {di?.platform || getOSInfo(entry.user_agent)}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {getBrowserInfo(entry.user_agent)} / {getOSInfo(entry.user_agent)}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {di?.screen || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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
