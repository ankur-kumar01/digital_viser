import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api';
import { Plus, Power, PowerOff, Award } from 'lucide-react';

export const AdminFdrPlans: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Plan State
  const [newPlan, setNewPlan] = useState({
    name: '',
    min_amount: '',
    max_amount: '',
    period_days: '',
    interest_percent: '',
    duration_days: ''
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

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleTogglePlan = async (id: number, currentStatus: boolean) => {
    try {
      await adminAPI.updateFdrPlan(id, { is_active: !currentStatus });
      fetchData();
    } catch (err) {
      alert('Failed to update plan');
    }
  };

  if (isLoading) return <div style={{ padding: '32px' }}>Loading FDR Plans...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>FDR Plans</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Create and manage active fixed deposit plans for users.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <form onSubmit={handleCreatePlan} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label className="input-label">Plan Name</label>
              <input className="input-field" value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} required />
            </div>
            <div>
              <label className="input-label">Min Amount</label>
              <input type="number" className="input-field" value={newPlan.min_amount} onChange={e => setNewPlan({...newPlan, min_amount: e.target.value})} required />
            </div>
            <div>
              <label className="input-label">Max Amount</label>
              <input type="number" className="input-field" value={newPlan.max_amount} onChange={e => setNewPlan({...newPlan, max_amount: e.target.value})} required />
            </div>
            <div>
              <label className="input-label">Duration (Days)</label>
              <input type="number" className="input-field" value={newPlan.duration_days} onChange={e => setNewPlan({...newPlan, duration_days: e.target.value})} required />
            </div>
            <div>
              <label className="input-label">Interest %</label>
              <input type="number" step="0.01" className="input-field" value={newPlan.interest_percent} onChange={e => setNewPlan({...newPlan, interest_percent: e.target.value})} required />
            </div>
            <div>
              <label className="input-label">Installment Period (Days)</label>
              <input type="number" className="input-field" value={newPlan.period_days} onChange={e => setNewPlan({...newPlan, period_days: e.target.value})} required />
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
                    <button onClick={() => handleTogglePlan(p.id, !!p.is_active)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                      {p.is_active ? <><PowerOff size={14}/> Disable</> : <><Power size={14}/> Enable</>}
                    </button>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center' }}>No plans configured.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
