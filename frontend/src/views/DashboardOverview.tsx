import React, { useState, useEffect } from 'react';
import { MetricCard } from '../components/MetricCard';
import { walletAPI, fdrAPI, gamesAPI } from '../api';
import { Wallet, Award, History, ArrowRight, ArrowUpRight, ArrowDownLeft, PiggyBank, TrendingUp, CalendarDays, Gift, Users, PlusCircle, Activity, Gamepad2 } from 'lucide-react';
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
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [activeFDRCount, setActiveFDRCount] = useState(0);
  const [totalFDRFunds, setTotalFDRFunds] = useState(0);
  const [totalInterestEarned, setTotalInterestEarned] = useState(0);
  const [upcomingProfit7, setUpcomingProfit7] = useState(0);
  const [upcomingProfit30, setUpcomingProfit30] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);

  const loadData = async () => {
    try {
      // Load transactions to calculate total deposits and withdrawals
      const txs = await walletAPI.getTransactions();
      const withdrawalsTotal = txs
        .filter((tx: any) => tx.type === 'withdrawal' || tx.type === 'withdrawal_approved')
        .reduce((sum: number, tx: any) => sum + parseFloat(tx.amount), 0);
      setTotalWithdrawn(withdrawalsTotal);
      
      const depositsTotal = txs
        .filter((tx: any) => tx.type === 'deposit' || tx.type === 'deposit_approved')
        .reduce((sum: number, tx: any) => sum + parseFloat(tx.amount), 0);
      setTotalDeposited(depositsTotal);
      
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

      // Load games
      try {
        const gamesData = await gamesAPI.getGames();
        setGames(gamesData.filter((g: any) => g.is_active));
      } catch (e) {
        console.error('Failed to load games', e);
      }
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

      {/* Gaming Zone Section */}
      <div style={{ marginTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gamepad2 size={20} color="var(--accent-primary)" />
            Gaming Zone
          </h3>
          <button 
            className="btn btn-text" 
            style={{ padding: '4px 8px', fontSize: '0.85rem' }}
            onClick={() => onNavigate('games')}
          >
            View All <ArrowRight size={14} />
          </button>
        </div>
        
        <div 
          className="hide-scrollbar" 
          style={{ 
            display: 'flex', 
            gap: '16px', 
            overflowX: 'auto', 
            paddingBottom: '10px',
            scrollSnapType: 'x mandatory'
          }}
        >
          {games.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Loading games...</div>
          ) : (
            games.map((g: any) => (
              <div 
                key={g.id} 
                className="glass-card" 
                style={{ 
                  flex: '0 0 auto', 
                  width: '240px', 
                  padding: '0', 
                  overflow: 'hidden', 
                  cursor: 'pointer', 
                  scrollSnapAlign: 'start',
                  border: '1px solid var(--border-glass)',
                  transition: 'transform 0.2s ease'
                }}
                onClick={() => onNavigate(`game-${g.slug}`)}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ height: '100px', background: 'var(--accent-secondary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {g.image_url ? (
                    <img src={g.image_url} alt={g.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Gamepad2 size={36} color="var(--accent-secondary)" opacity={0.5} />
                  )}
                  <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>Play</span>
                  </div>
                </div>
                <div style={{ padding: '12px' }}>
                  <h4 style={{ fontSize: '1rem', marginBottom: '4px', color: 'var(--text-primary)' }}>{g.name}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
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
