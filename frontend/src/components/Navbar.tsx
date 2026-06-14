import React, { useState, useEffect } from 'react';
import { Wallet, LogOut, Menu } from 'lucide-react';
import { fdrAPI } from '../api';

interface NavbarProps {
  user: any;
  onLogout: () => void;
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout, onToggleSidebar }) => {
  const formatBalance = (bal: number | string) => {
    const numeric = typeof bal === 'string' ? parseFloat(bal) : bal;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(numeric || 0);
  };

  const [totalPortfolioValue, setTotalPortfolioValue] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setTotalPortfolioValue(null);
      return;
    }
    
    const loadPortfolio = async () => {
      try {
        const fdrs = await fdrAPI.getMyFDRs();
        const fdrFundsTotal = fdrs.filter((fdr: any) => fdr.status === 'active').reduce((sum: number, fdr: any) => sum + parseFloat(fdr.amount), 0);
        const interestTotal = fdrs.reduce((sum: number, fdr: any) => sum + parseFloat(fdr.accrued_interest), 0);
        
        const balanceNum = typeof user.balance === 'string' ? parseFloat(user.balance) : (user.balance || 0);
        setTotalPortfolioValue(balanceNum + fdrFundsTotal + interestTotal);
      } catch (err) {
        const balanceNum = typeof user.balance === 'string' ? parseFloat(user.balance) : (user.balance || 0);
        setTotalPortfolioValue(balanceNum);
      }
    };
    
    loadPortfolio();
  }, [user]);

  return (
    <div className="navbar-container">
      {/* Left: Hamburger + Greeting */}
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
        <button
          className="mobile-hamburger"
          onClick={onToggleSidebar}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '12px',
            outline: 'none',
            flexShrink: 0,
          }}
          title="Toggle Navigation"
        >
          <Menu size={22} />
        </button>
        <h4 style={{ 
          color: 'var(--text-primary)', 
          fontSize: '0.95rem', 
          fontWeight: 500, 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis' 
        }}>
          Welcome, <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{user?.name || 'User'}</span>
        </h4>
      </div>

      {/* Right: Balance + Logout — always in one row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* Balance Chip */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            background: 'var(--accent-secondary-light)', 
            border: '1px solid var(--accent-secondary-glow)',
            borderRadius: '8px',
            padding: '6px 12px',
          }}
        >
          <Wallet size={14} color="var(--accent-secondary)" style={{ flexShrink: 0 }} />
          <span style={{ 
            fontSize: '0.85rem', 
            fontWeight: 700, 
            fontFamily: 'var(--font-headings)', 
            color: 'var(--accent-secondary)',
            whiteSpace: 'nowrap',
          }}>
            {user ? (totalPortfolioValue !== null ? formatBalance(totalPortfolioValue) : formatBalance(user.balance)) : '₹0'}
          </span>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'transparent',
            border: '1px solid var(--border-card)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'var(--transition)',
            flexShrink: 0,
          }}
          title="Sign Out"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-danger)';
            e.currentTarget.style.color = 'var(--accent-danger)';
            e.currentTarget.style.background = 'var(--accent-danger-glow)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-card)';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
};
