import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api';
import { Check, X, Clock, CheckCircle2, XCircle } from 'lucide-react';

export const AdminDepositRequests: React.FC = () => {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const fetchRequests = async () => {
    try {
      const res = await adminAPI.getRequests();
      setDeposits(res.deposits || []);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') await adminAPI.approveDeposit(id);
      else await adminAPI.rejectDeposit(id);
      fetchRequests();
    } catch (err) {
      alert(`Action failed: ${(err as Error).message}`);
    }
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  if (isLoading) return <div style={{ padding: '32px' }}>Loading deposit requests...</div>;

  const filteredDeposits = deposits.filter(d => d.status === activeTab);

  const totalItems = filteredDeposits.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentDeposits = filteredDeposits.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Deposit Requests</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Review and manage all user deposit requests.</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
        {(['pending', 'approved', 'rejected'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              background: activeTab === tab ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === tab ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              textTransform: 'capitalize',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredDeposits.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Clock size={40} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            No {activeTab} deposits found.
          </div>
        ) : (
          <>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Details / Reference</th>
                  <th style={{ textAlign: 'right' }}>Actions / Status</th>
                </tr>
              </thead>
              <tbody>
                {currentDeposits.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontSize: '0.85rem' }}>{new Date(item.created_at).toLocaleString()}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.user_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.user_email}</div>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>
                      ₹{parseFloat(item.amount).toFixed(2)}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{item.payment_method ? item.payment_method.replace('_', ' ') : 'N/A'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <div style={{ marginBottom: '4px' }}><strong>TXN:</strong> {item.transaction_id ? item.transaction_id.substring(0, 12) + '...' : 'N/A'}</div>
                      {(() => {
                        let parsedData = item.custom_data;
                        if (typeof parsedData === 'string') {
                          try { parsedData = JSON.parse(parsedData); } catch (e) { parsedData = null; }
                        }
                        if (!parsedData || typeof parsedData !== 'object' || Object.keys(parsedData).length === 0) return null;
                        
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                            {Object.entries(parsedData).map(([key, value]: [string, any]) => (
                              <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{key}:</span>
                                {typeof value === 'string' && value.startsWith('/uploads/') ? (
                                  <a href={`/api${value}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', wordBreak: 'break-all' }}>View Attachment</a>
                                ) : (
                                  <span style={{ color: 'var(--text-primary)', wordBreak: 'break-all', fontWeight: 500 }}>{value}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ textAlign: 'right', verticalAlign: 'top' }}>
                      {activeTab === 'pending' ? (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => handleAction(item.id, 'approve')}
                            style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-secondary)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button 
                            onClick={() => handleAction(item.id, 'reject')}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <X size={14} /> Reject
                          </button>
                        </div>
                      ) : activeTab === 'approved' ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', color: 'var(--accent-secondary)', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <CheckCircle2 size={16} /> Approved
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', color: 'var(--accent-danger)', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <XCircle size={16} /> Rejected
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: '20px',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <span>Show</span>
              <select 
                value={itemsPerPage} 
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>entries per page (Total: {totalItems})</span>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="btn btn-secondary"
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '0.85rem',
                    opacity: currentPage === 1 ? 0.5 : 1,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, index) => {
                  const pageNumber = index + 1;
                  const isPageVisible = 
                    pageNumber === 1 || 
                    pageNumber === totalPages || 
                    Math.abs(pageNumber - currentPage) <= 1;

                  if (!isPageVisible) {
                    if (pageNumber === 2 || pageNumber === totalPages - 1) {
                      return <span key={pageNumber} style={{ color: 'var(--text-muted)', padding: '0 4px' }}>...</span>;
                    }
                    return null;
                  }

                  return (
                    <button
                      key={pageNumber}
                      onClick={() => setCurrentPage(pageNumber)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        background: currentPage === pageNumber ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        color: currentPage === pageNumber ? 'var(--bg-primary)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontWeight: currentPage === pageNumber ? 700 : 500,
                        transition: 'all 0.2s'
                      }}
                    >
                      {pageNumber}
                    </button>
                  );
                })}

                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary"
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '0.85rem',
                    opacity: currentPage === totalPages ? 0.5 : 1,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
          </>
        )}
      </div>
    </div>
  );
};
