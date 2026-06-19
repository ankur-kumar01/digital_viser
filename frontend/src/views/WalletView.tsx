import React, { useState, useEffect } from 'react';
import { MetricCard } from '../components/MetricCard';
import { walletAPI, fdrAPI, globalConfigAPI } from '../api';
import { Wallet, Award, History, ArrowDownLeft, ArrowUpRight, PiggyBank, TrendingUp, CalendarDays, Gift, Users, PlusCircle, Zap } from 'lucide-react';

interface WalletViewProps {
  user: {
    name: string;
    email: string;
    balance: number | string;
    locked_balance: number | string;
    bonus_balance: number | string;
    locked_bonus_balance: number | string;
    referral_balance: number | string;
    locked_referral_balance: number | string;
    gaming_bonus_balance?: number | string;
  } | null;
  onNavigate: (view: string) => void;
}

export const WalletView: React.FC<WalletViewProps> = ({ user, onNavigate }) => {
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [activeFDRCount, setActiveFDRCount] = useState(0);
  const [totalFDRFunds, setTotalFDRFunds] = useState(0);
  const [totalInterestEarned, setTotalInterestEarned] = useState(0);
  const [upcomingProfit7, setUpcomingProfit7] = useState(0);
  const [upcomingProfit30, setUpcomingProfit30] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const txs = await walletAPI.getTransactions();
        const withdrawalsTotal = txs
          .filter((tx: any) => tx.type === 'withdrawal' || tx.type === 'withdrawal_approved')
          .reduce((sum: number, tx: any) => sum + parseFloat(tx.amount), 0);
        setTotalWithdrawn(withdrawalsTotal);

        const depositsTotal = txs
          .filter((tx: any) => tx.type === 'deposit' || tx.type === 'deposit_approved')
          .reduce((sum: number, tx: any) => sum + parseFloat(tx.amount), 0);
        setTotalDeposited(depositsTotal);

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
        console.error('Failed to load wallet data', err);
      }
    };
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
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Wallet</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Overview of all your wallet balances, FDR investments, and earnings.
        </p>
      </div>

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
          style={{ flex: '1 1 auto', minWidth: '140px', background: 'var(--accent-primary)', color: '#fff' }}
          onClick={() => onNavigate('withdraw')}
        >
          <ArrowUpRight size={18} />
          Withdraw
        </button>
      </div>

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
          icon={<Zap size={20} />}
          label="Gaming Bonus Wallet"
          value={formatCurrency(parseFloat(user?.gaming_bonus_balance?.toString() || '0'))}
          variant="warning"
        />
        <MetricCard
          icon={<Users size={20} />}
          label="Referral Wallet"
          value={formatCurrency(parseFloat(user?.referral_balance?.toString() || '0'))}
          variant="info"
        />
        <MetricCard
          icon={<PlusCircle size={20} />}
          label="Running FDRs"
          value={activeFDRCount.toString()}
          variant="primary"
        />
        <MetricCard
          icon={<ArrowDownLeft size={20} />}
          label="Total Deposits"
          value={formatCurrency(totalDeposited)}
          variant="secondary"
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
    </div>
  );
};
