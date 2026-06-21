import React, { useState, useEffect } from 'react';
import { TrendingUp, ArrowUpRight } from 'lucide-react';

interface PortfolioHeroProps {
  user: any;
  totalFDRFunds: number;
  totalInterestEarned: number;
}

export const PortfolioHero: React.FC<PortfolioHeroProps> = ({ user, totalFDRFunds, totalInterestEarned }) => {
  const [greeting, setGreeting] = useState('Welcome');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  const [liveYieldIncrement, setLiveYieldIncrement] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchFDRsAndSimulate = async () => {
      try {
        const { fdrAPI } = await import('../api');
        const fdrs = await fdrAPI.getMyFDRs();
        
        let totalYieldPerMs = 0;
        let initialUnaccrued = 0;
        const nowMs = Date.now();

        fdrs.forEach((fdr: any) => {
          if (fdr.status === 'active') {
            const principal = parseFloat(fdr.amount);
            const interestPercent = parseFloat(fdr.interest_percent);
            const periodDays = parseInt(fdr.period_days, 10);
            const yieldPerPeriod = principal * (interestPercent / 100);
            const yieldPerMs = yieldPerPeriod / (periodDays * 24 * 60 * 60 * 1000);
            
            totalYieldPerMs += yieldPerMs;

            const lastInstDate = fdr.last_installment_date ? fdr.last_installment_date.split('T')[0] : fdr.start_date.split('T')[0];
            const lastInstMs = new Date(lastInstDate + 'T00:00:00').getTime();
            if (nowMs > lastInstMs) {
              initialUnaccrued += (nowMs - lastInstMs) * yieldPerMs;
            }
          }
        });

        if (isMounted) {
          setLiveYieldIncrement(initialUnaccrued);
          
          if (totalYieldPerMs > 0) {
            const interval = setInterval(() => {
              setLiveYieldIncrement(prev => prev + (totalYieldPerMs * 100));
            }, 100);
            return () => clearInterval(interval);
          }
        }
      } catch (e) {
        console.error("Failed to load live FDR yield for hero");
      }
    };
    
    fetchFDRsAndSimulate();
    return () => { isMounted = false; };
  }, []);

  const balanceNum = typeof user?.balance === 'string' ? parseFloat(user.balance) : (user?.balance || 0);
  const gamingBonusNum = typeof user?.gaming_bonus_balance === 'string' ? parseFloat(user.gaming_bonus_balance) : (user?.gaming_bonus_balance || 0);
  const referralNum = typeof user?.referral_balance === 'string' ? parseFloat(user.referral_balance) : (user?.referral_balance || 0);
  const lockedReferralNum = typeof user?.locked_referral_balance === 'string' ? parseFloat(user.locked_referral_balance) : (user?.locked_referral_balance || 0);
  const unlockedReferral = Math.max(0, referralNum - lockedReferralNum);
  const totalPortfolioValue = balanceNum + gamingBonusNum + unlockedReferral + totalFDRFunds + totalInterestEarned;
  const liveTotalInterest = totalInterestEarned + liveYieldIncrement;

  const formatCurrency = (val: number, isLive = false) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: isLive ? 4 : 0,
      maximumFractionDigits: isLive ? 4 : 0
    }).format(val || 0);
  };

  return (
    <div 
      className="glass-card animate-fade-in" 
      style={{ 
        background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--accent-secondary-light) 100%)',
        border: '1px solid var(--accent-secondary-glow)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Decorative background element */}
      <div 
        style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '300px',
          height: '300px',
          background: 'var(--accent-secondary)',
          opacity: 0.05,
          borderRadius: '50%',
          filter: 'blur(40px)',
          pointerEvents: 'none'
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500, marginBottom: '4px' }}>
          {greeting}, <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{user?.name || 'User'}</span>
        </p>
        
        <div style={{ marginTop: '16px', marginBottom: '24px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '8px' }}>
            Total Portfolio Value
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(totalPortfolioValue, false)}
            </h1>
            <div 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px', 
                background: 'var(--accent-secondary-light)', 
                color: 'var(--accent-secondary)', 
                padding: '4px 10px', 
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              <TrendingUp size={14} />
              <span>+{formatCurrency(liveTotalInterest, true)} Profit</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Wallet Balance</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(balanceNum)}</p>
          </div>
          <div style={{ width: '1px', background: 'var(--border-card)', height: 'auto' }} />
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Gaming Bonus</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-secondary)' }}>{formatCurrency(gamingBonusNum)}</p>
          </div>
          <div style={{ width: '1px', background: 'var(--border-card)', height: 'auto' }} />
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Referral Wallet</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-info)' }}>{formatCurrency(unlockedReferral)}</p>
          </div>
          <div style={{ width: '1px', background: 'var(--border-card)', height: 'auto' }} />
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Active FDRs</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(totalFDRFunds)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
