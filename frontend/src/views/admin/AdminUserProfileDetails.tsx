import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api';
import { ArrowLeft, User, Wallet, Lock, Activity, Clock, Plus, X, Check, FileText, Calendar } from 'lucide-react';
import { createPortal } from 'react-dom';

interface Props {
  userId: number;
  onBack: () => void;
}

export const AdminUserProfileDetails: React.FC<Props> = ({ userId, onBack }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'fdrs' | 'locking'>('overview');
  
  // Modals
  const [showFdrModal, setShowFdrModal] = useState(false);
  const [fdrPlans, setFdrPlans] = useState<any[]>([]);
  const [fdrAmount, setFdrAmount] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [fdrLoading, setFdrLoading] = useState(false);

  const [showLockModal, setShowLockModal] = useState(false);
  const [lockWalletType, setLockWalletType] = useState('normal');
  const [lockAmount, setLockAmount] = useState('');
  const [lockReason, setLockReason] = useState('');
  const [lockDate, setLockDate] = useState('');
  const [lockLoading, setLockLoading] = useState(false);

  const fetchDetails = async () => {
    try {
      const res = await adminAPI.getUserDetails(userId);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch user details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [userId]);

  const loadFdrPlans = async () => {
    try {
      const plans = await adminAPI.getFdrPlans();
      setFdrPlans(plans.filter((p: any) => p.is_active));
      setShowFdrModal(true);
    } catch (err) {
      alert("Failed to load FDR plans");
    }
  };

  const handleCreateFdr = async (e: React.FormEvent) => {
    e.preventDefault();
    setFdrLoading(true);
    try {
      await adminAPI.createUserFDR(userId, {
        amount: parseFloat(fdrAmount),
        plan_id: parseInt(selectedPlanId)
      });
      setShowFdrModal(false);
      setFdrAmount('');
      setSelectedPlanId('');
      fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to create FDR');
    } finally {
      setFdrLoading(false);
    }
  };

  const handleCloseFdr = async (fdrId: number) => {
    if (!window.confirm("Are you sure you want to manually close this FDR? Funds will be refunded to the user's balance.")) return;
    try {
      await adminAPI.closeUserFDR(userId, fdrId);
      fetchDetails();
    } catch (err: any) {
      alert(err.message || "Failed to close FDR");
    }
  };

  const handleLockFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    setLockLoading(true);
    try {
      await adminAPI.lockUserFunds(userId, {
        wallet_type: lockWalletType,
        amount: parseFloat(lockAmount),
        reason: lockReason,
        unlock_date: lockDate || null
      });
      setShowLockModal(false);
      setLockAmount('');
      setLockReason('');
      setLockDate('');
      fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to lock funds');
    } finally {
      setLockLoading(false);
    }
  };

  const handleUnlockFunds = async (lockId: number) => {
    if (!window.confirm("Manually unlock these funds and return them to the user?")) return;
    try {
      await adminAPI.unlockUserFunds(userId, lockId);
      fetchDetails();
    } catch (err: any) {
      alert(err.message || "Failed to unlock");
    }
  };

  if (loading || !data) return <div style={{ padding: '32px' }}>Loading user details...</div>;

  const formatCurrency = (val: string | number) => `₹${parseFloat(val.toString()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
          <ArrowLeft size={18} /> Back
        </button>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{data.user.name}'s Profile</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Detailed view and administrative controls</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
        {['overview', 'transactions', 'fdrs', 'locking'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className="btn"
            style={{ 
              background: activeTab === tab ? 'var(--accent-primary-glow)' : 'transparent',
              color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: 'none',
              padding: '8px 16px',
              textTransform: 'capitalize'
            }}
          >
            {tab === 'fdrs' ? 'FDRs' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
          <div className="glass-card">
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} /> Identity Details
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.95rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>ID:</span>
                <span style={{ fontWeight: 600 }}>#{data.user.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                <span style={{ fontWeight: 600 }}>{data.user.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                <span style={{ fontWeight: 600 }}>{data.user.phone_number || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Address:</span>
                <span style={{ fontWeight: 600 }}>{data.user.address || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Joined:</span>
                <span style={{ fontWeight: 600 }}>{new Date(data.user.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="glass-card">
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet size={18} /> Wallet Balances
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Main Balance</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)', margin: '8px 0' }}>{formatCurrency(data.user.balance)}</div>
                <div style={{ color: 'var(--accent-danger)', fontSize: '0.8rem' }}><Lock size={12} style={{display:'inline'}}/> Locked: {formatCurrency(data.user.locked_balance)}</div>
              </div>
              <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Bonus Balance</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-secondary)', margin: '8px 0' }}>{formatCurrency(data.user.bonus_balance)}</div>
                <div style={{ color: 'var(--accent-danger)', fontSize: '0.8rem' }}><Lock size={12} style={{display:'inline'}}/> Locked: {formatCurrency(data.user.locked_bonus_balance)}</div>
              </div>
              <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Referral Balance</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-info)', margin: '8px 0' }}>{formatCurrency(data.user.referral_balance)}</div>
                <div style={{ color: 'var(--accent-danger)', fontSize: '0.8rem' }}><Lock size={12} style={{display:'inline'}}/> Locked: {formatCurrency(data.user.locked_referral_balance)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '20px' }}>Transaction History</h3>
          <div className="table-container">
            <table className="custom-table">
              <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Description</th></tr></thead>
              <tbody>
                {data.transactions.map((tx: any) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.created_at).toLocaleString()}</td>
                    <td><span className="badge badge-active">{tx.type}</span></td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(tx.amount)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{tx.description}</td>
                  </tr>
                ))}
                {data.transactions.length === 0 && <tr><td colSpan={4} style={{textAlign:'center'}}>No transactions found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'fdrs' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>Fixed Deposit Receipts</h3>
            <button onClick={loadFdrPlans} className="btn btn-primary" style={{ padding: '8px 16px' }}>
              <Plus size={16} /> Create FDR for User
            </button>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead><tr><th>ID</th><th>Interest</th><th>Amount</th><th>Status</th><th>Start Date</th><th>Actions</th></tr></thead>
              <tbody>
                {data.fdrs.map((fdr: any) => (
                  <tr key={fdr.id}>
                    <td>#{fdr.id}</td>
                    <td>{fdr.interest_percent}%</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(fdr.amount)}</td>
                    <td><span className={`badge ${fdr.status === 'active' ? 'badge-active' : 'badge-completed'}`}>{fdr.status}</span></td>
                    <td>{new Date(fdr.start_date).toLocaleDateString()}</td>
                    <td>
                      {fdr.status === 'active' && (
                        <button onClick={() => handleCloseFdr(fdr.id)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--accent-danger)' }}>
                          Close Manually
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.fdrs.length === 0 && <tr><td colSpan={6} style={{textAlign:'center'}}>No FDRs found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'locking' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>Fund Locking Controls</h3>
            <button onClick={() => setShowLockModal(true)} className="btn btn-primary" style={{ padding: '8px 16px', background: 'var(--accent-warning)' }}>
              <Lock size={16} /> Lock Funds
            </button>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead><tr><th>Wallet</th><th>Amount</th><th>Unlock Date</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {data.locked_funds.map((lf: any) => (
                  <tr key={lf.id}>
                    <td style={{textTransform:'capitalize'}}>{lf.wallet_type}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(lf.amount)}</td>
                    <td>{lf.unlock_date ? new Date(lf.unlock_date).toLocaleDateString() : 'Indefinite'}</td>
                    <td><span className={`badge ${lf.status === 'locked' ? 'badge-danger' : 'badge-active'}`}>{lf.status}</span></td>
                    <td>
                      {lf.status === 'locked' && (
                        <button onClick={() => handleUnlockFunds(lf.id)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--accent-secondary)' }}>
                          Unlock Now
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.locked_funds.length === 0 && <tr><td colSpan={5} style={{textAlign:'center'}}>No locked funds found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showFdrModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div className="glass-card" style={{ maxWidth: '400px', width: '100%', padding: '24px', position: 'relative' }}>
            <button onClick={() => setShowFdrModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
            <h3 style={{ marginBottom: '20px' }}>Create FDR for User</h3>
            <form onSubmit={handleCreateFdr} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="input-label">Select Plan</label>
                <select className="input-field" value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)} required>
                  <option value="">-- Choose Plan --</option>
                  {fdrPlans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.interest_rate}% / {p.duration_days} days)</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Amount</label>
                <input type="number" className="input-field" value={fdrAmount} onChange={e => setFdrAmount(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={fdrLoading}>{fdrLoading ? 'Creating...' : 'Create FDR'}</button>
            </form>
          </div>
        </div>, document.body
      )}

      {showLockModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
          <div className="glass-card" style={{ maxWidth: '400px', width: '100%', padding: '24px', position: 'relative' }}>
            <button onClick={() => setShowLockModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
            <h3 style={{ marginBottom: '20px' }}>Manually Lock Funds</h3>
            <form onSubmit={handleLockFunds} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="input-label">Wallet Source</label>
                <select className="input-field" value={lockWalletType} onChange={e => setLockWalletType(e.target.value)} required>
                  <option value="normal">Main Balance</option>
                  <option value="bonus">Bonus Balance</option>
                  <option value="referral">Referral Balance</option>
                </select>
              </div>
              <div>
                <label className="input-label">Amount</label>
                <input type="number" step="0.01" className="input-field" value={lockAmount} onChange={e => setLockAmount(e.target.value)} required />
              </div>
              <div>
                <label className="input-label">Reason / Admin Note</label>
                <input type="text" className="input-field" value={lockReason} onChange={e => setLockReason(e.target.value)} required />
              </div>
              <div>
                <label className="input-label">Unlock Date (Optional)</label>
                <input type="date" className="input-field" value={lockDate} onChange={e => setLockDate(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ background: 'var(--accent-warning)' }} disabled={lockLoading}>{lockLoading ? 'Locking...' : 'Lock Funds'}</button>
            </form>
          </div>
        </div>, document.body
      )}

    </div>
  );
};
