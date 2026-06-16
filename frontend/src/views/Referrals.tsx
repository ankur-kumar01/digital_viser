import React, { useState, useEffect } from 'react';
import { Users, Copy, CheckCircle2, TrendingUp, Info } from 'lucide-react';
import { authAPI } from '../api';
import { formatGlobalDate } from '../utils/dateFormatter';

interface ReferralsProps {
  user: any;
}

export const Referrals: React.FC<ReferralsProps> = ({ user }) => {
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const referralLink = `${window.location.origin}/register?ref=${user?.referral_code}`;

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await authAPI.getReferralStats();
        setStats(data);
      } catch (err) {
        console.error("Failed to fetch referral stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (val: number | string) => `₹${parseFloat(val.toString()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '900px' }}>
      
      {/* Dynamic Banner */}
      <div style={{ background: 'var(--accent-primary-glow)', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <Info size={24} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '8px' }}>Referral Rewards Program</h2>
          <ul style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, paddingLeft: '20px', lineHeight: 1.6 }}>
            <li>Earn <strong>10% Commission</strong> instantly on your referred friend's first deposit!</li>
            <li>Earn <strong>5% Monthly Recurring Commission</strong> on the total active FDRs held by your referred friends (credited to locked wallet and released monthly).</li>
          </ul>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'var(--accent-primary)', color: 'var(--bg-primary)', padding: '16px', borderRadius: '50%' }}>
              <Users size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Your Referral Link</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Share this link to invite others</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="text" 
              readOnly 
              value={referralLink} 
              className="input-field" 
              style={{ flex: 1, cursor: 'text' }}
            />
            <button 
              className={`btn ${copied ? 'btn-success' : 'btn-primary'}`} 
              onClick={copyToClipboard}
              style={{ minWidth: '120px' }}
            >
              {copied ? <><CheckCircle2 size={18} /> Copied!</> : <><Copy size={18} /> Copy Link</>}
            </button>
          </div>
        </div>

        <div className="glass-card" style={{ textAlign: 'center', padding: '32px' }}>
          <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Available Referral Balance</h4>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
            {formatCurrency(user?.referral_balance || 0)}
          </div>
        </div>

        <div className="glass-card" style={{ textAlign: 'center', padding: '32px' }}>
          <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Locked Referral Funds</h4>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-info)' }}>
            {formatCurrency(user?.locked_referral_balance || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>(Releases monthly)</div>
        </div>

        <div className="glass-card" style={{ textAlign: 'center', padding: '32px' }}>
          <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Lifetime Earnings</h4>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>
            {loading ? '...' : formatCurrency(stats?.lifetime_earnings || 0)}
          </div>
        </div>
      </div>

      <div className="glass-card">
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} /> Referred Friends
        </h3>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading referrals...</div>
        ) : stats?.referrals?.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Joined Date</th>
                  <th>Deposit Status</th>
                  <th>Active FDR Volume</th>
                </tr>
              </thead>
              <tbody>
                {stats.referrals.map((r: any) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>{formatGlobalDate(r.joined_at, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td>
                      {r.has_deposited ? (
                        <span style={{ color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                          <CheckCircle2 size={14} /> Deposited
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No Deposit Yet</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>
                      {formatCurrency(r.active_fdr_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}>
            You haven't referred anyone yet. Share your link to get started!
          </div>
        )}
      </div>

    </div>
  );
};
