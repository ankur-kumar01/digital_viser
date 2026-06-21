import React, { useState, useEffect } from 'react';
import { adminRequest, adminAPI } from '../../api';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Plus, Edit3, Trash2, Save, X, RefreshCw, Bot } from 'lucide-react';
import './AdminFantasy.css';

export const AdminBots: React.FC = () => {
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit modal
  const [showForm, setShowForm] = useState(false);
  const [editingBot, setEditingBot] = useState<any>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchBots = async () => {
    setLoading(true);
    try {
      const data = await adminRequest('GET', '/admin/bots');
      setBots(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBots(); }, []);

  const openCreateForm = () => {
    setEditingBot(null);
    setFormName('');
    setFormEmail('');
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (bot: any) => {
    setEditingBot(bot);
    setFormName(bot.name);
    setFormEmail(bot.email);
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingBot(null);
    setFormName('');
    setFormEmail('');
    setFormError('');
  };

  const handleSave = async () => {
    setFormError('');
    if (!formName.trim()) { setFormError('Bot name is required'); return; }
    if (!formEmail.trim()) { setFormError('Bot email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) { setFormError('Invalid email format'); return; }

    setSaving(true);
    try {
      if (editingBot) {
        await adminRequest('PUT', `/admin/bots/${editingBot.id}`, { name: formName.trim(), email: formEmail.trim() });
      } else {
        await adminRequest('POST', '/admin/bots', { name: formName.trim(), email: formEmail.trim() });
      }
      closeForm();
      fetchBots();
    } catch (err: any) {
      const msg = err?.error || err?.message || 'Failed to save bot';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (bot: any) => {
    try {
      await adminRequest('PUT', `/admin/bots/${bot.id}`, { is_active: !bot.is_active });
      fetchBots();
    } catch (err: any) {
      alert(err?.error || 'Failed to toggle bot status');
    }
  };

  const handleDelete = async (bot: any) => {
    if (!window.confirm(`Delete bot "${bot.name}" (${bot.email})? This action cannot be undone.`)) return;
    try {
      await adminRequest('DELETE', `/admin/bots/${bot.id}`);
      fetchBots();
    } catch (err: any) {
      alert(err?.error || 'Failed to delete bot');
    }
  };

  return (
    <div className="admin-fantasy-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2><Bot size={22} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Game Bots</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="af-btn af-btn-secondary" onClick={fetchBots}><RefreshCw size={16} /> Refresh</button>
          <button className="af-btn af-btn-primary" onClick={openCreateForm}><Plus size={16} /> Add Bot</button>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <table className="af-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bots.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>No bots found. Create your first bot!</td></tr>
            ) : bots.map(bot => (
              <tr key={bot.id}>
                <td>#{bot.id}</td>
                <td><strong>{bot.name}</strong></td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{bot.email}</td>
                <td>
                  <span className={`af-status-badge ${bot.is_active ? 'af-status-upcoming' : 'af-status-cancelled'}`}>
                    {bot.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {new Date(bot.created_at).toLocaleDateString()}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="af-btn af-btn-sm af-btn-secondary" onClick={() => openEditForm(bot)} title="Edit"><Edit3 size={14} /></button>
                    <button className="af-btn af-btn-sm af-btn-secondary" onClick={() => handleToggleActive(bot)} title={bot.is_active ? 'Deactivate' : 'Activate'}>
                      {bot.is_active ? '🟢' : '🔴'}
                    </button>
                    <button className="af-btn af-btn-sm af-btn-danger" onClick={() => handleDelete(bot)} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="af-modal-overlay" onClick={closeForm}>
          <div className="af-modal" onClick={e => e.stopPropagation()}>
            <div className="af-modal-header">
              <h3>{editingBot ? 'Edit Bot' : 'Add New Bot'}</h3>
              <button className="af-btn af-btn-sm af-btn-secondary" onClick={closeForm}><X size={16} /></button>
            </div>
            <div className="af-modal-body">
              {formError && <div className="af-error-banner">{formError}</div>}
              <div className="af-form-grid">
                <div className="af-form-group">
                  <label>Bot Name</label>
                  <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Guest_7842" />
                </div>
                <div className="af-form-group">
                  <label>Bot Email</label>
                  <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="e.g. bot@example.com" />
                </div>
              </div>
            </div>
            <div className="af-modal-footer">
              <button className="af-btn af-btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="af-btn af-btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={16} /> {saving ? 'Saving...' : (editingBot ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
