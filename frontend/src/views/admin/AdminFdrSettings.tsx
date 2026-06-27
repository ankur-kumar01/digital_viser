import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, Power, Receipt, Sparkles, Percent, Hash, PowerOff } from 'lucide-react';
import { adminAPI } from '../../api';
import { LoadingSpinner } from '../../components/LoadingSpinner';

interface ClosureCharge {
  id: number;
  closure_type: 'force_close' | 'normal_close';
  name: string;
  charge_type: 'fixed' | 'percent';
  value: number;
  is_active: number | boolean;
}

export const AdminFdrSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'force_close' | 'normal_close'>('force_close');
  const [charges, setCharges] = useState<ClosureCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    charge_type: 'percent',
    value: '',
    is_active: true
  });

  const fetchCharges = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getFdrClosureCharges();
      setCharges(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch charges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharges();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      const payload = {
        closure_type: activeTab,
        name: formData.name,
        charge_type: formData.charge_type,
        value: parseFloat(formData.value) || 0,
        is_active: formData.is_active
      };

      if (editingId) {
        await adminAPI.updateFdrClosureCharge(editingId, payload);
      } else {
        await adminAPI.createFdrClosureCharge(payload);
      }
      
      await fetchCharges();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save charge');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (charge: ClosureCharge) => {
    try {
      await adminAPI.updateFdrClosureCharge(charge.id, {
        ...charge,
        is_active: charge.is_active ? false : true
      });
      fetchCharges();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle status');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this charge permanently?')) return;
    try {
      await adminAPI.deleteFdrClosureCharge(id);
      fetchCharges();
    } catch (err: any) {
      setError(err.message || 'Failed to delete charge');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', charge_type: 'percent', value: '', is_active: true });
    setError('');
  };

  const handleEdit = (charge: ClosureCharge) => {
    setEditingId(charge.id);
    setFormData({
      name: charge.name,
      charge_type: charge.charge_type,
      value: charge.value.toString(),
      is_active: !!charge.is_active
    });
    setShowForm(true);
  };

  if (loading && charges.length === 0) return <div style={{ padding: '32px' }}><LoadingSpinner /></div>;

  const filteredCharges = charges.filter(c => c.closure_type === activeTab);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>FDR Closure Settings</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Manage force close penalties and normal maturity deductions.</p>
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
          onClick={() => { setActiveTab('force_close'); resetForm(); }}
          className="btn"
          style={{ 
            background: activeTab === 'force_close' ? 'var(--accent-primary-glow)' : 'transparent',
            color: activeTab === 'force_close' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            border: activeTab === 'force_close' ? '1px solid var(--accent-primary)' : '1px solid transparent',
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            fontWeight: 600,
            display: 'flex', gap: '8px', alignItems: 'center'
          }}
        >
          <Receipt size={18} /> Force Close Penalty
        </button>
        <button 
          onClick={() => { setActiveTab('normal_close'); resetForm(); }}
          className="btn"
          style={{ 
            background: activeTab === 'normal_close' ? 'var(--accent-primary-glow)' : 'transparent',
            color: activeTab === 'normal_close' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            border: activeTab === 'normal_close' ? '1px solid var(--accent-primary)' : '1px solid transparent',
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            fontWeight: 600,
            display: 'flex', gap: '8px', alignItems: 'center'
          }}
        >
          <Sparkles size={18} /> Normal Maturity Charges
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            {activeTab === 'force_close' ? 'Active Force Close Charges' : 'Active Maturity Deductions'}
          </h3>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} /> Add New Charge
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              {editingId ? 'Edit Charge' : 'Create New Charge'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label className="input-label">Custom Charge Name</label>
                <input
                  className="input-field"
                  type="text"
                  required
                  placeholder="e.g. Processing Fee"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="input-label">Charge Type</label>
                <div style={{ display: 'flex', gap: '8px', height: '42px' }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ 
                      flex: 1, 
                      display: 'flex', 
                      gap: '8px', 
                      justifyContent: 'center',
                      background: formData.charge_type === 'percent' ? 'var(--accent-primary-glow)' : 'var(--bg-tertiary)',
                      border: formData.charge_type === 'percent' ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                      color: formData.charge_type === 'percent' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                    }}
                    onClick={() => setFormData({ ...formData, charge_type: 'percent' })}
                  >
                    <Percent size={16} /> Percentage
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ 
                      flex: 1, 
                      display: 'flex', 
                      gap: '8px', 
                      justifyContent: 'center',
                      background: formData.charge_type === 'fixed' ? 'var(--accent-primary-glow)' : 'var(--bg-tertiary)',
                      border: formData.charge_type === 'fixed' ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                      color: formData.charge_type === 'fixed' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                    }}
                    onClick={() => setFormData({ ...formData, charge_type: 'fixed' })}
                  >
                    <Hash size={16} /> Fixed Amount
                  </button>
                </div>
              </div>
              <div>
                <label className="input-label">Charge Value {formData.charge_type === 'percent' ? '(%)' : '(₹)'}</label>
                <input
                  className="input-field"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.value}
                  onChange={e => setFormData({ ...formData, value: e.target.value })}
                />
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
                {submitting ? 'Saving...' : (editingId ? 'Update Charge' : 'Save Charge')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        )}

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Charge Name</th>
                <th>Type</th>
                <th>Value</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCharges.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    No charges configured for this type yet.
                  </td>
                </tr>
              ) : (
                filteredCharges.map(charge => (
                  <tr key={charge.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        <Receipt size={16} color="var(--accent-primary)" />
                        {charge.name}
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        {charge.charge_type === 'percent' ? 'PERCENT' : 'FIXED'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>
                      {charge.charge_type === 'fixed' ? '₹' : ''}
                      {parseFloat(charge.value.toString()).toFixed(2)}
                      {charge.charge_type === 'percent' ? '%' : ''}
                    </td>
                    <td>
                      <span className={`badge ${charge.is_active ? 'badge-active' : 'badge-danger'}`}>
                        {charge.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => handleEdit(charge)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                          <Edit2 size={14}/> Edit
                        </button>
                        <button onClick={() => handleToggleActive(charge)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                          {charge.is_active ? <><PowerOff size={14}/> Disable</> : <><Power size={14}/> Enable</>}
                        </button>
                        <button onClick={() => handleDelete(charge.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--accent-danger)' }}>
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
