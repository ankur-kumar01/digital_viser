import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../api';
import { Plus, Check, X, Gift, Edit2 } from 'lucide-react';

export const AdminSchemes: React.FC = () => {
  const [schemes, setSchemes] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingScheme, setEditingScheme] = useState<any | null>(null);
  const [formData, setFormData] = useState({ type: 'referral_percent', min_amount: '', reward_amount: '' });

  useEffect(() => {
    loadSchemes();
  }, []);

  const loadSchemes = async () => {
    try {
      const data = await adminAPI.getSchemes();
      setSchemes(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingScheme) {
        await adminAPI.updateScheme(editingScheme.id, {
          type: formData.type,
          min_amount: formData.min_amount ? parseFloat(formData.min_amount) : 0,
          reward_amount: parseFloat(formData.reward_amount),
        });
      } else {
        await adminAPI.createScheme({
          type: formData.type,
          min_amount: formData.min_amount ? parseFloat(formData.min_amount) : 0,
          reward_amount: parseFloat(formData.reward_amount),
        });
      }
      setShowModal(false);
      setEditingScheme(null);
      setFormData({ type: 'referral_percent', min_amount: '', reward_amount: '' });
      loadSchemes();
    } catch (err) {
      alert('Failed to save scheme');
    }
  };

  const handleEdit = (scheme: any) => {
    setEditingScheme(scheme);
    setFormData({
      type: scheme.type,
      min_amount: scheme.min_amount?.toString() || '',
      reward_amount: scheme.reward_amount?.toString() || '',
    });
    setShowModal(true);
  };

  const toggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      await adminAPI.updateScheme(id, { is_active: !currentStatus });
      loadSchemes();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this scheme?')) return;
    try {
      await adminAPI.deleteScheme(id);
      loadSchemes();
    } catch (err) {
      alert('Failed to delete scheme');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingScheme(null);
    setFormData({ type: 'referral_percent', min_amount: '', reward_amount: '' });
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gift size={24} /> Reward Schemes
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Configure FDR and Referral bonuses.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Scheme
        </button>
      </div>

      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-glass)', background: 'rgba(255, 255, 255, 0.02)' }}>
              <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Type</th>
              <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Min Requirement</th>
              <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Reward Amount</th>
              <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status</th>
              <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {schemes.map((scheme) => (
              <tr key={scheme.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <td style={{ padding: '16px 24px' }}>
                  {scheme.type === 'fdr_bonus' ? 'FDR Creation Bonus' : scheme.type === 'referral_percent' ? '1st Deposit Referral Commission' : scheme.type === 'fdr_referral_percent' ? 'FDR Recurring Commission' : 'Referral Bonus'}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  {scheme.type === 'fdr_bonus' ? `₹${scheme.min_amount} FDR` : scheme.type === 'referral_percent' ? '1st Approved Deposit' : 'Monthly FDR Active Volume'}
                </td>
                <td style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                  {scheme.type === 'referral_percent' || scheme.type === 'fdr_referral_percent' ? `${scheme.reward_amount}%` : `₹${scheme.reward_amount}`}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className={`badge ${scheme.is_active ? 'badge-success' : 'badge-danger'}`}>
                    {scheme.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => handleEdit(scheme)}
                    className="btn" 
                    style={{ padding: '6px 12px', fontSize: '0.85rem', background: 'var(--bg-tertiary)' }}
                  >
                    <Edit2 size={14} /> Edit
                  </button>
                  <button 
                    onClick={() => toggleStatus(scheme.id, scheme.is_active)}
                    className="btn" 
                    style={{ padding: '6px 12px', fontSize: '0.85rem', background: 'var(--bg-tertiary)' }}
                  >
                    {scheme.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button 
                    onClick={() => handleDelete(scheme.id)}
                    className="btn" 
                    style={{ padding: '6px 12px', fontSize: '0.85rem', background: 'var(--accent-danger)', color: 'white', border: 'none' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {schemes.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No reward schemes configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{editingScheme ? 'Edit Reward Scheme' : 'Create Reward Scheme'}</h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="input-label">Scheme Type</label>
                <select 
                  className="input-field" 
                  value={formData.type} 
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  required
                  disabled={!!editingScheme}
                >
                  <option value="referral_percent">Referral Commission (Percentage of 1st Deposit)</option>
                  <option value="fdr_referral_percent">FDR Recurring Commission (Monthly Percentage)</option>
                  <option value="fdr_bonus">FDR Creation Bonus (Flat Amount)</option>
                </select>
              </div>

              {formData.type === 'fdr_bonus' && (
                <div>
                  <label className="input-label">Minimum FDR Amount (₹)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={formData.min_amount} 
                    onChange={(e) => setFormData({...formData, min_amount: e.target.value})}
                    required
                    min="0"
                  />
                </div>
              )}

              <div>
                <label className="input-label">
                  {formData.type === 'referral_percent' || formData.type === 'fdr_referral_percent' ? 'Reward Bonus Percentage (%)' : 'Reward Bonus Amount (₹)'}
                </label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={formData.reward_amount} 
                  onChange={(e) => setFormData({...formData, reward_amount: e.target.value})}
                  required
                  min="0"
                  max={formData.type === 'referral_percent' || formData.type === 'fdr_referral_percent' ? "100" : undefined}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn" style={{ flex: 1, background: 'var(--bg-tertiary)' }} onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editingScheme ? 'Save Changes' : 'Create Scheme'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
