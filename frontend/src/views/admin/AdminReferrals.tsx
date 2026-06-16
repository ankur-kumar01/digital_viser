import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../api';
import { Users, Coins, TrendingUp, CheckCircle2, Lock, Unlock, ArrowRight } from 'lucide-react';

export const AdminReferrals: React.FC = () => {
  const [distributing, setDistributing] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await adminAPI.getReferralStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch referral stats');
    } finally {
      setLoading(false);
    }
  };


  const handleRelease = async () => {
    if (!window.confirm("Release ALL locked referral funds to the main referral wallets globally? Users will be able to withdraw these funds immediately.")) return;
    setReleasing(true);
    try {
      const res = await adminAPI.releaseLockedReferral();
      alert(`Success! Released ₹${res.total_released} across ${res.users_affected} users.`);
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Release failed');
    } finally {
      setReleasing(false);
    }
  };

  const formatCurrency = (val: number | string) => `₹${parseFloat(val.toString()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '1200px' }}>
      <div>
        <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>Referral Analytics & Management</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Overview of the referral system and manual commission controls.</p>
      </div>

      {/* Analytics Dashboard */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading Analytics...</div>
      ) : stats ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Total Referrers</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{stats.total_referrers}</div>
          </div>
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Total Referred Users</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{stats.total_referred}</div>
          </div>
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>1st Deposit Comms Paid</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{formatCurrency(stats.total_first_deposit_paid)}</div>
          </div>
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Pending Locked FDR Comms</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-warning)' }}>{formatCurrency(stats.total_fdr_locked)}</div>
          </div>
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Released FDR Comms</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-success)' }}>{formatCurrency(stats.total_fdr_released)}</div>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        
        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Commission Controls</h3>
          

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'var(--accent-success-glow)', color: 'var(--accent-success)', padding: '16px', borderRadius: '50%' }}>
                <Unlock size={24} />
              </div>
              <div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Global Fund Release</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Unlocks funds for user withdrawal.</p>
              </div>
            </div>
            <button className="btn btn-success" onClick={handleRelease} disabled={releasing}>
              {releasing ? 'Releasing...' : 'Release Locked Funds'}
            </button>
          </div>
        </div>

        {/* Top Referrers */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={20} color="var(--accent-primary)" /> Top 10 Referrers
          </h3>
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading leaderboard...</div>
          ) : stats?.top_referrers?.length > 0 ? (
            <div className="table-container" style={{ margin: 0 }}>
              <table className="data-table" style={{ fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th style={{ textAlign: 'center' }}>Invites</th>
                    <th style={{ textAlign: 'right' }}>Total Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_referrers.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(#{r.id})</span></td>
                      <td style={{ textAlign: 'center' }}>{r.total_referrals}</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent-secondary)', fontWeight: 600 }}>{formatCurrency(r.total_earned)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No referral data found.</div>
          )}
        </div>

      </div>
    </div>
  );
};
