import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../api';
import { Gamepad2, Play, Pause, Settings, Info } from 'lucide-react';

export const AdminGames: React.FC = () => {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGames = async () => {
    try {
      const res = await adminAPI.getGames();
      setGames(res);
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
                  <button 
                    className="btn btn-secondary"
                    style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Settings (Coming Soon)"
                  >
                    <Settings size={18} />
                  </button>
                </div>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
};
