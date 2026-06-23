import React, { useState, useEffect } from 'react';
import { walletAPI, fdrAPI, gamesAPI, globalConfigAPI, yieldBoosterAPI, dailyTasksAPI } from '../api';
import { Award, ArrowRight, ArrowUpRight, ArrowDownLeft, Gift, Users, PlusCircle, Gamepad2, Copy, MessageCircle } from 'lucide-react';
import { PortfolioHero } from '../components/PortfolioHero';
import { AviatorChatWidget } from '../components/AviatorChatWidget';
import { LoadingSpinner } from '../components/LoadingSpinner';

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
    gaming_bonus_balance?: number | string;
  } | null;
  onNavigate: (view: string) => void;
  refreshUser: () => Promise<void>;
}

const OfferTimer: React.FC<{ endTime: string; onExpire?: () => void }> = ({ endTime, onExpire }) => {
  const calculateTimeLeft = () => {
    const endStr = endTime.includes('Z') ? endTime : endTime.replace(' ', 'T') + 'Z';
    const difference = +new Date(endStr) - +new Date();
    let timeLeft = {
      days: '00',
      hours: '00',
      minutes: '00',
      seconds: '00',
      expired: true
    };

    if (difference > 0) {
      const d = Math.floor(difference / (1000 * 60 * 60 * 24));
      const h = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const m = Math.floor((difference / 1000 / 60) % 60);
      const s = Math.floor((difference / 1000) % 60);

      timeLeft = {
        days: d.toString().padStart(2, '0'),
        hours: h.toString().padStart(2, '0'),
        minutes: m.toString().padStart(2, '0'),
        seconds: s.toString().padStart(2, '0'),
        expired: false
      };
    }

    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      const updated = calculateTimeLeft();
      setTimeLeft(updated);
      if (updated.expired) {
        clearInterval(timer);
        if (onExpire) onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  if (timeLeft.expired) {
    return <span style={{ color: 'var(--accent-danger)', fontWeight: 700, fontSize: '0.85rem' }}>Offer Expired!</span>;
  }

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
      <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'rgba(251, 191, 36, 0.9)', fontWeight: 700, letterSpacing: '0.05em' }}>Ends In:</span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {parseInt(timeLeft.days) > 0 && (
          <span style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.35)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-secondary)', fontFamily: 'monospace' }}>
            {timeLeft.days}d
          </span>
        )}
        <span style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.35)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-secondary)', fontFamily: 'monospace' }}>
          {timeLeft.hours}h
        </span>
        <span style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.35)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-secondary)', fontFamily: 'monospace' }}>
          {timeLeft.minutes}m
        </span>
        <span style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.8rem', fontWeight: 800, color: '#f87171', fontFamily: 'monospace' }}>
          {timeLeft.seconds}s
        </span>
      </div>
    </div>
  );
};

