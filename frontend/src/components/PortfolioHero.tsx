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

  const balanceNum = typeof user?.balance === 'string' ? parseFloat(user.balance) : (user?.balance || 0);
  const totalPortfolioValue = balanceNum + totalFDRFunds + totalInterestEarned;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
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
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>
              {formatCurrency(totalPortfolioValue)}
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
                fontWeight: 600
              }}
            >
              <TrendingUp size={14} />
              <span>+{formatCurrency(totalInterestEarned)} Profit</span>
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
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Active FDRs</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(totalFDRFunds)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
