import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api';
import { Plus, Edit2, Trash2, X, Award } from 'lucide-react';
import { formatGlobalDate } from '../../utils/dateFormatter';

export const AdminBigWins: React.FC = () => {
  const [wins, setWins] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWin, setEditingWin] = useState<any>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    user_name: '',
    amount: '',
    game_name: '',
    game_color: 'var(--accent-secondary)'
  });

  const fetchWins = async () => {
    try {
      const data = await adminAPI.getBigWins();
      setWins(data);
    } catch (err) {
      console.error('Failed to fetch big wins', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWins();
  }, []);

  const handleOpenModal = (win?: any) => {
    if (win) {
      setEditingWin(win);
      setFormData({
        user_name: win.user_name,
        amount: win.amount,
        game_name: win.game_name,
        game_color: win.game_color
      });
    } else {
      setEditingWin(null);
      setFormData({
        user_name: '',
        amount: '',
        game_name: '',
        game_color: 'var(--accent-secondary)'
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingWin(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingWin) {
        await adminAPI.updateBigWin(editingWin.id, formData);
      } else {
        await adminAPI.createBigWin(formData);
      }
      handleCloseModal();
      fetchWins();
    } catch (err) {
      alert(`Save failed: ${(err as Error).message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this win record?')) return;
    try {
      await adminAPI.deleteBigWin(id);
      fetchWins();
    } catch (err) {
      alert(`Delete failed: ${(err as Error).message}`);
    }
  };

  const totalItems = wins.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentWins = wins.slice(indexOfFirstItem, indexOfLastItem);

  if (isLoading) return <div style={{ padding: '32px' }}>Loading Big Wins Ticker...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={24} color="var(--accent-secondary)" />
            Big Wins Ticker
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Manage the dynamic winning records shown on the user dashboard marquee.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} /> Add New Win
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {wins.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No wins recorded. Add one to display on the dashboard!
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User Name</th>
                    <th>Amount</th>
                    <th>Game Name</th>
                    <th>Badge Color</th>
                    <th>Date Added</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentWins.map((item) => (
                    <tr key={item.id}>
                      <td style={{ color: 'var(--text-muted)' }}>#{item.id}</td>
                      <td style={{ fontWeight: 600 }}>{item.user_name}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>{item.amount}</td>
                      <td style={{ fontWeight: 600, color: item.game_color }}>{item.game_name}</td>
                      <td>
                        <span style={{ 
                          display: 'inline-block', 
                          width: '16px', height: '16px', 
                          background: item.game_color, 
                          borderRadius: '4px',
                          verticalAlign: 'middle',
                          marginRight: '8px'
                        }}></span>
                        <code style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.game_color}</code>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{formatGlobalDate(item.created_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => handleOpenModal(item)}
                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Edit2 size={14} /> Edit
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
                    style={{ padding: '6px 12px', fontSize: '0.85rem', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => {
                    const pageNumber = index + 1;
                    const isPageVisible = pageNumber === 1 || pageNumber === totalPages || Math.abs(pageNumber - currentPage) <= 1;

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
                          padding: '6px 12px', fontSize: '0.85rem', border: 'none', borderRadius: 'var(--radius-sm)',
                          background: currentPage === pageNumber ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                          color: currentPage === pageNumber ? 'var(--bg-primary)' : 'var(--text-primary)',
                          cursor: 'pointer', fontWeight: currentPage === pageNumber ? 700 : 500
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
                    style={{ padding: '6px 12px', fontSize: '0.85rem', opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '24px', position: 'relative' }}>
            <button 
              onClick={handleCloseModal}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px' }}>
              {editingWin ? 'Edit Win Record' : 'Add New Win Record'}
            </h3>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label>User Name</label>
                <input 
                  type="text" 
                  value={formData.user_name} 
                  onChange={(e) => setFormData({...formData, user_name: e.target.value})}
                  placeholder="e.g. Rahul_99"
                  required 
                />
              </div>

              <div className="input-group">
                <label>Amount (with currency symbol)</label>
                <input 
                  type="text" 
                  value={formData.amount} 
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  placeholder="e.g. ₹14,500"
                  required 
                />
              </div>

              <div className="input-group">
                <label>Game Name</label>
                <input 
                  type="text" 
                  value={formData.game_name} 
                  onChange={(e) => setFormData({...formData, game_name: e.target.value})}
                  placeholder="e.g. Aviator"
                  required 
                />
              </div>

              <div className="input-group">
                <label>Game Color (CSS variable or hex)</label>
                <input 
                  type="text" 
                  value={formData.game_color} 
                  onChange={(e) => setFormData({...formData, game_color: e.target.value})}
                  placeholder="e.g. var(--accent-secondary)"
                  required 
                />
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => setFormData({...formData, game_color: 'var(--accent-primary)'})} style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: '4px', cursor: 'pointer' }}>Primary (Blue)</button>
                  <button type="button" onClick={() => setFormData({...formData, game_color: 'var(--accent-secondary)'})} style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: '4px', cursor: 'pointer' }}>Secondary (Green)</button>
                  <button type="button" onClick={() => setFormData({...formData, game_color: 'var(--accent-info)'})} style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: '4px', cursor: 'pointer' }}>Info (Purple)</button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={handleCloseModal} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingWin ? 'Update Record' : 'Save Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
