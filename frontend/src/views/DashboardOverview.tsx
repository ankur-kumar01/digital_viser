import React, { useState, useEffect } from 'react';
import { MetricCard } from '../components/MetricCard';
import { walletAPI, fdrAPI } from '../api';
import { Wallet, Award, History, ArrowRight, ArrowUpRight, PiggyBank, TrendingUp, CalendarDays, Gift, Users, PlusCircle } from 'lucide-react';

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

  const loadData = async () => {
    try {
      // Load transactions to calculate total deposits and withdrawals
      const txs = await walletAPI.getTransactions();
      const withdrawalsTotal = txs
        .filter((tx: any) => tx.type === 'withdrawal' || tx.type === 'withdrawal_approved')
        .reduce((sum: number, tx: any) => sum + parseFloat(tx.amount), 0);
      setTotalWithdrawn(withdrawalsTotal);

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
      
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Dashboard Overview</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Real-time summary of your locked wealth, transactions, and accrued yields.
        </p>
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

      </div>

    </div>
  );
};
