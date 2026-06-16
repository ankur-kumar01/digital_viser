import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api';
import { Users, Wallet, PiggyBank, Clock } from 'lucide-react';
import { formatGlobalDate } from '../../utils/dateFormatter';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await adminAPI.getStats();
        setStats(res);
      } catch (err) {
        console.error('Failed to fetch admin stats:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) return <div style={{ padding: '32px' }}>Loading statistics...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Platform Overview</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Key metrics and financial health of the platform.</p>
      </div>

      <div className="dashboard-grid">
        {/* Total Users */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '4px solid var(--accent-info)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', background: 'var(--accent-info-glow)', borderRadius: '12px', color: 'var(--accent-info)' }}>
              <Users size={24} />
            </div>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.85rem' }}>Total Users</span>
          </div>
          <div className="metric-val">{stats?.totalUsers || 0}</div>
        </div>

        {/* Wallet Funds */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '4px solid var(--accent-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', background: 'var(--accent-secondary-glow)', borderRadius: '12px', color: 'var(--accent-secondary)' }}>
              <Wallet size={24} />
            </div>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.85rem' }}>Total Wallet Funds</span>
          </div>
          <div className="metric-val">₹{parseFloat(stats?.totalWalletFunds || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>

        {/* FDR Funds */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '4px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', background: 'var(--accent-primary-glow)', borderRadius: '12px', color: 'var(--accent-primary)' }}>
              <PiggyBank size={24} />
            </div>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.85rem' }}>Total Active FDRs</span>
          </div>
          <div className="metric-val">₹{parseFloat(stats?.totalFdrFunds || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>

        {/* Cron Last Run */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '4px solid var(--accent-warning)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', background: 'var(--accent-warning-glow, rgba(234, 179, 8, 0.1))', borderRadius: '12px', color: 'var(--accent-warning, #eab308)' }}>
              <Clock size={24} />
            </div>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.85rem' }}>Cron Last Run</span>
          </div>
          <div className="metric-val" style={{ fontSize: '1.2rem' }}>
            {stats?.cronLastRun ? formatGlobalDate(stats.cronLastRun, {
              hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
            }) : 'Never'}
          </div>
        </div>
      </div>
    </div>
  );
};
