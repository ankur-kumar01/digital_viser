import React, { useState, useEffect } from 'react';
import { Users, Copy, CheckCircle2, TrendingUp, Info, Coins } from 'lucide-react';
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
      {/* Anti-Fraud Warning */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(185,28,28,0.03))',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: '16px',
        padding: '18px 22px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
        animation: 'glowPulse 2s ease-in-out infinite',
      }}>
        <div style={{
          fontSize: '1.6rem', flexShrink: 0, lineHeight: 1,
          marginTop: '2px',
        }}>⚠️</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700, fontSize: '0.95rem',
            color: '#ef4444', marginBottom: '4px',
          }}>
            No Fake or Duplicate Accounts
          </div>
          <div style={{
            fontSize: '0.85rem', color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}>
            Creating multiple or fraudulent accounts is strictly prohibited. 
            Family member accounts without prior permission are not allowed. 
            Any such accounts will be <strong style={{ color: '#ef4444' }}>permanently suspended</strong> and 
            <strong style={{ color: '#ef4444' }}> all funds will be forfeited with no refund</strong>.
          </div>
        </div>
        <div style={{
          fontSize: '1.2rem', flexShrink: 0, lineHeight: 1,
          marginTop: '2px', opacity: 0.5, cursor: 'pointer',
        }}
          title="View Terms"
        >⚖️</div>
      </div>
      {/* Dynamic Banner */}
      <div style={{ background: 'var(--accent-primary-glow)', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <Info size={24} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '8px' }}>Referral Rewards Program</h2>
          <ul style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, paddingLeft: '20px', lineHeight: 1.6 }}>
            <li>Earn <strong>10% Fiat Commission</strong> instantly on your referred friend's first deposit!</li>
            <li>Earn <strong>3% Coin Commission</strong> on EVERY approved deposit made by your referred friends!</li>
            <li>Earn <strong>5% Monthly Recurring Fiat Commission</strong> on active FDRs (credited to locked wallet).</li>
            <li>Earn <strong>1% Monthly Recurring Coin Commission</strong> on active FDRs (directly credited daily to your live coin wallet!).</li>
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
          <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Lifetime Fiat Earnings</h4>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>
            {loading ? '...' : formatCurrency(stats?.lifetime_fiat_earnings || stats?.lifetime_earnings || 0)}
          </div>
        </div>
      </div>

      {/* Coin Earnings Dedicated Section */}
      <div className="glass-card" style={{
        background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.08), rgba(245, 158, 11, 0.03))',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        boxShadow: '0 8px 32px rgba(234, 179, 8, 0.08)',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Coins size={24} color="#eab308" />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#eab308', margin: 0 }}>Coin Referral Earnings Breakdown</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(234, 179, 8, 0.15)' }}>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px' }}>Total Coins Earned</h4>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#facc15' }}>
              {loading ? '...' : (stats?.lifetime_coin_earnings || 0).toLocaleString()} 🪙
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Lifetime Coins from Referrals</div>
          </div>

          <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(234, 179, 8, 0.15)' }}>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px' }}>Direct Deposit Coins</h4>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>
              {loading ? '...' : (stats?.coin_earnings_deposit || 0).toLocaleString()} 🪙
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>3% on Referee Deposits</div>
          </div>

          <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(234, 179, 8, 0.15)' }}>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px' }}>FDR Commission Coins</h4>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4ade80' }}>
              {loading ? '...' : (stats?.coin_earnings_fdr || 0).toLocaleString()} 🪙
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>1% Monthly Direct Credit</div>
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
          <div className="table-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="data-table" style={{ width: '100%', minWidth: '600px', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>User Name</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>Joined Date</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>Deposit Status</th>
                  <th style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', textAlign: 'right' }}>Active FDR Volume</th>
                </tr>
              </thead>
              <tbody>
                {stats.referrals.map((r: any) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.name}</td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {formatGlobalDate(r.joined_at, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      {r.has_deposited ? (
                        <span style={{ 
                          color: 'var(--accent-success)', 
                          background: 'rgba(16, 185, 129, 0.1)',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          fontSize: '0.8rem',
                          fontWeight: 600
                        }}>
                          <CheckCircle2 size={14} /> Deposited
                        </span>
                      ) : (
                        <span style={{ 
                          color: 'var(--text-muted)', 
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          display: 'inline-flex',
                          fontSize: '0.8rem' 
                        }}>
                          No Deposit Yet
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--accent-secondary)', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'right' }}>
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
