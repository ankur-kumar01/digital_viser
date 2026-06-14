import React from 'react';
import { Wallet, LogOut, Menu } from 'lucide-react';

interface NavbarProps {
  user: any;
  onLogout: () => void;
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout, onToggleSidebar }) => {
  // Format balance to INR currency format
  const formatBalance = (bal: number | string) => {
    const numeric = typeof bal === 'string' ? parseFloat(bal) : bal;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(numeric || 0);
  };

  return (
    <div className="navbar-container">
      {/* Greetings & Mobile Toggler */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          className="mobile-hamburger"
          onClick={onToggleSidebar}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px',
            outline: 'none'
          }}
          title="Toggle Navigation"
        >
          <Menu size={24} />
        </button>
        <h4 style={{ color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 500 }}>
          Welcome back, <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{user?.name || 'User'}</span>
        </h4>
      </div>

      {/* Right side Info: Balance and Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Balance Wrapper */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'var(--accent-secondary-light)', 
            border: '1px solid var(--accent-secondary-glow)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 14px',
            color: 'var(--accent-secondary)'
          }}
        >
          <Wallet size={16} />
          <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Balance:</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'var(--font-headings)', color: 'var(--accent-secondary)' }}>
            {user ? formatBalance(user.balance) : '₹0.00'}
          </span>
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'var(--transition)'
          }}
          title="Sign Out"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-danger)';
            e.currentTarget.style.color = 'var(--accent-danger)';
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-glass)';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
};
