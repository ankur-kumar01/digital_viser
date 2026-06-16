import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api';
import { Percent, Clock, Plus, Trash2, Calendar, Edit, Power, PowerOff, Award, X } from 'lucide-react';
import { formatGlobalDate, parseAdminInputDateToGlobalUTC } from '../../utils/dateFormatter';

export const AdminFdrPlans: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'plans' | 'offers'>('plans');

  // New Plan State
  const [newPlan, setNewPlan] = useState({
    name: '',
    min_amount: '',
    max_amount: '',
    period_days: '',
    interest_percent: '',
    duration_days: ''
  });

  // Edit Plan State
  const [editingPlan, setEditingPlan] = useState<any | null>(null);

  // Offers State
  const [offers, setOffers] = useState<any[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [newOffer, setNewOffer] = useState({
    name: '',
    bonus_percent: '',
    start_time: '',
    end_time: ''
  });

  const fetchData = async () => {
    try {
      const plansData = await adminAPI.getFdrPlans();
      setPlans(plansData);
    } catch (err) {
      console.error('Failed to fetch FDR plans:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOffers = async () => {
    setIsLoadingOffers(true);
    try {
      const offersData = await adminAPI.getFdrOffers();
      setOffers(offersData);
    } catch (err) {
      console.error('Failed to fetch FDR offers:', err);
    } finally {
      setIsLoadingOffers(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'offers') {
      fetchOffers();
    }
  }, [activeTab]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.createFdrPlan({
        name: newPlan.name,
        min_amount: parseFloat(newPlan.min_amount),
        max_amount: parseFloat(newPlan.max_amount),
        period_days: parseInt(newPlan.period_days),
        interest_percent: parseFloat(newPlan.interest_percent),
        duration_days: parseInt(newPlan.duration_days),
        is_active: true
      });
      setNewPlan({ name: '', min_amount: '', max_amount: '', period_days: '', interest_percent: '', duration_days: '' });
      fetchData();
    } catch (err) {
      alert('Failed to create FDR plan');
    }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    try {
      await adminAPI.updateFdrPlan(editingPlan.id, {
        name: editingPlan.name,
        min_amount: parseFloat(editingPlan.min_amount),
        max_amount: parseFloat(editingPlan.max_amount),
        period_days: parseInt(editingPlan.period_days),
        interest_percent: parseFloat(editingPlan.interest_percent),
        duration_days: parseInt(editingPlan.duration_days),
        is_active: !!editingPlan.is_active
      });
      setEditingPlan(null);
      fetchData();
    } catch (err) {
      alert('Failed to update FDR plan');
    }
  };

  const handleTogglePlan = async (id: number, currentStatus: boolean) => {
    try {
      await adminAPI.updateFdrPlan(id, { is_active: !currentStatus });
      fetchData();
    } catch (err) {
      alert('Failed to update plan');
    }
  };

  const handleDeletePlan = async (id: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this FDR plan? Existing FDRs under this plan will not be affected.")) return;
    try {
      await adminAPI.deleteFdrPlan(id);
      fetchData();
    } catch (err) {
      alert('Failed to delete plan');
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminAPI.createFdrOffer({
        name: newOffer.name,
        bonus_percent: parseFloat(newOffer.bonus_percent),
        start_time: parseAdminInputDateToGlobalUTC(newOffer.start_time),
        end_time: parseAdminInputDateToGlobalUTC(newOffer.end_time),
        is_active: true
      });
      setNewOffer({ name: '', bonus_percent: '', start_time: '', end_time: '' });
      fetchOffers();
    } catch (err) {
      alert('Failed to create FDR offer');
    }
  };

  const handleToggleOffer = async (id: number, currentStatus: boolean) => {
    try {
      await adminAPI.updateFdrOffer(id, { is_active: !currentStatus });
      fetchOffers();
    } catch (err) {
      alert('Failed to update offer');
    }
  };

  const handleDeleteOffer = async (id: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this promotional offer?")) return;
    try {
      await adminAPI.deleteFdrOffer(id);
      fetchOffers();
    } catch (err) {
      alert('Failed to delete offer');
    }
  };

  const getOfferStatus = (offer: any) => {
    if (!offer.is_active) return { label: 'Disabled', class: 'badge-danger' };
    const now = new Date().getTime();
    
    const startStr = offer.start_time.includes('Z') ? offer.start_time : offer.start_time.replace(' ', 'T') + 'Z';
    const endStr = offer.end_time.includes('Z') ? offer.end_time : offer.end_time.replace(' ', 'T') + 'Z';
    
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();

    if (now < start) return { label: 'Upcoming', style: { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' } };
    if (now > end) return { label: 'Expired', style: { background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af' } };
    return { label: 'Active', class: 'badge-active' };
  };

  const formatDate = (dtStr: string) => {
    return formatGlobalDate(dtStr, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) return <div style={{ padding: '32px' }}>Loading FDR System...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>FDR Configurations</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Configure deposit plans and run percentage promotional offers.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
        <button 
          onClick={() => setActiveTab('plans')}
          className="btn"
          style={{ 
            background: activeTab === 'plans' ? 'var(--accent-primary-glow)' : 'transparent',
            color: activeTab === 'plans' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            border: activeTab === 'plans' ? '1px solid var(--accent-primary)' : '1px solid transparent',
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            fontWeight: 600
          }}
        >
          📁 FDR Plans
        </button>
        <button 
          onClick={() => setActiveTab('offers')}
          className="btn"
          style={{ 
            background: activeTab === 'offers' ? 'var(--accent-primary-glow)' : 'transparent',
            color: activeTab === 'offers' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            border: activeTab === 'offers' ? '1px solid var(--accent-primary)' : '1px solid transparent',
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            fontWeight: 600
          }}
        >
          🎁 Promotional Offers
        </button>
      </div>

      {activeTab === 'plans' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <form onSubmit={handleCreatePlan} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Add New FDR Plan</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label className="input-label">Plan Name</label>
                <input className="input-field" value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} required placeholder="e.g. Silver Plan" />
              </div>
              <div>
                <label className="input-label">Min Amount</label>
                <input type="number" className="input-field" value={newPlan.min_amount} onChange={e => setNewPlan({...newPlan, min_amount: e.target.value})} required placeholder="e.g. 500" />
              </div>
              <div>
                <label className="input-label">Max Amount</label>
                <input type="number" className="input-field" value={newPlan.max_amount} onChange={e => setNewPlan({...newPlan, max_amount: e.target.value})} required placeholder="e.g. 50000" />
              </div>
              <div>
                <label className="input-label">Duration (Days)</label>
                <input type="number" className="input-field" value={newPlan.duration_days} onChange={e => setNewPlan({...newPlan, duration_days: e.target.value})} required placeholder="e.g. 365" />
              </div>
              <div>
                <label className="input-label">Interest %</label>
                <input type="number" step="0.01" className="input-field" value={newPlan.interest_percent} onChange={e => setNewPlan({...newPlan, interest_percent: e.target.value})} required placeholder="e.g. 12.5" />
              </div>
              <div>
                <label className="input-label">Installment Period (Days)</label>
                <input type="number" className="input-field" value={newPlan.period_days} onChange={e => setNewPlan({...newPlan, period_days: e.target.value})} required placeholder="e.g. 30" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              <Plus size={18} /> Add Plan
            </button>
          </form>

          <div className="table-container">
            <table className="custom-table">
              <thead><tr><th>Name</th><th>Amount Range</th><th>Duration</th><th>Interest</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
              <tbody>
                {plans.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Award size={16} color="var(--accent-primary)" />
                        {p.name}
                      </div>
                    </td>
                    <td>₹{p.min_amount} - ₹{p.max_amount}</td>
                    <td>{p.duration_days} Days</td>
                    <td>{p.interest_percent}% / {p.period_days} Days</td>
                    <td>
                      <span className={`badge ${p.is_active ? 'badge-active' : 'badge-danger'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditingPlan(p)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                          <Edit size={14}/> Edit
                        </button>
                        <button onClick={() => handleTogglePlan(p.id, !!p.is_active)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                          {p.is_active ? <><PowerOff size={14}/> Disable</> : <><Power size={14}/> Enable</>}
                        </button>
                        <button onClick={() => handleDeletePlan(p.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--accent-danger)' }}>
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {plans.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center' }}>No plans configured.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <form onSubmit={handleCreateOffer} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Launch Promotional Offer</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label className="input-label">Offer Name</label>
                <input className="input-field" value={newOffer.name} onChange={e => setNewOffer({...newOffer, name: e.target.value})} required placeholder="e.g. Diwali Mega 50% Bonus" />
              </div>
              <div>
                <label className="input-label">Bonus Wallet Credit (%)</label>
                <input type="number" step="0.1" className="input-field" value={newOffer.bonus_percent} onChange={e => setNewOffer({...newOffer, bonus_percent: e.target.value})} required placeholder="e.g. 50" />
              </div>
              <div>
                <label className="input-label">Start Date & Time</label>
                <input type="datetime-local" className="input-field" value={newOffer.start_time} onChange={e => setNewOffer({...newOffer, start_time: e.target.value})} required />
              </div>
              <div>
                <label className="input-label">End Date & Time</label>
                <input type="datetime-local" className="input-field" value={newOffer.end_time} onChange={e => setNewOffer({...newOffer, end_time: e.target.value})} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              <Plus size={18} /> Launch Offer
            </button>
          </form>

          {isLoadingOffers ? (
            <div>Loading offers list...</div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead><tr><th>Offer Name</th><th>Bonus Percent</th><th>Start Time</th><th>End Time</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody>
                  {offers.map(o => {
                    const status = getOfferStatus(o);
                    return (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Percent size={16} color="var(--accent-secondary)" />
                            {o.name}
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>{parseFloat(o.bonus_percent)}%</td>
                        <td><Calendar size={12} style={{display:'inline', marginRight:'4px'}}/> {formatDate(o.start_time)}</td>
                        <td><Clock size={12} style={{display:'inline', marginRight:'4px'}}/> {formatDate(o.end_time)}</td>
                        <td>
                          {status.class ? (
                            <span className={`badge ${status.class}`}>
                              {status.label}
                            </span>
                          ) : (
                            <span className="badge" style={status.style}>
                              {status.label}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button onClick={() => handleToggleOffer(o.id, !!o.is_active)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                              {o.is_active ? <><PowerOff size={14}/> Disable</> : <><Power size={14}/> Enable</>}
                            </button>
                            <button onClick={() => handleDeleteOffer(o.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--accent-danger)' }}>
                              <Trash2 size={14}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {offers.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center' }}>No promotional offers launched yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {editingPlan && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '32px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Edit FDR Plan</h3>
              <button onClick={() => setEditingPlan(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdatePlan} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="input-label">Plan Name</label>
                <input className="input-field" value={editingPlan.name} onChange={e => setEditingPlan({...editingPlan, name: e.target.value})} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="input-label">Min Amount</label>
                  <input type="number" className="input-field" value={editingPlan.min_amount} onChange={e => setEditingPlan({...editingPlan, min_amount: e.target.value})} required />
                </div>
                <div>
                  <label className="input-label">Max Amount</label>
                  <input type="number" className="input-field" value={editingPlan.max_amount} onChange={e => setEditingPlan({...editingPlan, max_amount: e.target.value})} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="input-label">Duration (Days)</label>
                  <input type="number" className="input-field" value={editingPlan.duration_days} onChange={e => setEditingPlan({...editingPlan, duration_days: e.target.value})} required />
                </div>
                <div>
                  <label className="input-label">Interest %</label>
                  <input type="number" step="0.01" className="input-field" value={editingPlan.interest_percent} onChange={e => setEditingPlan({...editingPlan, interest_percent: e.target.value})} required />
                </div>
              </div>
              <div>
                <label className="input-label">Installment Period (Days)</label>
                <input type="number" className="input-field" value={editingPlan.period_days} onChange={e => setEditingPlan({...editingPlan, period_days: e.target.value})} required />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn" style={{ flex: 1, background: 'var(--bg-tertiary)' }} onClick={() => setEditingPlan(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
