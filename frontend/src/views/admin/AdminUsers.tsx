import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminAPI } from '../../api';
import { Users, Edit2, Check, X, Plus, Minus, DollarSign, Eye } from 'lucide-react';

interface Props {
  onNavigate?: (view: string) => void;
  onSelectUser?: (id: number) => void;
}

export const AdminUsers: React.FC<Props> = ({ onNavigate, onSelectUser }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  // Edit form state
  const [editFormData, setEditFormData] = useState<any>({
    name: '', email: '', phone_number: '', address: '', city: '', state: '', pin_code: ''
  });

  // Balance Adjustment state
  const [adjustingUserId, setAdjustingUserId] = useState<number | null>(null);
  const [adjustAction, setAdjustAction] = useState<'add' | 'subtract'>('add');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDescription, setAdjustDescription] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await adminAPI.getUsers();
      setUsers(res);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const totalItems = users.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = users.slice(indexOfFirstItem, indexOfLastItem);

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name || '',
      email: user.email || '',
      phone_number: user.phone_number || '',
      address: user.address || '',
      city: user.city || '',
      state: user.state || '',
      pin_code: user.pin_code || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await adminAPI.updateUser(editingUser.id, editFormData);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      alert('Failed to update user');
    }
  };

  const openAdjustModal = (user: any, action: 'add' | 'subtract') => {
    setAdjustingUserId(user.id);
    setAdjustAction(action);
    setAdjustAmount('');
    setAdjustDescription(`Admin adjustment (${action})`);
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingUserId) return;
    setAdjustLoading(true);
    try {
      await adminAPI.adjustBalance(adjustingUserId, adjustAction, parseFloat(adjustAmount), adjustDescription);
      setAdjustingUserId(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to adjust balance');
    } finally {
      setAdjustLoading(false);
    }
  };

  if (isLoading) return <div style={{ padding: '32px' }}>Loading users...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Manage Users</h2>
        <p style={{ color: 'var(--text-secondary)' }}>View and edit user accounts and adjust wallet balances.</p>
      </div>

      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Wallet Balance</th>
              <th>Registered At</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentUsers.map((user) => {
              return (
                <tr key={user.id}>
                  <td style={{ color: 'var(--text-muted)' }}>#{user.id}</td>
                  <td><span style={{ fontWeight: 600 }}>{user.name}</span></td>
                  <td><span style={{ color: 'var(--text-secondary)' }}>{user.email}</span></td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      ₹{parseFloat(user.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => openAdjustModal(user, 'add')}
                          className="btn btn-secondary" 
                          style={{ padding: '6px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-secondary)', border: 'none' }}
                          title="Add Funds"
                        >
                          <Plus size={14} />
                        </button>
                        <button 
                          onClick={() => openAdjustModal(user, 'subtract')}
                          className="btn btn-secondary" 
                          style={{ padding: '6px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: 'none' }}
                          title="Subtract Funds"
                        >
                          <Minus size={14} />
                        </button>
                        <button 
                          onClick={() => {
                            if (onSelectUser && onNavigate) {
                              onSelectUser(user.id);
                              onNavigate('admin-user-details');
                            }
                          }}
                          className="btn btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          title="View Complete Profile & Controls"
                        >
                          <Eye size={14} /> Details
                        </button>
                        <button 
                          onClick={() => handleEditClick(user)}
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Edit2 size={14} /> Edit
                        </button>
                      </div>
                  </td>
                </tr>
              );
            })}
            
            {users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  No users found.
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

      {/* Edit User Modal */}
      {editingUser && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div className="glass-card" style={{ maxWidth: '500px', width: '100%', padding: '24px', position: 'relative', maxHeight: '85vh', overflowY: 'auto' }}>
            <button 
              onClick={handleCancelEdit} 
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit2 size={20} /> Edit User Profile
            </h3>
            
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="input-label">Full Name</label>
                <input type="text" className="input-field" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} required />
              </div>
              <div>
                <label className="input-label">Email Address</label>
                <input type="email" className="input-field" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} required />
              </div>
              <div>
                <label className="input-label">Phone Number</label>
                <input type="text" className="input-field" value={editFormData.phone_number} onChange={e => setEditFormData({...editFormData, phone_number: e.target.value})} />
              </div>
              <div>
                <label className="input-label">Address</label>
                <input type="text" className="input-field" value={editFormData.address} onChange={e => setEditFormData({...editFormData, address: e.target.value})} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ flex: '1 1 150px' }}>
                  <label className="input-label">City</label>
                  <input type="text" className="input-field" value={editFormData.city} onChange={e => setEditFormData({...editFormData, city: e.target.value})} />
                </div>
                <div style={{ flex: '1 1 150px' }}>
                  <label className="input-label">State</label>
                  <input type="text" className="input-field" value={editFormData.state} onChange={e => setEditFormData({...editFormData, state: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="input-label">PIN Code</label>
                <input type="text" className="input-field" value={editFormData.pin_code} onChange={e => setEditFormData({...editFormData, pin_code: e.target.value})} />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={handleCancelEdit} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Adjustment Modal */}
      {adjustingUserId && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div className="glass-card" style={{ maxWidth: '400px', width: '100%', padding: '24px', position: 'relative' }}>
            <button 
              onClick={() => setAdjustingUserId(null)} 
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={20} color={adjustAction === 'add' ? 'var(--accent-secondary)' : 'var(--accent-danger)'} />
              {adjustAction === 'add' ? 'Add Funds' : 'Subtract Funds'}
            </h3>
            
            <form onSubmit={handleAdjustBalance} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="input-label">Amount</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input-field" 
                  value={adjustAmount} 
                  onChange={(e) => setAdjustAmount(e.target.value)} 
                  placeholder="0.00"
                  required 
                  min="0.01"
                />
              </div>
              <div>
                <label className="input-label">Reason / Note (For Transaction Log)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={adjustDescription} 
                  onChange={(e) => setAdjustDescription(e.target.value)} 
                  placeholder="e.g. Bonus, Correction"
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ background: adjustAction === 'add' ? 'var(--accent-secondary)' : 'var(--accent-danger)', color: '#000', marginTop: '10px' }}
                disabled={adjustLoading}
              >
                {adjustLoading ? 'Processing...' : `Confirm ${adjustAction === 'add' ? 'Addition' : 'Subtraction'}`}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
