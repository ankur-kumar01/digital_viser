import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api';
import { Plus, Edit2, Trash2, X, MessageSquare, Users, CircleDot } from 'lucide-react';

export const AdminGameSimulations: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'aviator_chats' | 'aviator_bets' | 'colour_trading_bets'>('aviator_chats');
  const [isLoading, setIsLoading] = useState(true);

  // Data States
  const [aviatorChats, setAviatorChats] = useState<any[]>([]);
  const [aviatorBets, setAviatorBets] = useState<any[]>([]);
  const [colourTradingBets, setColourTradingBets] = useState<any[]>([]);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState<any>({});

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'aviator_chats') {
        const data = await adminAPI.getSimulatedAviatorChats();
        setAviatorChats(data);
      } else if (activeTab === 'aviator_bets') {
        const data = await adminAPI.getSimulatedAviatorBets();
        setAviatorBets(data);
      } else {
        const data = await adminAPI.getSimulatedColourTradingBets();
        setColourTradingBets(data);
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setCurrentPage(1);
  }, [activeTab]);

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setFormData(item);
    } else {
      setEditingItem(null);
      if (activeTab === 'aviator_chats') {
        setFormData({ user_name: '', message_type: 'WAITING', message_text: '' });
      } else if (activeTab === 'aviator_bets') {
        setFormData({ user_name: '', bet_amount: '', target_multiplier: '' });
      } else {
        setFormData({ user_name: '', bet_amount: '', color_choice: 'green' });
      }
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeTab === 'aviator_chats') {
        if (editingItem) await adminAPI.updateSimulatedAviatorChat(editingItem.id, formData);
        else await adminAPI.createSimulatedAviatorChat(formData);
      } else if (activeTab === 'aviator_bets') {
        if (editingItem) await adminAPI.updateSimulatedAviatorBet(editingItem.id, formData);
        else await adminAPI.createSimulatedAviatorBet(formData);
      } else {
        if (editingItem) await adminAPI.updateSimulatedColourTradingBet(editingItem.id, formData);
        else await adminAPI.createSimulatedColourTradingBet(formData);
      }
      handleCloseModal();
      fetchData();
    } catch (err) {
      alert(`Save failed: ${(err as Error).message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this simulation record?')) return;
    try {
      if (activeTab === 'aviator_chats') await adminAPI.deleteSimulatedAviatorChat(id);
      else if (activeTab === 'aviator_bets') await adminAPI.deleteSimulatedAviatorBet(id);
      else await adminAPI.deleteSimulatedColourTradingBet(id);
      fetchData();
    } catch (err) {
      alert(`Delete failed: ${(err as Error).message}`);
    }
  };

  const renderPagination = (dataArray: any[]) => {
    const totalItems = dataArray.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <span>Show</span>
          <select 
            value={itemsPerPage} 
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '4px 8px', outline: 'none' }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>entries (Total: {totalItems})</span>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}
              className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, index) => {
              const pageNumber = index + 1;
              const isPageVisible = pageNumber === 1 || pageNumber === totalPages || Math.abs(pageNumber - currentPage) <= 1;
              if (!isPageVisible) return pageNumber === 2 || pageNumber === totalPages - 1 ? <span key={pageNumber} style={{ color: 'var(--text-muted)' }}>...</span> : null;
              return (
                <button
                  key={pageNumber} onClick={() => setCurrentPage(pageNumber)}
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
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}
              className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem', opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  };

  const getPaginatedData = (dataArray: any[]) => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return dataArray.slice(indexOfFirstItem, indexOfLastItem);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Game Simulations</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Manage the AI-controlled fake users, chat narratives, and live bets shown on the games.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} /> Add New Record
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('aviator_chats')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: 'var(--radius-sm)',
            border: 'none', background: activeTab === 'aviator_chats' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: activeTab === 'aviator_chats' ? 'var(--bg-primary)' : 'var(--text-primary)',
            fontWeight: activeTab === 'aviator_chats' ? 600 : 500, cursor: 'pointer', transition: 'var(--transition)'
          }}
        >
          <MessageSquare size={16} /> Aviator Chat Narratives
        </button>
        <button 
          onClick={() => setActiveTab('aviator_bets')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: 'var(--radius-sm)',
            border: 'none', background: activeTab === 'aviator_bets' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: activeTab === 'aviator_bets' ? 'var(--bg-primary)' : 'var(--text-primary)',
            fontWeight: activeTab === 'aviator_bets' ? 600 : 500, cursor: 'pointer', transition: 'var(--transition)'
          }}
        >
          <Users size={16} /> Aviator Fake Players
        </button>
        <button 
          onClick={() => setActiveTab('colour_trading_bets')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: 'var(--radius-sm)',
            border: 'none', background: activeTab === 'colour_trading_bets' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: activeTab === 'colour_trading_bets' ? 'var(--bg-primary)' : 'var(--text-primary)',
            fontWeight: activeTab === 'colour_trading_bets' ? 600 : 500, cursor: 'pointer', transition: 'var(--transition)'
          }}
        >
          <CircleDot size={16} /> Colour Trading Live Bets
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: '32px' }}>Loading data...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* AVIATOR CHATS TAB */}
          {activeTab === 'aviator_chats' && (
            <>
              {aviatorChats.length === 0 ? <p>No chats found.</p> : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>User Name</th>
                        <th>Context/Trigger</th>
                        <th>Chat Message (Hinglish/Eng)</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPaginatedData(aviatorChats).map(item => (
                        <tr key={item.id}>
                          <td style={{ color: 'var(--text-muted)' }}>#{item.id}</td>
                          <td style={{ fontWeight: 600, color: 'var(--accent-info)' }}>{item.user_name}</td>
                          <td>
                            <span style={{ 
                              background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' 
                            }}>{item.message_type}</span>
                          </td>
                          <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.message_text}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button onClick={() => handleOpenModal(item)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Edit2 size={14} /> Edit
                              </button>
                              <button onClick={() => handleDelete(item.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {renderPagination(aviatorChats)}
            </>
          )}

          {/* AVIATOR BETS TAB */}
          {activeTab === 'aviator_bets' && (
            <>
              {aviatorBets.length === 0 ? <p>No players found.</p> : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>User Name</th>
                        <th>Bet Amount (₹)</th>
                        <th>Target Multiplier (Cashout)</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPaginatedData(aviatorBets).map(item => (
                        <tr key={item.id}>
                          <td style={{ color: 'var(--text-muted)' }}>#{item.id}</td>
                          <td style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>{item.user_name}</td>
                          <td style={{ fontWeight: 600 }}>₹{item.bet_amount}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>x{item.target_multiplier}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button onClick={() => handleOpenModal(item)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Edit2 size={14} /> Edit
                              </button>
                              <button onClick={() => handleDelete(item.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {renderPagination(aviatorBets)}
            </>
          )}

          {/* COLOUR TRADING BETS TAB */}
          {activeTab === 'colour_trading_bets' && (
            <>
              {colourTradingBets.length === 0 ? <p>No bets found.</p> : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>User Name</th>
                        <th>Bet Amount (₹)</th>
                        <th>Color Choice</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPaginatedData(colourTradingBets).map(item => (
                        <tr key={item.id}>
                          <td style={{ color: 'var(--text-muted)' }}>#{item.id}</td>
                          <td style={{ fontWeight: 600 }}>{item.user_name}</td>
                          <td style={{ fontWeight: 600 }}>₹{item.bet_amount}</td>
                          <td>
                            <span style={{ 
                              background: item.color_choice === 'green' ? 'var(--accent-secondary)' : item.color_choice === 'red' ? 'var(--accent-danger)' : item.color_choice === 'violet' ? '#8b5cf6' : 'var(--bg-tertiary)', 
                              color: ['green', 'red', 'violet'].includes(item.color_choice) ? '#fff' : 'var(--text-primary)',
                              padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600
                            }}>{item.color_choice.toUpperCase()}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button onClick={() => handleOpenModal(item)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Edit2 size={14} /> Edit
                              </button>
                              <button onClick={() => handleDelete(item.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {renderPagination(colourTradingBets)}
            </>
          )}

        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '24px', position: 'relative' }}>
            <button onClick={handleCloseModal} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={24} />
            </button>
            
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px' }}>
              {editingItem ? 'Edit Record' : 'Add New Record'}
            </h3>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label>User Name</label>
                <input type="text" value={formData.user_name} onChange={(e) => setFormData({...formData, user_name: e.target.value})} placeholder="e.g. Rahul_99" required />
              </div>

              {activeTab === 'aviator_chats' && (
                <>
                  <div className="input-group">
                    <label>Context / Trigger Event</label>
                    <select value={formData.message_type} onChange={(e) => setFormData({...formData, message_type: e.target.value})} style={{ padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }} required>
                      <option value="WAITING">WAITING (Lobby Countdown)</option>
                      <option value="FLYING">FLYING (Mid-flight comments)</option>
                      <option value="CRASH_LOW">CRASH_LOW (Crashed 1.0x - 1.5x)</option>
                      <option value="CRASH_MED">CRASH_MED (Crashed 1.5x - 5.0x)</option>
                      <option value="CRASH_HIGH">CRASH_HIGH (Crashed 5.0x+)</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Message Text</label>
                    <textarea value={formData.message_text} onChange={(e) => setFormData({...formData, message_text: e.target.value})} placeholder="e.g. bhai log taiyaar ho jao badhiya profit ke liye!" rows={3} style={{ padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }} required />
                  </div>
                </>
              )}

              {activeTab === 'aviator_bets' && (
                <>
                  <div className="input-group">
                    <label>Bet Amount (₹)</label>
                    <input type="number" value={formData.bet_amount} onChange={(e) => setFormData({...formData, bet_amount: e.target.value})} placeholder="e.g. 500" required />
                  </div>
                  <div className="input-group">
                    <label>Target Multiplier (When user cashes out)</label>
                    <input type="number" step="0.01" value={formData.target_multiplier} onChange={(e) => setFormData({...formData, target_multiplier: e.target.value})} placeholder="e.g. 2.50" required />
                  </div>
                </>
              )}

              {activeTab === 'colour_trading_bets' && (
                <>
                  <div className="input-group">
                    <label>Bet Amount (₹)</label>
                    <input type="number" value={formData.bet_amount} onChange={(e) => setFormData({...formData, bet_amount: e.target.value})} placeholder="e.g. 1000" required />
                  </div>
                  <div className="input-group">
                    <label>Color Choice</label>
                    <select value={formData.color_choice} onChange={(e) => setFormData({...formData, color_choice: e.target.value})} style={{ padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }} required>
                      <option value="green">Green</option>
                      <option value="red">Red</option>
                      <option value="violet">Violet</option>
                      <option value="0">Number 0</option>
                      <option value="1">Number 1</option>
                      <option value="2">Number 2</option>
                      <option value="3">Number 3</option>
                      <option value="4">Number 4</option>
                      <option value="5">Number 5</option>
                      <option value="6">Number 6</option>
                      <option value="7">Number 7</option>
                      <option value="8">Number 8</option>
                      <option value="9">Number 9</option>
                    </select>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={handleCloseModal} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingItem ? 'Update Record' : 'Save Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
