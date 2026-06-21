import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../api';
import { Gamepad2, Play, Pause, Settings, Info, X, TrendingUp, TrendingDown, Activity, Users, DollarSign } from 'lucide-react';

export const AdminGames: React.FC = () => {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsModalOpen, setSettingsModalOpen] = useState<string | null>(null);
  const [limitsModalOpen, setLimitsModalOpen] = useState<any>(null); // holds the game object
  const [editMinBet, setEditMinBet] = useState('');
  const [editMaxBet, setEditMaxBet] = useState('');
  const [aviatorHouseEdge, setAviatorHouseEdge] = useState('3');
  const [ctHouseEdge, setCtHouseEdge] = useState('30');
  const [savingSettings, setSavingSettings] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);

  const fetchGames = async () => {
    try {
      const [gamesRes, settingsRes, analyticsRes] = await Promise.all([
        adminAPI.getGames(),
        adminAPI.getSettings().catch(() => ({})),
        adminAPI.getGameAnalytics().catch(() => null)
      ]);
      setGames(gamesRes);
      if (settingsRes.aviator_house_edge) {
        setAviatorHouseEdge(settingsRes.aviator_house_edge);
      }
      if (settingsRes.colour_trading_house_edge) {
        setCtHouseEdge(settingsRes.colour_trading_house_edge);
      }
      if (analyticsRes) {
        setAnalytics(analyticsRes);
      }
    } catch (err) {
      console.error('Failed to fetch games', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const action = currentStatus ? 'Disable' : 'Enable';
    if (!window.confirm(`Are you sure you want to ${action} this game?`)) return;
    try {
      await adminAPI.updateGameStatus(id, !currentStatus);
      fetchGames();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} game`);
    }
  };

  const handleSaveSettings = async (game: string) => {
    setSavingSettings(true);
    try {
      if (game === 'aviator') {
        await adminAPI.updateSettings({ aviator_house_edge: aviatorHouseEdge });
      } else if (game === 'colourtrading') {
        await adminAPI.updateSettings({ colour_trading_house_edge: ctHouseEdge });
      }
      alert('Settings updated successfully!');
      setSettingsModalOpen(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveLimits = async () => {
    if (!limitsModalOpen) return;
    setSavingSettings(true);
    try {
      await adminAPI.updateGameLimits(limitsModalOpen.id, {
        min_bet: parseFloat(editMinBet),
        max_bet: parseFloat(editMaxBet)
      });
      alert('Game limits updated successfully!');
      setLimitsModalOpen(null);
      fetchGames();
    } catch (err: any) {
      alert(err.message || 'Failed to update limits');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) return <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Loading games...</div>;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ padding: '12px', background: 'var(--accent-primary-glow)', borderRadius: 'var(--radius-md)' }}>
          <Gamepad2 size={24} color="var(--accent-primary)" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Game Management</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Control which games are available to your users</p>
        </div>
      </div>


      {analytics && (
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} color="var(--accent-primary)" />
            System Performance (PnL)
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-primary)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Overall System PnL</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: analytics.overall.total_pnl >= 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)' }}>
                {analytics.overall.total_pnl >= 0 ? '+' : ''}₹{analytics.overall.total_pnl.toFixed(2)}
              </div>
            </div>
            <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Total Wagered Volume</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                ₹{analytics.overall.total_volume.toFixed(2)}
              </div>
            </div>
            <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Total Unique Players</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {analytics.overall.total_players}
              </div>
            </div>
            <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Daily Active Players</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {analytics.overall.total_daily_players}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            {/* Aviator Analytics */}
            <div className="glass-card">
              <h4 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>Aviator Analytics</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Game PnL</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: analytics.aviator.pnl >= 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)' }}>{analytics.aviator.pnl >= 0 ? '+' : ''}₹{analytics.aviator.pnl.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Avg Bet Size</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>₹{analytics.aviator.avg_bet.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Win / Loss Ratio</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--accent-secondary)' }}>{analytics.aviator.wins_count}</span> / <span style={{ color: 'var(--accent-danger)' }}>{analytics.aviator.losses_count}</span>
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Total Volume</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>₹{analytics.aviator.bets_volume.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Colour Trading Analytics */}
            <div className="glass-card">
              <h4 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>Colour Trading Analytics</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Game PnL</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: analytics.colourTrading.pnl >= 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)' }}>{analytics.colourTrading.pnl >= 0 ? '+' : ''}₹{analytics.colourTrading.pnl.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Avg Bet Size</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>₹{analytics.colourTrading.avg_bet.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Win / Loss Ratio</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--accent-secondary)' }}>{analytics.colourTrading.wins_count}</span> / <span style={{ color: 'var(--accent-danger)' }}>{analytics.colourTrading.losses_count}</span>
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Total Volume</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>₹{analytics.colourTrading.bets_volume.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Settings size={20} color="var(--accent-primary)" />
        Game Configurations
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {games.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ color: 'var(--text-muted)' }}>No games found in the system.</p>
          </div>
        ) : (
          games.map((g: any) => (
            <div key={g.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', border: g.is_active ? '1px solid var(--accent-primary-glow)' : '1px solid var(--border-glass)' }}>
              
              {/* Header Image Area */}
              <div style={{ height: '120px', background: g.is_active ? 'var(--accent-secondary-glow)' : 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {g.image_url ? (
                  <img src={g.image_url} alt={g.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Gamepad2 size={40} color={g.is_active ? 'var(--accent-secondary)' : 'var(--text-muted)'} opacity={0.5} />
                )}
                <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                  <span className={`status-badge ${g.is_active ? 'status-completed' : 'status-failed'}`} style={{ backdropFilter: 'blur(4px)', background: g.is_active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}>
                    {g.is_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* Content Area */}
              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{g.name}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>#{g.id}</span>
                </div>
                
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={14} /> Slug: {g.slug}
                </p>
                
                <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', flex: 1 }}>
                  {g.description || 'No description provided for this game.'}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={() => handleToggleStatus(g.id, g.is_active)}
                    className="btn"
                    style={{ 
                      flex: 1,
                      padding: '10px 16px', 
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      background: g.is_active ? 'var(--accent-danger-glow)' : 'var(--accent-primary-glow)',
                      color: g.is_active ? 'var(--accent-danger)' : 'var(--accent-primary)',
                      border: `1px solid ${g.is_active ? 'var(--accent-danger)' : 'var(--accent-primary)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {g.is_active ? <Pause size={18} /> : <Play size={18} />}
                    {g.is_active ? 'Disable Game' : 'Enable Game'}
                  </button>
                  {g.slug !== 'ludo' && (
                    <button 
                      onClick={() => {
                        setLimitsModalOpen(g);
                        setEditMinBet(g.min_bet?.toString() || '10');
                        setEditMaxBet(g.max_bet?.toString() || '100000');
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Edit Bet Limits"
                    >
                      <DollarSign size={18} />
                    </button>
                  )}
                  {g.slug === 'aviator' && (
                    <button 
                      onClick={() => setSettingsModalOpen('aviator')}
                      className="btn btn-secondary"
                      style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Aviator Settings"
                    >
                      <Settings size={18} />
                    </button>
                  )}
                  {g.slug === 'colour-trading' && (
                    <button 
                      onClick={() => setSettingsModalOpen('colour-trading')}
                      className="btn btn-secondary"
                      style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Colour Trading Settings"
                    >
                      <Settings size={18} />
                    </button>
                  )}
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* Premium Aviator Settings Modal */}
      {settingsModalOpen === 'aviator' && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(12px)',
            zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <div 
            style={{ 
              width: '100%', maxWidth: '480px', 
              background: 'linear-gradient(145deg, var(--bg-secondary), var(--bg-primary))',
              border: '1px solid var(--border-glass)',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(139, 92, 246, 0.15)',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {/* Decorative Glow */}
            <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'var(--accent-primary)', filter: 'blur(80px)', opacity: 0.3, borderRadius: '50%' }} />

            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--accent-primary-glow)', padding: '10px', borderRadius: '12px', color: 'var(--accent-primary)' }}>
                  <Settings size={20} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, background: 'linear-gradient(to right, var(--text-primary), var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Aviator Configuration
                </h3>
              </div>
              <button 
                onClick={() => setSettingsModalOpen(null)}
                style={{ background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-muted)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--border-light)'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
              >
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: '32px', position: 'relative', zIndex: 1 }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-glass)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px' }}>
                  <Info size={16} color="var(--accent-primary)" />
                  House Edge Percentage (%)
                </label>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ position: 'relative', flex: '0 0 120px' }}>
                    <input 
                      type="number" 
                      value={aviatorHouseEdge} 
                      onChange={(e) => setAviatorHouseEdge(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-primary)',
                        border: '2px solid var(--border-light)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        color: 'var(--accent-primary)',
                        textAlign: 'center',
                        transition: 'border-color 0.2s',
                        outline: 'none'
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border-light)'}
                      min="1" max="99" step="0.1"
                    />
                    <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700 }}>%</div>
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Return To Player (RTP)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
                      {100 - parseFloat(aviatorHouseEdge || '0')}%
                    </div>
                  </div>
                </div>
                
                <div style={{ marginTop: '20px', padding: '12px', background: 'var(--accent-primary-glow)', borderRadius: '8px', borderLeft: '3px solid var(--accent-primary)' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--accent-primary)' }}>Notice:</strong> The house edge determines the mathematical probability of plane crashes at 1.00x. A house edge of 3% means players will win back ~97% of all bets over the long term. Changes apply to the immediate next round automatically.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ padding: '24px 32px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: '12px', position: 'relative', zIndex: 1 }}>
              <button 
                onClick={() => setSettingsModalOpen(null)} 
                disabled={savingSettings}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  borderRadius: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'var(--border-light)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                Cancel
              </button>
              <button 
                onClick={() => handleSaveSettings('aviator')} 
                disabled={savingSettings}
                style={{
                  padding: '12px 24px',
                  background: 'var(--accent-primary)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '12px',
                  fontWeight: 600,
                  cursor: savingSettings ? 'not-allowed' : 'pointer',
                  opacity: savingSettings ? 0.7 : 1,
                  boxShadow: '0 4px 14px 0 rgba(139, 92, 246, 0.39)',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                {savingSettings ? 'Saving Configuration...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Colour Trading Settings Modal */}
      {settingsModalOpen === 'colour-trading' && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(12px)',
            zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <div 
            style={{ 
              width: '100%', maxWidth: '480px', 
              background: 'linear-gradient(145deg, var(--bg-secondary), var(--bg-primary))',
              border: '1px solid var(--border-glass)',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(16, 185, 129, 0.15)',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {/* Decorative Glow */}
            <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: '#10b981', filter: 'blur(80px)', opacity: 0.2, borderRadius: '50%' }} />

            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '10px', borderRadius: '12px', color: '#10b981' }}>
                  <Settings size={20} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, background: 'linear-gradient(to right, var(--text-primary), var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Colour Trading Configuration
                </h3>
              </div>
              <button 
                onClick={() => setSettingsModalOpen(null)}
                style={{ background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-muted)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--border-light)'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
              >
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: '32px', position: 'relative', zIndex: 1 }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-glass)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px' }}>
                  <Info size={16} color="#10b981" />
                  House Liability Edge (%)
                </label>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ position: 'relative', flex: '0 0 120px' }}>
                    <input 
                      type="number" 
                      value={ctHouseEdge} 
                      onChange={(e) => setCtHouseEdge(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-primary)',
                        border: '2px solid var(--border-light)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        color: '#10b981',
                        textAlign: 'center',
                        transition: 'border-color 0.2s',
                        outline: 'none'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#10b981'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--border-light)'}
                      min="0" max="100" step="1"
                    />
                    <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 700 }}>%</div>
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Liability Protection</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>
                      {ctHouseEdge}% Force Win
                    </div>
                  </div>
                </div>
                
                <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong style={{ color: '#10b981' }}>Notice:</strong> This uses a Liability-Based algorithm. A 30% setting means the server will aggressively minimize its payout 30% of the time, and act randomly 70% of the time. 100% means the House will never lose more than it has to.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ padding: '24px 32px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: '12px', position: 'relative', zIndex: 1 }}>
              <button 
                onClick={() => setSettingsModalOpen(null)} 
                disabled={savingSettings}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  borderRadius: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'var(--border-light)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                Cancel
              </button>
              <button 
                onClick={() => handleSaveSettings('colourtrading')} 
                disabled={savingSettings}
                style={{
                  padding: '12px 24px',
                  background: '#10b981',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '12px',
                  fontWeight: 600,
                  cursor: savingSettings ? 'not-allowed' : 'pointer',
                  opacity: savingSettings ? 0.7 : 1,
                  boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                {savingSettings ? 'Saving Configuration...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Limits Settings Modal */}
      {limitsModalOpen && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(12px)',
            zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <div 
            style={{ 
              width: '100%', maxWidth: '480px', 
              background: 'linear-gradient(145deg, var(--bg-secondary), var(--bg-primary))',
              border: '1px solid var(--border-glass)',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(139, 92, 246, 0.15)',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--accent-primary-glow)', padding: '10px', borderRadius: '12px', color: 'var(--accent-primary)' }}>
                  <DollarSign size={20} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Bet Limits: {limitsModalOpen.name}
                </h3>
              </div>
              <button 
                onClick={() => setLimitsModalOpen(null)}
                style={{ background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-muted)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Minimum Bet Amount (₹)</label>
                  <input 
                    type="number" 
                    value={editMinBet} 
                    onChange={(e) => setEditMinBet(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', padding: '12px', fontSize: '1.1rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Maximum Bet Amount (₹)</label>
                  <input 
                    type="number" 
                    value={editMaxBet} 
                    onChange={(e) => setEditMaxBet(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', padding: '12px', fontSize: '1.1rem' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: '24px 32px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => setLimitsModalOpen(null)} 
                disabled={savingSettings}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveLimits} 
                disabled={savingSettings}
                className="btn btn-primary"
              >
                {savingSettings ? 'Saving...' : 'Save Limits'}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};
