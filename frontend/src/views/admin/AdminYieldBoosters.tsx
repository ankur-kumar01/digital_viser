import React, { useEffect, useState } from 'react';
import { yieldBoosterAPI } from '../../api';
import { Percent, Clock, Plus, Trash2, Edit, Power, PowerOff, Users, X, Info } from 'lucide-react';

export const AdminYieldBoosters: React.FC = () => {
  const [boosters, setBoosters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // New Booster State
  const [newBooster, setNewBooster] = useState({
    name: '',
    description: '',
    yield_boost_percent: '',
    target_type: 'all',
    duration_days: ''
  });

  // Edit Booster State
  const [editingBooster, setEditingBooster] = useState<any | null>(null);

  const fetchBoosters = async () => {
    try {
      setIsLoading(true);
      const data = await yieldBoosterAPI.getAdminBoosters();
      setBoosters(data);
    } catch (err: any) {
      console.error('Failed to fetch yield boosters:', err);
      setErrorMessage(err.message || 'Failed to fetch yield boosters.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBoosters();
  }, []);

  const handleCreateBooster = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await yieldBoosterAPI.createAdminBooster({
        name: newBooster.name,
        description: newBooster.description,
        yield_boost_percent: parseFloat(newBooster.yield_boost_percent),
        target_type: newBooster.target_type,
        duration_days: parseInt(newBooster.duration_days, 10),
        is_active: true
      });
      setNewBooster({ name: '', description: '', yield_boost_percent: '', target_type: 'all', duration_days: '' });
      setSuccessMessage('Yield booster successfully created!');
      fetchBoosters();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create yield booster.');
    }
  };

  const handleUpdateBooster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooster) return;
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await yieldBoosterAPI.updateAdminBooster(editingBooster.id, {
        name: editingBooster.name,
        description: editingBooster.description,
        yield_boost_percent: parseFloat(editingBooster.yield_boost_percent),
        target_type: editingBooster.target_type,
        duration_days: parseInt(editingBooster.duration_days, 10),
        is_active: !!editingBooster.is_active
      });
      setEditingBooster(null);
      setSuccessMessage('Yield booster successfully updated!');
      fetchBoosters();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update yield booster.');
    }
  };

  const handleToggleBooster = async (id: number, currentStatus: boolean) => {
    setErrorMessage('');
    setSuccessMessage('');
    const target = boosters.find(b => b.id === id);
    if (!target) return;
    try {
      await yieldBoosterAPI.updateAdminBooster(id, {
        name: target.name,
        description: target.description,
        yield_boost_percent: parseFloat(target.yield_boost_percent),
        target_type: target.target_type,
        duration_days: parseInt(target.duration_days, 10),
        is_active: !currentStatus
      });
      setSuccessMessage(`Yield booster status updated!`);
      fetchBoosters();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to toggle status.');
    }
  };

  const handleDeleteBooster = async (id: number) => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!window.confirm("Are you sure you want to permanently delete this yield booster configuration? All user claimed instances will also be deleted.")) return;
    try {
      await yieldBoosterAPI.deleteAdminBooster(id);
      setSuccessMessage('Yield booster config successfully deleted!');
      fetchBoosters();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete booster.');
    }
  };

  const getTargetBadgeStyle = (target: string) => {
    switch (target) {
      case 'all':
        return { background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' };
      case 'inactive_2d':
        return { background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' };
      case 'inactive_7d_reg':
        return { background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' };
      default:
        return { background: 'var(--bg-glass)', color: 'var(--text-secondary)' };
    }
  };

  const getTargetLabel = (target: string) => {
    switch (target) {
      case 'all': return 'All Users';
      case 'inactive_2d': return 'Inactive 2d';
      case 'inactive_7d_reg': return 'Reg 7d+ / 0 Plays';
      default: return target;
    }
  };

  if (isLoading && boosters.length === 0) return <div style={{ padding: '32px' }}>Loading Yield Booster Management...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Yield Booster Offers Management</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Configure dynamic yield boost coupons targeting selective player segments.</p>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="glass-card" style={{ padding: '12px 16px', borderLeft: '4px solid var(--accent-secondary)', background: 'rgba(0, 245, 160, 0.05)', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="glass-card" style={{ padding: '12px 16px', borderLeft: '4px solid var(--accent-danger)', background: 'rgba(255, 71, 87, 0.05)', color: 'var(--accent-danger)', fontSize: '0.9rem' }}>
          {errorMessage}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* ADD BOOSTER FORM */}
        <form onSubmit={handleCreateBooster} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Launch New Yield Booster</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label className="input-label">Booster Name</label>
              <input className="input-field" value={newBooster.name} onChange={e => setNewBooster({...newBooster, name: e.target.value})} required placeholder="e.g. Retention Yield Booster" />
            </div>
            <div>
              <label className="input-label">Yield Boost (%)</label>
              <input type="number" step="0.01" className="input-field" value={newBooster.yield_boost_percent} onChange={e => setNewBooster({...newBooster, yield_boost_percent: e.target.value})} required placeholder="e.g. 1.50" />
            </div>
            <div>
              <label className="input-label">Duration (Days)</label>
              <input type="number" className="input-field" value={newBooster.duration_days} onChange={e => setNewBooster({...newBooster, duration_days: e.target.value})} required placeholder="e.g. 5" />
            </div>
            <div>
              <label className="input-label">Target Audience Segment</label>
              <select className="input-field" value={newBooster.target_type} onChange={e => setNewBooster({...newBooster, target_type: e.target.value})} required>
                <option value="all">All Users</option>
                <option value="inactive_2d">Inactive for previous 2 Days (no game plays)</option>
                <option value="inactive_7d_reg">Registered 7+ Days with 0 lifetime plays</option>
              </select>
            </div>
          </div>
          <div>
            <label className="input-label">Offer Description</label>
            <textarea 
              className="input-field" 
              value={newBooster.description} 
              onChange={e => setNewBooster({...newBooster, description: e.target.value})} 
              required 
              placeholder="Provide a detailed description explaining what games they must play or what is boosted." 
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            <Plus size={18} /> Launch Booster
          </button>
        </form>

        {/* BOOSTERS TABLE */}
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Booster Name</th>
                <th>Yield Boost</th>
                <th>Duration</th>
                <th>Target Segment</th>
                <th>Active Users</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {boosters.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Percent size={16} color="var(--accent-secondary)" />
                      <div>
                        {b.name}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px', maxWidth: '300px', whiteSpace: 'normal' }}>
                          {b.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>+{parseFloat(b.yield_boost_percent).toFixed(2)}%</td>
                  <td>{b.duration_days} Days</td>
                  <td>
                    <span className="badge" style={getTargetBadgeStyle(b.target_type)}>
                      {getTargetLabel(b.target_type)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={14} color="var(--text-secondary)" />
                      <strong style={{ color: 'var(--text-primary)' }}>{b.active_users || 0}</strong>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${b.is_active ? 'badge-active' : 'badge-danger'}`}>
                      {b.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditingBooster(b)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                        <Edit size={14}/> Edit
                      </button>
                      <button onClick={() => handleToggleBooster(b.id, !!b.is_active)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                        {b.is_active ? <><PowerOff size={14}/> Disable</> : <><Power size={14}/> Enable</>}
                      </button>
                      <button onClick={() => handleDeleteBooster(b.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--accent-danger)' }}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {boosters.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No yield boosters configured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingBooster && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '32px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Edit Yield Booster</h3>
              <button onClick={() => setEditingBooster(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdateBooster} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="input-label">Booster Name</label>
                <input className="input-field" value={editingBooster.name} onChange={e => setEditingBooster({...editingBooster, name: e.target.value})} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="input-label">Yield Boost (%)</label>
                  <input type="number" step="0.01" className="input-field" value={editingBooster.yield_boost_percent} onChange={e => setEditingBooster({...editingBooster, yield_boost_percent: e.target.value})} required />
                </div>
                <div>
                  <label className="input-label">Duration (Days)</label>
                  <input type="number" className="input-field" value={editingBooster.duration_days} onChange={e => setEditingBooster({...editingBooster, duration_days: e.target.value})} required />
                </div>
              </div>
              <div>
                <label className="input-label">Target Audience Segment</label>
                <select className="input-field" value={editingBooster.target_type} onChange={e => setEditingBooster({...editingBooster, target_type: e.target.value})} required>
                  <option value="all">All Users</option>
                  <option value="inactive_2d">Inactive for previous 2 Days (no game plays)</option>
                  <option value="inactive_7d_reg">Registered 7+ Days with 0 lifetime plays</option>
                </select>
              </div>
              <div>
                <label className="input-label">Offer Description</label>
                <textarea 
                  className="input-field" 
                  value={editingBooster.description} 
                  onChange={e => setEditingBooster({...editingBooster, description: e.target.value})} 
                  required 
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn" style={{ flex: 1, background: 'var(--bg-tertiary)' }} onClick={() => setEditingBooster(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
