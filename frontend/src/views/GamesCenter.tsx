import React, { useState, useEffect } from 'react';
import { gamesAPI } from '../api';
import { Gamepad2, PlayCircle } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface Props {
  onNavigate: (view: string, props?: any) => void;
}

export const GamesCenter: React.FC<Props> = ({ onNavigate }) => {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await gamesAPI.getGames();
        setGames(res);
      } catch (err) {
        console.error('Failed to fetch games', err);
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  if (loading) return <LoadingSpinner message="Loading games listing..." />;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ padding: '12px', background: 'var(--accent-primary-glow)', borderRadius: 'var(--radius-md)' }}>
          <Gamepad2 size={24} color="var(--accent-primary)" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Gaming Zone</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Play and multiply your balance!</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {games.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ color: 'var(--text-muted)' }}>No games are currently active. Check back later!</p>
          </div>
        ) : (
          games.map((g: any) => (
            <div key={g.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s ease', border: '1px solid var(--border-glass)' }}
              onClick={() => onNavigate(`game-${g.slug}`)}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ height: '140px', background: 'var(--accent-secondary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {g.image_url ? (
                  <img src={g.image_url} alt={g.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Gamepad2 size={48} color="var(--accent-secondary)" opacity={0.5} />
                )}
                <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <PlayCircle size={14} color="#fff" />
                  <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>Play Now</span>
                </div>
              </div>
              <div style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--text-primary)' }}>{g.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{g.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
