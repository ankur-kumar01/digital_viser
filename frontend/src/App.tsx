import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { LayoutDashboard, Wallet, ArrowUpRight, BarChart3, User, Gamepad2 } from 'lucide-react';
import { Auth } from './views/Auth';
import { DashboardOverview } from './views/DashboardOverview';
import { Deposit } from './views/Deposit';
import { Withdraw } from './views/Withdraw';
import { CreateFDR } from './views/CreateFDR';
import { MyFDRs } from './views/MyFDRs';
import { Transactions } from './views/Transactions';
import { Profile } from './views/Profile';
import { Referrals } from './views/Referrals';
import { GamesCenter } from './views/GamesCenter';
import { AviatorGame } from './views/games/aviator';
import { ColourTradingGame } from './views/games/colourtrading';
import { FruitSlasherGame } from './views/games/fruitslasher';
import { authAPI, clearToken, getToken, adminAPI, getAdminToken, clearAdminToken, globalConfigAPI } from './api';
import { setGlobalTimeZone } from './utils/dateFormatter';
import { LoadingSpinner } from './components/LoadingSpinner';

// Admin Views
import { AdminAuth } from './views/admin/AdminAuth';
import { AdminDashboard } from './views/admin/AdminDashboard';
import { AdminUsers } from './views/admin/AdminUsers';
import { AdminDepositRequests } from './views/admin/AdminDepositRequests';
import { AdminWithdrawalRequests } from './views/admin/AdminWithdrawalRequests';
import { AdminPaymentMethods } from './views/admin/AdminPaymentMethods';
import { AdminFdrPlans } from './views/admin/AdminFdrPlans';
import { AdminSchemes } from './views/admin/AdminSchemes';
import { AdminUserProfileDetails } from './views/admin/AdminUserProfileDetails';
import { AdminSettings } from './views/admin/AdminSettings';
import { AdminProfile } from './views/admin/AdminProfile';
import { AdminGames } from './views/admin/AdminGames';
import { AdminPlayerAnalytics } from './views/admin/AdminPlayerAnalytics';
import { AdminFdrs } from './views/admin/AdminFdrs';
import { AdminBigWins } from './views/admin/AdminBigWins';
import { AdminGameSimulations } from './views/admin/AdminGameSimulations';
import { AdminSpinWheel } from './views/admin/AdminSpinWheel';
import { AdminReferrals } from './views/admin/AdminReferrals';
import { AdminTransactions } from './views/admin/AdminTransactions';
import { AdminBets } from './views/admin/AdminBets';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isGameView = !isAdmin && currentView.startsWith('game-');

  const handleInitialize = async () => {
    try {
      const config = await globalConfigAPI.getConfig();
      if (config && config.global_timezone) {
        setGlobalTimeZone(config.global_timezone);
      }
    } catch (err) {
      console.error('Failed to fetch global config', err);
    }

    const isAdminRoute = window.location.pathname === '/admin';
    const hashView = window.location.hash ? window.location.hash.substring(1) : null;
    
    if (isAdminRoute) {
      setShowAdminAuth(true);
      const adminToken = getAdminToken();
      if (adminToken) {
        try {
          // Validate admin token by fetching stats
          await adminAPI.getStats();
          setIsAdmin(true);
          setIsAuthenticated(true);
          setUser({ name: 'Super Admin', email: 'admin@digitalviser.com' });
          setCurrentView(hashView || 'admin-dashboard');
        } catch (adminErr) {
          clearAdminToken();
        }
      }
    } else {
      setShowAdminAuth(false);
      const token = getToken();
      if (token) {
        try {
          const profile = await authAPI.getProfile();
          setUser(profile);
          setIsAuthenticated(true);
          setIsAdmin(false);
          setCurrentView(hashView || 'dashboard');
        } catch (err) {
          clearToken();
        }
      }
    }

    setIsInitializing(false);
  };

  useEffect(() => {
    handleInitialize();
  }, []);

  // Sync currentView with hash
  useEffect(() => {
    if (isAuthenticated && currentView) {
      window.location.hash = currentView;
    }
  }, [currentView, isAuthenticated]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      if (!isAuthenticated) return;
      const hashView = window.location.hash.substring(1);
      if (hashView && hashView !== currentView) {
        setCurrentView(hashView);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentView, isAuthenticated]);

  const handleLoginSuccess = async (_token: string, userData: any, isRegistration: boolean = false) => {
    setUser(userData);
    setIsAuthenticated(true);
    setIsAdmin(false);
    setCurrentView(isRegistration ? 'profile' : 'dashboard');
  };

  const handleAdminLoginSuccess = async (_token: string, adminData: any) => {
    setUser(adminData);
    setIsAuthenticated(true);
    setIsAdmin(true);
    setCurrentView('admin-dashboard');
  };

  const handleLogout = () => {
    if (isAdmin) {
      clearAdminToken();
      setCurrentView('admin-dashboard');
    } else {
      clearToken();
      setCurrentView('dashboard');
    }
    setUser(null);
    setIsAuthenticated(false);
  };

  const refreshUser = async () => {
    if (!isAdmin && isAuthenticated) {
      try {
        const profile = await authAPI.getProfile();
        setUser(profile);
      } catch (err) {
        console.error('Failed to refresh user profile');
      }
    }
  };

  if (isInitializing) {
    return (
      <LoadingSpinner message="Checking secure gateway credentials..." fullPage />
    );
  }

  if (!isAuthenticated) {
    if (showAdminAuth) {
      return <AdminAuth onLogin={handleAdminLoginSuccess} />;
    }
    return <Auth onLogin={handleLoginSuccess} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar - fixed left */}
      {!isGameView && (
        <Sidebar 
          currentView={currentView} 
          onNavigate={(view) => {
            setCurrentView(view);
            setSidebarOpen(false);
          }} 
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isAdmin={isAdmin}
          user={user}
        />
      )}

      {/* Header Navbar - fixed top */}
      {!isGameView && (
        <Navbar 
          user={user} 
          onLogout={handleLogout} 
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          isAdmin={isAdmin}
        />
      )}

      {/* Backdrop overlay for mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Viewport Container */}
      <main className={`main-content-layout ${isGameView ? 'fullscreen-game' : ''}`}>
        {!isAdmin ? (
          <>
            {currentView === 'dashboard' && (
              <DashboardOverview 
                user={user} 
                onNavigate={setCurrentView} 
                refreshUser={refreshUser}
              />
            )}
            {currentView === 'deposit' && (
              <Deposit user={user} refreshUser={refreshUser} />
            )}
            {currentView === 'withdraw' && (
              <Withdraw user={user} refreshUser={refreshUser} />
            )}
            {currentView === 'profile' && (
              <Profile user={user} refreshUser={refreshUser} onNavigate={setCurrentView} />
            )}
            {currentView === 'referrals' && (
              <Referrals user={user} />
            )}
            {currentView === 'create-fdr' && (
              <CreateFDR user={user} refreshUser={refreshUser} />
            )}
            {currentView === 'my-fdrs' && (
              <MyFDRs onNavigate={setCurrentView} />
            )}
            {currentView === 'transactions' && (
              <Transactions />
            )}
            {currentView === 'games' && (
              <GamesCenter onNavigate={setCurrentView} />
            )}
            {currentView === 'game-aviator' && (
              <AviatorGame user={user} refreshUser={refreshUser} onNavigate={setCurrentView} />
            )}
            {currentView === 'game-colour-trading' && (
              <ColourTradingGame user={user} refreshUser={refreshUser} onNavigate={setCurrentView} />
            )}
            {currentView === 'game-fruit-slasher' && (
              <FruitSlasherGame user={user} refreshUser={refreshUser} onNavigate={setCurrentView} />
            )}
          </>
        ) : (
          <>
            {currentView === 'admin-dashboard' && <AdminDashboard />}
            {currentView === 'admin-users' && (
              <AdminUsers 
                onNavigate={setCurrentView} 
                onSelectUser={setSelectedUserId} 
              />
            )}
            {currentView === 'admin-deposit-requests' && <AdminDepositRequests />}
            {currentView === 'admin-withdrawal-requests' && <AdminWithdrawalRequests />}
            {currentView === 'admin-methods' && <AdminPaymentMethods />}
            {currentView === 'admin-fdr-plans' && <AdminFdrPlans />}
            {currentView === 'admin-fdrs' && <AdminFdrs />}
            {currentView === 'admin-schemes' && <AdminSchemes />}
            {currentView === 'admin-settings' && <AdminSettings />}
            {currentView === 'admin-profile' && <AdminProfile />}
            {currentView === 'admin-user-details' && selectedUserId && (
              <AdminUserProfileDetails 
                userId={selectedUserId} 
                onBack={() => {
                  setCurrentView('admin-users');
                  setSelectedUserId(null);
                }} 
              />
            )}
            {currentView === 'admin-games' && <AdminGames />}
            {currentView === 'admin-player-analytics' && <AdminPlayerAnalytics />}
            {currentView === 'admin-big-wins' && <AdminBigWins />}
            {currentView === 'admin-game-simulations' && <AdminGameSimulations />}
            {currentView === 'admin-spin-wheel' && <AdminSpinWheel />}
            {currentView === 'admin-transactions' && <AdminTransactions />}
            {currentView === 'admin-bets' && <AdminBets />}
            {currentView === 'admin-referrals' && <AdminReferrals />}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      {!isAdmin && !isGameView && (
        <nav className="mobile-bottom-nav">
          {[
            { id: 'dashboard', label: 'Home', icon: <LayoutDashboard size={20} /> },
            { id: 'deposit', label: 'Deposit', icon: <Wallet size={20} /> },
            { id: 'withdraw', label: 'Withdraw', icon: <ArrowUpRight size={20} /> },
            { id: 'my-fdrs', label: 'FDRs', icon: <BarChart3 size={20} /> },
            { id: 'games', label: 'Gaming Zone', icon: <Gamepad2 size={20} /> },
          ].map((item) => (
            <button
              key={item.id}
              className={currentView === item.id ? 'active' : ''}
              onClick={() => {
                setCurrentView(item.id);
                setSidebarOpen(false);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
};

export default App;
