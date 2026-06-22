import React from 'react';
import { LayoutDashboard, Wallet, PlusCircle, BarChart3, Receipt, X, Users, User, ArrowUpRight, Gift, Gamepad2, Cpu, Disc, FileText, List, History, Activity, Bot, MessageSquare, Percent } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  user?: any;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isOpen, onClose, isAdmin = false, user }) => {
  const userMenuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'wallet', name: 'Wallet', icon: <Wallet size={20} /> },
    { id: 'deposit', name: 'Deposit Funds', icon: <Wallet size={20} /> },
    { id: 'withdraw', name: 'Withdraw Funds', icon: <ArrowUpRight size={20} /> },
    { id: 'referrals', name: 'Referrals', icon: <Users size={20} /> },
    { id: 'profile', name: 'My Profile', icon: <User size={20} /> },
    { id: 'create-fdr', name: 'Create FDR', icon: <PlusCircle size={20} /> },
    { id: 'my-fdrs', name: 'My FDRs', icon: <BarChart3 size={20} /> },
    { id: 'offers', name: 'Offers & Boosts', icon: <Gift size={20} /> },
    { id: 'spin-wheel', name: 'Spin & Win', icon: <Disc size={20} /> },
    { id: 'games', name: 'Gaming Zone', icon: <Gamepad2 size={20} /> },
    { id: 'transactions', name: 'Transactions', icon: <Receipt size={20} /> },
    { id: 'support', name: 'Support', icon: <MessageSquare size={20} /> },
  ];

  const adminMenuItems = [
    { id: 'admin-dashboard', name: 'Platform Stats', icon: <LayoutDashboard size={20} /> },
    { id: 'admin-users', name: 'Manage Users', icon: <Users size={20} /> },
    { id: 'admin-deposit-requests', name: 'Deposit Requests', icon: <Receipt size={20} /> },
    { id: 'admin-withdrawal-requests', name: 'Withdrawal Requests', icon: <Receipt size={20} /> },
    { id: 'admin-methods', name: 'Payment Channels', icon: <Wallet size={20} /> },
    { id: 'admin-transactions', name: 'Transactions', icon: <FileText size={20} /> },
    { id: 'admin-bets', name: 'Bets', icon: <List size={20} /> },
    { id: 'admin-login-history', name: 'Login History', icon: <History size={20} /> },
    { id: 'admin-activity-log', name: 'Activity Log', icon: <Activity size={20} /> },
    { id: 'admin-active-users', name: 'Active Users', icon: <Users size={20} /> },
    { id: 'admin-referrals', name: 'Referral Program', icon: <Users size={20} /> },
    { id: 'admin-fdr-plans', name: 'FDR Plans', icon: <PlusCircle size={20} /> },
    { id: 'admin-fdrs', name: 'Manage FDRs', icon: <BarChart3 size={20} /> },
    { id: 'admin-yield-boosters', name: 'FDR Yield Boosters', icon: <Percent size={20} /> },
    { id: 'admin-schemes', name: 'Reward Schemes', icon: <Gift size={20} /> },
    { id: 'admin-games', name: 'Manage Games', icon: <Gamepad2 size={20} /> },
    { id: 'admin-fantasy-cricket', name: 'Fantasy Cricket', icon: <Gamepad2 size={20} /> },
    { id: 'admin-ludo', name: 'Ludo Management', icon: <Gamepad2 size={20} /> },
    { id: 'admin-bots', name: 'Game Bots', icon: <Bot size={20} /> },
    { id: 'admin-big-wins', name: 'Big Wins Ticker', icon: <Gift size={20} /> },
    { id: 'admin-spin-wheel', name: 'Spin Wheel', icon: <Disc size={20} /> },
    { id: 'admin-game-simulations', name: 'Game Simulations', icon: <Cpu size={20} /> },
    { id: 'admin-player-analytics', name: 'Player Analytics', icon: <BarChart3 size={20} /> },
    { id: 'admin-settings', name: 'System Settings', icon: <Wallet size={20} /> },
    { id: 'admin-support', name: 'Support Tickets', icon: <MessageSquare size={20} /> },
    { id: 'admin-profile', name: 'Admin Profile', icon: <User size={20} /> },
  ];

  const menuItems = isAdmin ? adminMenuItems : userMenuItems;

  return (
    <div className={`sidebar-container ${isOpen ? 'open' : ''}`}>
      {/* Brand Logo & Close button */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '0 8px',
        }}
      >
        <div
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            cursor: 'pointer'
          }}
          onClick={() => onNavigate(isAdmin ? 'admin-dashboard' : 'dashboard')}
        >
          <div 
            style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '10px', 
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <BarChart3 size={18} color="var(--text-primary)" />
          </div>
          <span 
            style={{ 
              fontFamily: 'var(--font-headings)', 
              fontSize: '1.25rem', 
              fontWeight: 700, 
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)'
            }}
          >
            Digital_Viser
          </span>
        </div>

        {/* Close Button on Mobile */}
        <button
          className="sidebar-close-btn"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none'
          }}
          title="Close Navigation"
        >
          <X size={20} />
        </button>
      </div>

      {/* Nav Menu */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                background: isActive ? 'var(--accent-secondary-light)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-headings)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.95rem',
                textAlign: 'left',
                borderLeft: isActive ? '3px solid var(--accent-secondary)' : '3px solid transparent',
                paddingLeft: isActive ? '13px' : '16px',
                transition: 'var(--transition)',
                outline: 'none'
              }}
            >
              <span style={{ color: isActive ? 'var(--accent-secondary)' : 'inherit', display: 'flex', alignItems: 'center' }}>
                {item.icon}
              </span>
              {item.name}
            </button>
          );
        })}
      </nav>

      {/* User Profile Summary */}
      {!isAdmin && user && (
        <div style={{ marginTop: 'auto', padding: '20px 24px', borderTop: '1px solid var(--border-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg-primary)', fontWeight: 'bold', overflow: 'hidden' }}>
              {user.profile_photo ? (
                <img src={`/api${user.profile_photo}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                user.name?.charAt(0).toUpperCase()
              )}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.email}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Muted Platform Info footer */}
      <div style={{ padding: '0 8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Digital_Viser v1.0.0
      </div>
    </div>
  );
};
