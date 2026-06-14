import React, { useState, useEffect } from 'react';
import { MetricCard } from '../components/MetricCard';
import { walletAPI, fdrAPI } from '../api';
import { Wallet, Award, History, ArrowRight, ArrowUpRight, ArrowDownLeft, PiggyBank, TrendingUp, CalendarDays, Gift, Users, PlusCircle, Activity } from 'lucide-react';
import { PortfolioHero } from '../components/PortfolioHero';

interface DashboardOverviewProps {
  user: {
    name: string;
    email: string;
    balance: number | string;
    locked_balance: number | string;
    bonus_balance: number | string;
    locked_bonus_balance: number | string;
    referral_balance: number | string;
    locked_referral_balance: number | string;
  } | null;
  onNavigate: (view: string) => void;
  refreshUser: () => Promise<void>;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  user,
  onNavigate
}) => {
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [activeFDRCount, setActiveFDRCount] = useState(0);
  const [totalFDRFunds, setTotalFDRFunds] = useState(0);
  const [totalInterestEarned, setTotalInterestEarned] = useState(0);
  const [upcomingProfit7, setUpcomingProfit7] = useState(0);
  const [upcomingProfit30, setUpcomingProfit30] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  const loadData = async () => {
    try {
      // Load transactions to calculate total deposits and withdrawals
      const txs = await walletAPI.getTransactions();
      const withdrawalsTotal = txs
        .filter((tx: any) => tx.type === 'withdrawal' || tx.type === 'withdrawal_approved')
        .reduce((sum: number, tx: any) => sum + parseFloat(tx.amount), 0);
      setTotalWithdrawn(withdrawalsTotal);
      
      // Store top 5 recent transactions
      setRecentTransactions(txs.slice(0, 5));

      // Load FDRs to get count, total funds, and total interest
      const fdrs = await fdrAPI.getMyFDRs();
      const activeCount = fdrs.filter((fdr: any) => fdr.status === 'active').length;
      const fdrFundsTotal = fdrs.filter((fdr: any) => fdr.status === 'active').reduce((sum: number, fdr: any) => sum + parseFloat(fdr.amount), 0);
      const interestTotal = fdrs.reduce((sum: number, fdr: any) => sum + parseFloat(fdr.accrued_interest), 0);
      
      const pnl = await fdrAPI.getPnL();

      setActiveFDRCount(activeCount);
      setTotalFDRFunds(fdrFundsTotal);
      setTotalInterestEarned(interestTotal);
      setUpcomingProfit7(pnl.upcoming_profit_7d);
      setUpcomingProfit30(pnl.upcoming_profit_30d);
    } catch (err) {
      console.error('Failed to load dashboard statistics', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const balanceNum = typeof user?.balance === 'string' ? parseFloat(user.balance) : (user?.balance || 0);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Premium Portfolio Hero */}
      <PortfolioHero 
        user={user} 
        totalFDRFunds={totalFDRFunds} 
        totalInterestEarned={totalInterestEarned} 
      />

      {/* Quick Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button 
          className="btn btn-primary" 
          style={{ flex: '1 1 auto', minWidth: '140px' }}
          onClick={() => onNavigate('deposit')}
        >
          <ArrowDownLeft size={18} />
          Deposit
        </button>
        <button 
          className="btn" 
          style={{ 
            flex: '1 1 auto', 
            minWidth: '140px', 
            background: 'var(--accent-primary)', 
            color: '#fff' 
          }}
          onClick={() => onNavigate('withdraw')}
        >
          <ArrowUpRight size={18} />
          Withdraw
        </button>
        <button 
          className="btn btn-secondary" 
          style={{ flex: '1 1 auto', minWidth: '140px' }}
          onClick={() => onNavigate('create-fdr')}
        >
          <PlusCircle size={18} />
          Create FDR
        </button>
      </div>

      {/* Metrics Row */}
      <div className="dashboard-grid">
        <MetricCard 
          icon={<Wallet size={20} />} 
          label={`Main Wallet (Locked: ${formatCurrency(parseFloat(user?.locked_balance?.toString() || '0'))})`} 
          value={formatCurrency(balanceNum)} 
          variant="secondary" 
        />
        <MetricCard 
          icon={<Gift size={20} />} 
          label={`Bonus Wallet (Locked: ${formatCurrency(parseFloat(user?.locked_bonus_balance?.toString() || '0'))})`} 
          value={formatCurrency(parseFloat(user?.bonus_balance?.toString() || '0'))} 
          variant="primary" 
        />
        <MetricCard 
          icon={<Users size={20} />} 
          label={`Referral Wallet`} 
          value={formatCurrency(parseFloat(user?.referral_balance?.toString() || '0'))} 
          variant="info" 
        />
        <MetricCard 
          icon={<PlusCircle size={20} />} 
          label={`Running FDRs`} 
          value={activeFDRCount.toString()} 
          variant="primary" 
        />
        <MetricCard 
          icon={<ArrowUpRight size={20} />} 
          label="Total Withdrawals" 
          value={formatCurrency(totalWithdrawn)} 
          variant="warning" 
        />
        <MetricCard 
          icon={<PiggyBank size={20} />} 
          label="Total Funds in FDR" 
          value={formatCurrency(totalFDRFunds)} 
          variant="primary" 
        />
        <MetricCard 
          icon={<History size={20} />} 
          label="Total Withdrawals" 
          value={formatCurrency(totalWithdrawn)} 
          variant="secondary" 
        />
        <MetricCard 
          icon={<Award size={20} />} 
          label="Total Interest Earned" 
          value={formatCurrency(totalInterestEarned)} 
          variant="info" 
        />
        <MetricCard 
          icon={<TrendingUp size={20} />} 
          label="Upcoming Profit (7 Days)" 
          value={formatCurrency(upcomingProfit7)} 
          variant="warning" 
        />
        <MetricCard 
          icon={<CalendarDays size={20} />} 
          label="Upcoming Profit (30 Days)" 
          value={formatCurrency(upcomingProfit30)} 
          variant="primary" 
        />
      </div>

      {/* Two Column Section */}
      <div className="responsive-two-col">
        
        {/* QUICK ACTIONS PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Create New Investment</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.4' }}>
              Lock in your funds into dynamic Fixed Deposit Receipt plans and earn high-yield payouts on customized installment durations.
            </p>
            <button 
              className="btn btn-primary" 
              style={{ alignSelf: 'flex-start', marginTop: 'auto' }}
              onClick={() => onNavigate('create-fdr')}
            >
              <span>FDR Builder</span>
              <ArrowRight size={16} />
            </button>
          </div>

        </div>

        {/* RECENT ACTIVITY WIDGET */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="var(--accent-secondary)" />
              Recent Activity
            </h3>
            <button 
              onClick={() => onNavigate('transactions')}
              style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
            >
              View All
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            {recentTransactions.length > 0 ? (
              recentTransactions.map((tx: any) => (
                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border-card)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: tx.type.includes('deposit') ? 'var(--accent-secondary-light)' : (tx.type.includes('withdraw') ? 'var(--accent-danger-glow)' : 'var(--accent-info-glow)'),
                      color: tx.type.includes('deposit') ? 'var(--accent-secondary)' : (tx.type.includes('withdraw') ? 'var(--accent-danger)' : 'var(--accent-info)')
                    }}>
                      {tx.type.includes('deposit') ? <ArrowDownLeft size={16} /> : (tx.type.includes('withdraw') ? <ArrowUpRight size={16} /> : <History size={16} />)}
                    </div>
                    <div>
                      <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{tx.description}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(tx.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: tx.type.includes('deposit') ? 'var(--accent-secondary)' : 'var(--text-primary)' }}>
                    {tx.type.includes('deposit') ? '+' : ''}{formatCurrency(parseFloat(tx.amount))}
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>No recent activity found.</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
