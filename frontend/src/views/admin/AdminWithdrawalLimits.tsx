import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, Power, PowerOff, Percent, Hash, Users, Globe } from 'lucide-react';
import { adminAPI } from '../../api';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatGlobalDate } from '../../utils/dateFormatter';

interface Limit {
  id: number;
  user_id: number | null;
  user_email?: string;
  wallet_type: string;
  limit_type: 'fixed' | 'percent_of_balance';
  limit_value: number;
  time_window: 'per_transaction' | 'daily';
  is_active: boolean | number;
  created_at: string;
}

export const AdminWithdrawalLimits: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'global' | 'individual'>('global');
  const [limits, setLimits] = useState<Limit[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    user_ids: '', // for bulk, comma separated or single
    wallet_type: 'main',
    limit_type: 'percent_of_balance',
    limit_value: '',
    time_window: 'per_transaction',
    is_active: true
  });

  const fetchLimits = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getWithdrawalLimits();
      setLimits(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch withdrawal limits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLimits();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      
      const isGlobal = activeTab === 'global';

      if (isGlobal) {
        const payload = {
          user_id: null,
          wallet_type: formData.wallet_type,
          limit_type: formData.limit_type,
          limit_value: formData.limit_value,
          time_window: formData.time_window,
          is_active: formData.is_active
        };

        if (editingId) {
          await adminAPI.updateWithdrawalLimit(editingId, payload);
        } else {
          await adminAPI.createWithdrawalLimit(payload);
        }
      } else {
        // Individual / Bulk
        if (editingId) {
          const payload = {
            user_id: parseInt(formData.user_ids) || null,
            wallet_type: formData.wallet_type,
            limit_type: formData.limit_type,
            limit_value: formData.limit_value,
            time_window: formData.time_window,
            is_active: formData.is_active
          };
          await adminAPI.updateWithdrawalLimit(editingId, payload);
        } else {
          // Bulk Create
          const ids = formData.user_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
          if (ids.length === 0) throw new Error("Please enter valid User IDs");
          
          await adminAPI.bulkCreateWithdrawalLimits({
            user_ids: ids,
            wallet_type: formData.wallet_type,
            limit_type: formData.limit_type,
            limit_value: formData.limit_value,
            time_window: formData.time_window,
            is_active: formData.is_active
          });
        }
      }
      
      await fetchLimits();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save limit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (limit: Limit) => {
    try {
      await adminAPI.updateWithdrawalLimit(limit.id, {
        ...limit,
        is_active: limit.is_active ? false : true
      });
      fetchLimits();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle status');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this rule permanently?')) return;
    try {
      await adminAPI.deleteWithdrawalLimit(id);
      fetchLimits();
    } catch (err: any) {
      setError(err.message || 'Failed to delete rule');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ user_ids: '', wallet_type: 'main', limit_type: 'percent_of_balance', limit_value: '', time_window: 'per_transaction', is_active: true });
    setError('');
  };

  const handleEdit = (limit: Limit) => {
    setEditingId(limit.id);
    setFormData({
      user_ids: limit.user_id ? limit.user_id.toString() : '',
      wallet_type: limit.wallet_type,
      limit_type: limit.limit_type,
      limit_value: limit.limit_value.toString(),
      time_window: limit.time_window,
      is_active: !!limit.is_active
    });
    setShowForm(true);
  };

  if (loading && limits.length === 0) return <div style={{ padding: '32px' }}><LoadingSpinner /></div>;

  const filteredLimits = limits.filter(c => activeTab === 'global' ? c.user_id === null : c.user_id !== null);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Withdrawal Limits Engine</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Dynamically control how much users can withdraw per transaction or daily.</p>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(255, 71, 87, 0.08)',
          border: '1px solid rgba(255, 71, 87, 0.25)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          color: 'var(--accent-danger)',
          fontSize: '0.88rem'
        }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
        <button 
          onClick={() => { setActiveTab('global'); resetForm(); }}
          className="btn"
          style={{ 
            background: activeTab === 'global' ? 'var(--accent-primary-glow)' : 'transparent',
            color: activeTab === 'global' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            border: activeTab === 'global' ? '1px solid var(--accent-primary)' : '1px solid transparent',
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            fontWeight: 600,
            display: 'flex', gap: '8px', alignItems: 'center'
          }}
        >
          <Globe size={18} /> Global Limits
        </button>
        <button 
          onClick={() => { setActiveTab('individual'); resetForm(); }}
          className="btn"
          style={{ 
            background: activeTab === 'individual' ? 'var(--accent-primary-glow)' : 'transparent',
            color: activeTab === 'individual' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            border: activeTab === 'individual' ? '1px solid var(--accent-primary)' : '1px solid transparent',
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            fontWeight: 600,
            display: 'flex', gap: '8px', alignItems: 'center'
          }}
        >
          <Users size={18} /> Individual / Bulk Limits
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            {activeTab === 'global' ? 'Active Global Constraints' : 'Active Account Specific Constraints'}
          </h3>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} /> Add New Rule
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              {editingId ? 'Edit Rule' : (activeTab === 'global' ? 'Create Global Rule' : 'Create Bulk/Individual Rule')}
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              
              {activeTab === 'individual' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="input-label">Target User IDs (Comma Separated for Bulk)</label>
                  <input
                    className="input-field"
                    type="text"
                    required
                    placeholder="e.g. 5, 12, 105"
                    value={formData.user_ids}
                    onChange={e => setFormData({ ...formData, user_ids: e.target.value })}
                    disabled={!!editingId}
                  />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {editingId ? 'Cannot edit User ID after creation.' : 'Enter one or multiple user IDs to apply this rule to them instantly.'}
                  </p>
                </div>
              )}

              <div>
                <label className="input-label">Target Wallet</label>
                <select 
                  className="input-field" 
                  value={formData.wallet_type} 
                  onChange={e => setFormData({ ...formData, wallet_type: e.target.value })}
                >
                  <option value="main">Main Wallet</option>
                  <option value="bonus">Bonus Wallet</option>
                  <option value="referral">Referral Wallet</option>
                  <option value="gaming_bonus">Gaming Bonus</option>
                  <option value="overall">Overall (Any Wallet)</option>
                </select>
              </div>

              <div>
                <label className="input-label">Limit Engine</label>
                <div style={{ display: 'flex', gap: '8px', height: '42px' }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ 
                      flex: 1, 
                      display: 'flex', 
                      gap: '8px', 
                      justifyContent: 'center',
                      background: formData.limit_type === 'percent_of_balance' ? 'var(--accent-primary-glow)' : 'var(--bg-tertiary)',
                      border: formData.limit_type === 'percent_of_balance' ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                      color: formData.limit_type === 'percent_of_balance' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                    }}
                    onClick={() => setFormData({ ...formData, limit_type: 'percent_of_balance' })}
                  >
                    <Percent size={16} /> Percent (%)
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ 
                      flex: 1, 
                      display: 'flex', 
                      gap: '8px', 
                      justifyContent: 'center',
                      background: formData.limit_type === 'fixed' ? 'var(--accent-primary-glow)' : 'var(--bg-tertiary)',
                      border: formData.limit_type === 'fixed' ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                      color: formData.limit_type === 'fixed' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                    }}
                    onClick={() => setFormData({ ...formData, limit_type: 'fixed' })}
                  >
                    <Hash size={16} /> Fixed (₹)
                  </button>
                </div>
              </div>

              <div>
                <label className="input-label">Limit Value {formData.limit_type === 'percent_of_balance' ? '(%)' : '(₹)'}</label>
                <input
                  className="input-field"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  placeholder={formData.limit_type === 'percent_of_balance' ? 'e.g. 50 for 50%' : 'e.g. 1000'}
                  value={formData.limit_value}
                  onChange={e => setFormData({ ...formData, limit_value: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">Time Window</label>
                <select 
                  className="input-field" 
                  value={formData.time_window} 
                  onChange={e => setFormData({ ...formData, time_window: e.target.value as any })}
                >
                  <option value="per_transaction">Per Transaction</option>
                  <option value="daily">Per Day (Daily Limit)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ accentColor: 'var(--accent-primary)', width: '18px', height: '18px' }}
                  />
                  Activate instantly
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start', marginTop: '8px' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : (editingId ? 'Update Rule' : 'Save Rule')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        )}

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                {activeTab === 'individual' && <th>Target User</th>}
                <th>Wallet</th>
                <th>Engine</th>
                <th>Constraint Limit</th>
                <th>Time Window</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLimits.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'individual' ? 7 : 6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    No withdrawal constraints configured here.
                  </td>
                </tr>
              ) : (
                filteredLimits.map(limit => (
                  <tr key={limit.id}>
                    {activeTab === 'individual' && (
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Users size={16} color="var(--accent-secondary)" />
                          User #{limit.user_id}
                          {limit.user_email && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({limit.user_email})</span>}
                        </div>
                      </td>
                    )}
                    <td style={{ textTransform: 'uppercase', fontSize: '0.85rem' }}>
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.08)' }}>{limit.wallet_type.replace('_', ' ')}</span>
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        {limit.limit_type === 'percent_of_balance' ? 'PERCENTAGE' : 'FIXED AMOUNT'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>
                      {limit.limit_type === 'fixed' ? '₹' : ''}
                      {parseFloat(limit.limit_value.toString()).toFixed(2)}
                      {limit.limit_type === 'percent_of_balance' ? '%' : ''}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {limit.time_window.replace('_', ' ')}
                    </td>
                    <td>
                      <span className={`badge ${limit.is_active ? 'badge-active' : 'badge-danger'}`}>
                        {limit.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => handleEdit(limit)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                          <Edit2 size={14}/> Edit
                        </button>
                        <button onClick={() => handleToggleActive(limit)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                          {limit.is_active ? <><PowerOff size={14}/> Disable</> : <><Power size={14}/> Enable</>}
                        </button>
                        <button onClick={() => handleDelete(limit.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--accent-danger)' }}>
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
