import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api';
import { Plus, Edit2, Trash2, X, History, BarChart3, Settings2, ToggleLeft, ToggleRight } from 'lucide-react';
import { formatGlobalDate } from '../../utils/dateFormatter';

const PRIZE_TYPE_OPTIONS = [
  { value: 'gaming_bonus', label: 'Gaming Bonus (₹ credited to Gaming Wallet)' },
  { value: 'try_again', label: 'Try Again (No prize)' },
];

const defaultForm = {
  label: '',
  prize_type: 'gaming_bonus',
  prize_amount: '',
  probability: '',
  bg_color: '#22c55e',
  text_color: '#ffffff',
  emoji: '🎁',
  is_active: true,
  sort_order: 0
};

export const AdminSpinWheel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'segments' | 'history' | 'stats'>('segments');
  const [segments, setSegments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>(defaultForm);
  const [globalSettings, setGlobalSettings] = useState<any>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'segments') {
        const data = await adminAPI.getSpinSegments();
        setSegments(data);
        try {
          const settings = await adminAPI.getSettings();
          setGlobalSettings(settings);
        } catch (e) {}
      } else if (activeTab === 'history') {
        const data = await adminAPI.getSpinHistory();
        setHistory(data);
      } else {
        const data = await adminAPI.getSpinStats();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch spin data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setFormData({ ...item, prize_amount: item.prize_amount?.toString(), probability: item.probability?.toString() });
    } else {
      setEditingItem(null);
      setFormData({ ...defaultForm });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        prize_amount: parseFloat(formData.prize_amount) || 0,
        probability: parseInt(formData.probability) || 10,
        sort_order: parseInt(formData.sort_order) || 0,
      };
      if (editingItem) {
        await adminAPI.updateSpinSegment(editingItem.id, payload);
      } else {
        await adminAPI.createSpinSegment(payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      alert(`Save failed: ${(err as Error).message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this segment? Users will no longer land on it.')) return;
    try {
      await adminAPI.deleteSpinSegment(id);
      fetchData();
    } catch (err) {
      alert(`Delete failed: ${(err as Error).message}`);
    }
  };

  const handleToggle = async (item: any) => {
    try {
      await adminAPI.updateSpinSegment(item.id, { ...item, is_active: !item.is_active });
      fetchData();
    } catch (err) {
      alert('Toggle failed');
    }
  };

  const handleToggleSpinWheelSetting = async () => {
    if (!globalSettings) return;
    try {
      const newVal = globalSettings.enable_spin_wheel === 'false' ? 'true' : 'false';
      await adminAPI.updateSettings({ enable_spin_wheel: newVal });
      setGlobalSettings({ ...globalSettings, enable_spin_wheel: newVal });
    } catch (err) {
      alert('Failed to update spin wheel global setting');
    }
  };

  const totalProbability = segments.filter(s => s.is_active).reduce((s, seg) => s + seg.probability, 0);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>🎡 Spin Wheel Manager</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Configure daily spin wheel prizes, probabilities, and monitor user spin activity.</p>
        </div>
        {activeTab === 'segments' && (
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            {globalSettings && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enable Wheel on User Dashboard</span>
                <input 
                  type="checkbox" 
                  checked={globalSettings.enable_spin_wheel !== 'false'} 
                  onChange={handleToggleSpinWheelSetting}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                />
              </label>
            )}
            <button onClick={() => handleOpenModal()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} /> Add Segment
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { id: 'segments', label: 'Wheel Segments', icon: <Settings2 size={16} /> },
          { id: 'history', label: 'Spin History', icon: <History size={16} /> },
          { id: 'stats', label: 'Statistics', icon: <BarChart3 size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
              borderRadius: 'var(--radius-sm)', border: 'none',
              background: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: activeTab === tab.id ? 'var(--bg-primary)' : 'var(--text-primary)',
              fontWeight: activeTab === tab.id ? 600 : 500, cursor: 'pointer', transition: 'var(--transition)'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ padding: '32px' }}>Loading...</div>
      ) : (
        <>
          {/* SEGMENTS TAB */}
          {activeTab === 'segments' && (
            <>
              {/* Probability notice */}
              <div style={{
                padding: '12px 16px', borderRadius: 'var(--radius-md)',
                background: totalProbability !== 100 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                border: `1px solid ${totalProbability !== 100 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                fontSize: '0.875rem', fontWeight: 600,
                color: totalProbability !== 100 ? 'var(--accent-danger)' : 'var(--accent-secondary)'
              }}>
                {totalProbability !== 100
                  ? `⚠️ Active segment probabilities sum to ${totalProbability}. Spin wheel will weight them proportionally.`
                  : `✅ Active segment probabilities sum to ${totalProbability}. Wheel is balanced.`
                }
              </div>

              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Preview</th>
                      <th>Label</th>
                      <th>Prize Type</th>
                      <th>Prize Amount</th>
                      <th>Probability</th>
                      <th>Active</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segments.map(seg => (
                      <tr key={seg.id} style={{ opacity: seg.is_active ? 1 : 0.5 }}>
                        <td>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '8px',
                            background: seg.bg_color, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '18px'
                          }}>
                            {seg.emoji}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{seg.label}</td>
                        <td>
                          <span style={{
                            background: seg.prize_type === 'gaming_bonus' ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                            color: seg.prize_type === 'gaming_bonus' ? 'var(--accent-secondary)' : 'var(--text-muted)',
                            border: `1px solid ${seg.prize_type === 'gaming_bonus' ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.3)'}`,
                            padding: '3px 8px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600
                          }}>
                            {seg.prize_type === 'gaming_bonus' ? '🎮 Gaming Bonus' : '😅 Try Again'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: seg.prize_type === 'try_again' ? 'var(--text-muted)' : 'var(--accent-secondary)' }}>
                          {seg.prize_type === 'try_again' ? '—' : `₹${parseFloat(seg.prize_amount).toFixed(2)}`}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                              width: `${Math.max(4, seg.probability)}px`, height: '8px',
                              background: 'var(--accent-primary)', borderRadius: '4px',
                              maxWidth: '80px'
                            }} />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{seg.probability}</span>
                          </div>
                        </td>
                        <td>
                          <button
                            onClick={() => handleToggle(seg)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            {seg.is_active
                              ? <ToggleRight size={24} color="var(--accent-secondary)" />
                              : <ToggleLeft size={24} color="var(--text-muted)" />
                            }
                          </button>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleOpenModal(seg)}
                              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Edit2 size={14} /> Edit
                            </button>
                            <button
                              onClick={() => handleDelete(seg.id)}
                              style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239,68,68,0.3)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
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
            </>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>User</th>
                    <th>Prize Won</th>
                    <th>Amount</th>
                    <th>Streak Day</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No spins yet.</td></tr>
                  ) : (
                    history.map((h: any) => (
                      <tr key={h.id}>
                        <td style={{ fontSize: '0.85rem' }}>{formatGlobalDate(h.spun_at)}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{h.user_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{h.user_email}</div>
                        </td>
                        <td>
                          <span>{h.emoji} {h.segment_label}</span>
                        </td>
                        <td style={{ fontWeight: 700, color: h.prize_type === 'try_again' ? 'var(--text-muted)' : 'var(--accent-secondary)' }}>
                          {h.prize_type === 'try_again' ? '—' : `₹${parseFloat(h.prize_amount).toFixed(2)}`}
                        </td>
                        <td>
                          <span style={{
                            background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                            border: '1px solid rgba(245,158,11,0.3)',
                            padding: '2px 8px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600
                          }}>
                            🔥 Day {h.streak_day}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={async () => {
                              if (!window.confirm('Delete this spin record? Note: This does not remove funds already credited to the user.')) return;
                              try {
                                await adminAPI.deleteSpinHistory(h.id);
                                fetchData();
                              } catch (err: any) {
                                alert(`Delete failed: ${err.message}`);
                              }
                            }}
                            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239,68,68,0.3)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Delete Record"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* STATS TAB */}
          {activeTab === 'stats' && stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
              {[
                { label: 'Total Spins (All Time)', value: stats.total_spins, color: 'var(--accent-primary)', emoji: '🎡' },
                { label: 'Total Gaming Bonus Distributed', value: `₹${parseFloat(stats.total_gaming_bonus_distributed).toLocaleString('en-IN')}`, color: '#f59e0b', emoji: '💰' },
                { label: "Today's Spins", value: stats.today_spins, color: 'var(--accent-secondary)', emoji: '📅' },
                { label: "Today's Gaming Bonus Given", value: `₹${parseFloat(stats.today_gaming_bonus_distributed).toLocaleString('en-IN')}`, color: '#ec4899', emoji: '🎁' },
              ].map((stat) => (
                <div key={stat.label} className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>{stat.emoji}</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: stat.color, marginBottom: '6px' }}>{stat.value}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '28px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => setIsModalOpen(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={22} />
            </button>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '24px' }}>
              {editingItem ? '✏️ Edit Segment' : '➕ Add New Segment'}
            </h3>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label className="input-label">Label (shown on wheel)</label>
                <input type="text" className="input-field" value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} placeholder="e.g. ₹50 Gaming Bonus" required />
              </div>

              <div className="input-group">
                <label className="input-label">Prize Type</label>
                <select className="input-field" value={formData.prize_type} onChange={e => setFormData({ ...formData, prize_type: e.target.value })} required>
                  {PRIZE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {formData.prize_type === 'gaming_bonus' && (
                <div className="input-group">
                  <label className="input-label">Prize Amount (₹)</label>
                  <input type="number" className="input-field" min="0" step="0.01" value={formData.prize_amount} onChange={e => setFormData({ ...formData, prize_amount: e.target.value })} placeholder="e.g. 50" required />
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Probability Weight <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(higher = more likely)</span></label>
                <input type="number" className="input-field" min="1" max="100" value={formData.probability} onChange={e => setFormData({ ...formData, probability: e.target.value })} placeholder="e.g. 15" required />
              </div>

              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Segment Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="color" value={formData.bg_color} onChange={e => setFormData({ ...formData, bg_color: e.target.value })}
                      style={{ width: '48px', height: '40px', border: 'none', background: 'none', cursor: 'pointer' }} />
                    <input type="text" className="input-field" value={formData.bg_color} onChange={e => setFormData({ ...formData, bg_color: e.target.value })} style={{ flex: 1 }} />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Text Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="color" value={formData.text_color} onChange={e => setFormData({ ...formData, text_color: e.target.value })}
                      style={{ width: '48px', height: '40px', border: 'none', background: 'none', cursor: 'pointer' }} />
                    <input type="text" className="input-field" value={formData.text_color} onChange={e => setFormData({ ...formData, text_color: e.target.value })} style={{ flex: 1 }} />
                  </div>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Emoji</label>
                  <input type="text" className="input-field" value={formData.emoji} onChange={e => setFormData({ ...formData, emoji: e.target.value })} placeholder="🎁" maxLength={4} />
                </div>
                <div className="input-group">
                  <label className="input-label">Sort Order</label>
                  <input type="number" className="input-field" min="0" value={formData.sort_order} onChange={e => setFormData({ ...formData, sort_order: e.target.value })} placeholder="0" />
                </div>
              </div>

              {/* Preview */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: formData.bg_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                  {formData.emoji}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: formData.bg_color }}>{formData.label || 'Segment Label'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Weight: {formData.probability} | {formData.prize_type === 'gaming_bonus' ? `₹${formData.prize_amount || 0} Gaming Bonus` : 'Try Again'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingItem ? 'Update Segment' : 'Save Segment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
