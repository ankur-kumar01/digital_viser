import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api';
import { Search, Calendar, Edit, PowerOff, X, BarChart3, User, Mail, DollarSign } from 'lucide-react';
import { formatGlobalDate } from '../../utils/dateFormatter';

export const AdminFdrs: React.FC = () => {
  const [fdrs, setFdrs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Edit FDR Modal State
  const [editingFdr, setEditingFdr] = useState<any | null>(null);

  const fetchFdrs = async () => {
    try {
      const data = await adminAPI.getAdminFdrs();
      setFdrs(data);
    } catch (err) {
      console.error('Failed to fetch FDR logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFdrs();
  }, []);

  const handleUpdateFdr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFdr) return;
    try {
      await adminAPI.updateAdminFdr(editingFdr.id, {
        amount: parseFloat(editingFdr.amount),
        interest_percent: parseFloat(editingFdr.interest_percent),
        period_days: parseInt(editingFdr.period_days, 10),
        start_date: editingFdr.start_date,
        end_date: editingFdr.end_date,
        next_installment_date: editingFdr.next_installment_date,
        status: editingFdr.status,
      });
      setEditingFdr(null);
      fetchFdrs();
    } catch (err) {
      alert('Failed to update running FDR');
    }
  };

  const handleCloseFdr = async (id: number) => {
    if (!window.confirm("Are you sure you want to manually close this FDR? This will refund the principal amount back to the user's wallet and CANCEL any locked promotional bonus balances associated with this FDR.")) return;
    try {
      await adminAPI.closeAdminFdr(id);
      fetchFdrs();
    } catch (err) {
      alert('Failed to manually close FDR');
    }
  };

  const filteredFdrs = fdrs.filter((fdr) => {
    const matchesSearch = 
      fdr.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fdr.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fdr.id.toString() === searchTerm;
      
    const matchesStatus = statusFilter === 'all' || fdr.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const totalItems = filteredFdrs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentFdrs = filteredFdrs.slice(indexOfFirstItem, indexOfLastItem);

  const formatDate = (dateStr: string) => {
    return formatGlobalDate(dateStr, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (isLoading) return <div style={{ padding: '32px' }}>Loading FDR Records...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BarChart3 size={28} color="var(--accent-primary)" />
          FDR Portfolio Management
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>View, edit, and manually close user Fixed Deposit Receipts.</p>
      </div>

      {/* Search and Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by User Name, Email, or FDR ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '48px' }}
          />
        </div>
        <div style={{ minWidth: '150px' }}>
          <select 
            className="input-field" 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="force_closed">Force Closed</option>
          </select>
        </div>
      </div>

      {/* FDR Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>FDR ID</th>
              <th>Investor</th>
              <th>Principal</th>
              <th>Yield Plan</th>
              <th>Interest Accrued</th>
              <th>Dates</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentFdrs.map((fdr) => (
              <tr key={fdr.id}>
                <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>#{fdr.id}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fdr.user_name}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fdr.user_email}</span>
                  </div>
                </td>
                <td style={{ fontWeight: 600 }}>₹{parseFloat(fdr.amount).toLocaleString('en-IN')}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{parseFloat(fdr.interest_percent)}%</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Payout every {fdr.period_days} Days</span>
                  </div>
                </td>
                <td style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>
                  ₹{parseFloat(fdr.accrued_interest || 0).toLocaleString('en-IN')}
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem' }}>
                    <span>Start: {formatDate(fdr.start_date)}</span>
                    <span>Next: {formatDate(fdr.next_installment_date)}</span>
                    <span>End: {formatDate(fdr.end_date)}</span>
                  </div>
                </td>
                <td>
                  <span className={`badge ${
                    fdr.status === 'active' ? 'badge-active' : 
                    fdr.status === 'completed' ? 'badge-success' : 'badge-danger'
                  }`}>
                    {fdr.status}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => setEditingFdr(fdr)} 
                      className="btn btn-secondary" 
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      title="Edit FDR details"
                    >
                      <Edit size={14} style={{ display: 'inline', marginRight: '4px' }} />
                      Edit
                    </button>
                    {fdr.status === 'active' && (
                      <button 
                        onClick={() => handleCloseFdr(fdr.id)} 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--accent-danger)' }}
                        title="Force close FDR"
                      >
                        <PowerOff size={14} style={{ display: 'inline', marginRight: '4px' }} />
                        Close
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredFdrs.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No Fixed Deposit Receipts found matching requirements.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
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

      {/* Edit FDR Modal */}
      {editingFdr && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '32px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Edit Running FDR #{editingFdr.id}</h3>
              <button onClick={() => setEditingFdr(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdateFdr} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="input-label">Principal Amount (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="input-field" 
                    value={editingFdr.amount} 
                    onChange={e => setEditingFdr({...editingFdr, amount: e.target.value})} 
                    required 
                  />
                </div>
                <div>
                  <label className="input-label">Interest Percent (%)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="input-field" 
                    value={editingFdr.interest_percent} 
                    onChange={e => setEditingFdr({...editingFdr, interest_percent: e.target.value})} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="input-label">Period (Days)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={editingFdr.period_days} 
                    onChange={e => setEditingFdr({...editingFdr, period_days: e.target.value})} 
                    required 
                  />
                </div>
                <div>
                  <label className="input-label">FDR Status</label>
                  <select 
                    className="input-field" 
                    value={editingFdr.status} 
                    onChange={e => setEditingFdr({...editingFdr, status: e.target.value})}
                  >
                    <option value="active">active</option>
                    <option value="completed">completed</option>
                    <option value="force_closed">force_closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="input-label">Start Date (YYYY-MM-DD)</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={editingFdr.start_date ? editingFdr.start_date.split('T')[0] : ''} 
                  onChange={e => setEditingFdr({...editingFdr, start_date: e.target.value})} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="input-label">Next Installment Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={editingFdr.next_installment_date ? editingFdr.next_installment_date.split('T')[0] : ''} 
                    onChange={e => setEditingFdr({...editingFdr, next_installment_date: e.target.value})} 
                    required 
                  />
                </div>
                <div>
                  <label className="input-label">Maturity Date (End Date)</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={editingFdr.end_date ? editingFdr.end_date.split('T')[0] : ''} 
                    onChange={e => setEditingFdr({...editingFdr, end_date: e.target.value})} 
                    required 
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn" style={{ flex: 1, background: 'var(--bg-tertiary)' }} onClick={() => setEditingFdr(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