const BigWinsTicker: React.FC<{ wins: any[] }> = ({ wins }) => {
  const [currentWin, setCurrentWin] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!wins || wins.length === 0) return;
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentWin((prev) => Math.floor(Math.random() * wins.length));
        setIsVisible(true);
      }, 500); // 500ms fade out
    }, 4500); // Change every 4.5 seconds

    return () => clearInterval(interval);
  }, [wins]);

  if (!wins || wins.length === 0) return null;

  const win = wins[currentWin];

  return (
    <div style={{ 
      background: 'rgba(16, 185, 129, 0.05)', 
      border: '1px solid rgba(16, 185, 129, 0.2)', 
      borderRadius: '8px', 
      padding: '12px 16px', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '12px',
      overflow: 'hidden',
      marginTop: '10px'
    }}>
      <div style={{ 
        background: 'rgba(16, 185, 129, 0.2)', 
        borderRadius: '50%', 
        padding: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Award size={18} color="var(--accent-secondary)" />
      </div>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px', 
        fontSize: '0.9rem',
        transition: 'opacity 0.5s ease',
        opacity: isVisible ? 1 : 0,
        flexWrap: 'wrap'
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>🎉 Live Win:</span>
        <span style={{ color: 'var(--text-secondary)' }}>User</span>
        <strong style={{ color: 'var(--text-primary)' }}>{win.user_name}</strong>
        <span style={{ color: 'var(--text-secondary)' }}>just won</span>
        <strong style={{ color: 'var(--accent-secondary)', fontSize: '1rem' }}>{win.amount}</strong>
        <span style={{ color: 'var(--text-secondary)' }}>on</span>
        <strong style={{ color: win.game_color }}>{win.game_name}</strong>!
      </div>
    </div>
  );
};

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
  const [games, setGames] = useState<any[]>([]);
  const [activeOffers, setActiveOffers] = useState<any[]>([]);
  const [bigWins, setBigWins] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [referralPercent, setReferralPercent] = useState(10);
  const [fdrReferralPercent, setFdrReferralPercent] = useState(5);
  const [claimableOffers, setClaimableOffers] = useState<any[]>([]);
  const [dailyTasks, setDailyTasks] = useState<any[]>([]);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [isClaimingTask, setIsClaimingTask] = useState<number | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const loadData = async () => {
    try {
      // Load transactions to calculate total deposits and withdrawals
      const txsRes = await walletAPI.getTransactions();
      const txs = txsRes.data || txsRes;
      const withdrawalsTotal = txs
        .filter((tx: any) => tx.type === 'withdrawal' || tx.type === 'withdrawal_approved')
        .reduce((sum: number, tx: any) => sum + parseFloat(tx.amount), 0);
      setTotalWithdrawn(withdrawalsTotal);
      
      const depositsTotal = txs
        .filter((tx: any) => tx.type === 'deposit' || tx.type === 'deposit_approved')
        .reduce((sum: number, tx: any) => sum + parseFloat(tx.amount), 0);
      setTotalDeposited(depositsTotal);
      
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
      // Load active offers
      try {
        const offers = await fdrAPI.getActiveOffers();
        setActiveOffers(offers);
      } catch (e) {
        console.error('Failed to load active offers', e);
      }
      
      // Load claimable yield boosters
      try {
        const boosterRes = await yieldBoosterAPI.getUserBoosters();
        setClaimableOffers(boosterRes.claimable || []);
      } catch (e) {
        console.error('Failed to load yield boosters', e);
      }
      
      // Load daily tasks
      try {
        const taskRes = await dailyTasksAPI.getTasks();
        setDailyTasks(taskRes.tasks || []);
      } catch (e) {
        console.error('Failed to load daily tasks', e);
      }

      // Load big wins
      try {
        const bw = await gamesAPI.getBigWins();
        setBigWins(bw);
      } catch (e) {
        console.error('Failed to load big wins', e);
      }
      // Load referral config
      try {
        const cfg = await globalConfigAPI.getConfig();
        if (cfg.referral_percent) setReferralPercent(cfg.referral_percent);
        if (cfg.fdr_referral_percent) setFdrReferralPercent(cfg.fdr_referral_percent);
      } catch (e) {
        console.error('Failed to load referral config', e);
      }
    } catch (err) {
      console.error('Failed to load dashboard statistics', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleClaimBooster = async (id: number) => {
    setClaimingId(id);
    try {
      await yieldBoosterAPI.claimBooster(id);
      loadData();
      refreshUser();
    } catch (err: any) {
      alert(err.message || 'Failed to claim yield booster.');
    } finally {
      setClaimingId(null);
    }
  };

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      await dailyTasksAPI.checkIn();
      loadData();
      refreshUser();
    } catch (err: any) {
      alert(err.message || 'Check-in failed.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleClaimTask = async (id: number) => {
    setIsClaimingTask(id);
    try {
      await dailyTasksAPI.claimTask(id);
      loadData();
      refreshUser();
    } catch (err: any) {
      alert(err.message || 'Failed to claim task reward.');
    } finally {
      setIsClaimingTask(null);
    }
  };

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
            color: '#000',
            fontWeight: 700 
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

      {/* Global Big Wins Ticker */}
      <BigWinsTicker wins={bigWins} />

      {/* Gaming Zone Section */}
      <div style={{ marginTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gamepad2 size={20} color="var(--accent-primary)" />
            Gaming Zone
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => onNavigate('games')}>View All</span>
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
            <LoadingSpinner message="Loading interactive games..." />
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

      {/* Aviator Chat Simulation Widget */}
      <AviatorChatWidget />

      {/* Offer Zone Section */}
      <div style={{ marginTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Gift size={20} color="var(--accent-secondary)" />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Offer Zone</h3>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* FDR Promotional Offers */}
          {activeOffers.length > 0 && (
            <div className="glass-card glow-card promo-offer-card">
              <div className="promo-offer-card-left">
                <div className="emoji" style={{ fontSize: '3rem', flexShrink: 0 }}>🎁</div>
                <div>
                  <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                    {activeOffers[0].name}
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5, maxWidth: '600px' }}>
                    Get an instant <strong style={{ color: 'var(--accent-secondary)' }}>{parseFloat(activeOffers[0].bonus_percent)}% bonus</strong> credited to your bonus wallet on creating any Fixed Deposit. Offer ends soon, lock your FDR now!
                  </p>
                  <OfferTimer endTime={activeOffers[0].end_time} onExpire={() => setActiveOffers([])} />
                </div>
              </div>
              <button 
                className="btn promo-offer-card-btn" 
                onClick={() => onNavigate('create-fdr')}
              >
                Grab Offer
              </button>
            </div>
          )}

          {/* Daily Tasks Section */}
          {dailyTasks.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Daily Tasks <span style={{ fontSize: '0.75rem', background: 'var(--accent-primary)', color: '#fff', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>Earn Rewards</span>
                </h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => onNavigate('offers')}>View All</span>
              </div>
              
              <div className="hide-scrollbar" style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', scrollSnapType: 'x mandatory' }}>
                {dailyTasks.map(task => (
                  <div key={task.id} className="glass-card" style={{ flex: '0 0 auto', width: '260px', padding: '14px', scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--border-glass)', borderRadius: '12px', background: task.is_claimed ? 'rgba(255,255,255,0.02)' : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.01) 100%)', borderLeft: '3px solid #10b981', opacity: task.is_claimed ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{task.title}</h5>
                      <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        +₹{parseFloat(task.reward_amount)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.3, height: '34px', overflow: 'hidden' }}>{task.description}</p>
                    
                    {task.task_type !== 'check_in' && (
                      <div style={{ width: '100%', background: 'rgba(16, 185, 129, 0.1)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (task.current_count / task.target_count) * 100)}%`, background: '#10b981' }} />
                      </div>
                    )}
                    
                    <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px dashed rgba(16, 185, 129, 0.2)' }}>
                      {task.is_claimed ? (
                        <button className="btn" style={{ width: '100%', padding: '6px', fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--text-muted)' }} disabled>Claimed</button>
                      ) : task.task_type === 'check_in' ? (
                        <button className="btn" style={{ width: '100%', padding: '6px', fontSize: '0.8rem', background: '#10b981', color: '#fff', fontWeight: 700 }} onClick={handleCheckIn} disabled={isCheckingIn}>{isCheckingIn ? 'Wait...' : 'Check In Now'}</button>
                      ) : task.current_count >= task.target_count ? (
                        <button className="btn" style={{ width: '100%', padding: '6px', fontSize: '0.8rem', background: '#10b981', color: '#fff', fontWeight: 700, animation: 'pulse 2s infinite' }} onClick={() => handleClaimTask(task.id)} disabled={isClaimingTask === task.id}>{isClaimingTask === task.id ? 'Wait...' : 'Claim Reward'}</button>
                      ) : (
                        <button className="btn" style={{ width: '100%', padding: '6px', fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }} onClick={() => onNavigate('games')}>Play to Complete</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Yield Booster Offers Section */}
          {claimableOffers.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Yield Boosters <span style={{ fontSize: '0.75rem', background: 'var(--accent-secondary)', color: '#000', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>Hot</span>
                </h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => onNavigate('offers')}>View All</span>
              </div>
              
              <div className="hide-scrollbar" style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', scrollSnapType: 'x mandatory' }}>
                {claimableOffers.map(offer => (
                  <div key={offer.id} className="glass-card" style={{ flex: '0 0 auto', width: '260px', padding: '14px', scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--border-glass)', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(251, 191, 36, 0.01) 100%)', borderLeft: '3px solid #f59e0b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{offer.name}</h5>
                      <span style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#f59e0b', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        +{parseFloat(offer.yield_boost_percent)}%
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.3, height: '34px', overflow: 'hidden' }}>{offer.description}</p>
                    
                    <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                      <button 
                        className="btn" 
                        style={{ width: '100%', padding: '6px', fontSize: '0.8rem', background: '#f59e0b', color: '#000', fontWeight: 700 }} 
                        onClick={() => handleClaimBooster(offer.id)}
                        disabled={claimingId === offer.id}
                      >
                        {claimingId === offer.id ? 'Activating...' : 'Activate Boost'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Referral Offer Banner */}
          <div className="glass-card glow-card promo-offer-card">
            <div className="promo-offer-card-left">
              <div className="emoji" style={{ fontSize: '3rem', flexShrink: 0 }}>💸</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Earn Up to ₹10,000+ Per Referral
                  </h4>
                  <span style={{
                    background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.1))',
                    border: '1px solid rgba(251,191,36,0.4)',
                    borderRadius: '20px',
                    padding: '3px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#f59e0b',
                    whiteSpace: 'nowrap',
                  }}>
                    {referralPercent}% + {fdrReferralPercent}%
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--accent-secondary)' }}>{referralPercent}%</strong> on their first deposit + <strong style={{ color: 'var(--accent-secondary)' }}>{fdrReferralPercent}%</strong> recurring monthly. Unlimited earning potential!
                </p>
              </div>
            </div>
            <div className="promo-offer-card-buttons">
              <button 
                className="btn promo-offer-card-btn" 
                onClick={() => {
                  const link = `${window.location.origin}/register?ref=${(user as any)?.referral_code || ''}`;
                  navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                style={{ background: '#f59e0b', color: '#000', fontWeight: 700 }}
              >
                <Copy size={16} /> {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button 
                className="btn promo-offer-card-btn" 
                onClick={() => {
                  const link = `${window.location.origin}/register?ref=${(user as any)?.referral_code || ''}`;
                  const text = encodeURIComponent(`Join Digital_Viser and start earning! Use my referral link: ${link}`);
                  window.open(`https://wa.me/?text=${text}`, '_blank');
                }}
                style={{ background: '#25D366', color: '#fff' }}
              >
                <MessageCircle size={16} /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>









    </div>
  );
};
