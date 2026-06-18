import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api';
import { Receipt, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatGlobalDate } from '../../utils/dateFormatter';

export const AdminTransactions: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const totalPages = Math.ceil(total / limit);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const data = await adminAPI.getTransactions(currentPage, limit);
      setTransactions(data.transactions);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, limit]);

  const getTypeColor = (type: string) => {
    if (type.includes('deposit') || type.includes('credit') || type.includes('approved')) return 'var(--accent-secondary)';
    if (type.includes('withdrawal') || type.includes('debit')) return 'var(--accent-danger)';
    return 'var(--text-primary)';
  };

  if (isLoading) return <div style={{ padding: '32px' }}>Loading transactions...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Receipt size={28} color="var(--accent-primary)" />
          All Transactions
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>View all user transactions across the platform.</p>
      </div>

      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No transactions found.</td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id}>
                  <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatGlobalDate(tx.created_at)}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{tx.user_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{tx.user_email}</div>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      background: `${getTypeColor(tx.type)}15`,
                      color: getTypeColor(tx.type)
                    }}>
                      {tx.type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: getTypeColor(tx.type) }}>
                    ₹{parseFloat(tx.amount).toFixed(2)}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tx.description || '-'}
                  </td>
                </tr>
              ))
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
