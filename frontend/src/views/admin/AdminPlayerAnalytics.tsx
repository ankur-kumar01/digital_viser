import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../api';
import { Activity, Trophy, TrendingDown, Users, Search, Target, PieChart, Info, DollarSign } from 'lucide-react';
const formatCurrency = (val: number | string) => {
  return `₹${parseFloat(val.toString() || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
};

export const AdminPlayerAnalytics: React.FC = () => {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchPlayers = async () => {
    try {
      const res = await adminAPI.getGamePlayersAnalytics();
      setPlayers(res);
    } catch (err) {
      console.error('Failed to fetch players analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.email.toLowerCase().includes(search.toLowerCase())
  );

  // Top Insights
  const topWinner = [...players].sort((a, b) => Number(a.total_pnl) - Number(b.total_pnl))[0]; // PNL negative = player won
  const topLoser = [...players].sort((a, b) => Number(b.total_pnl) - Number(a.total_pnl))[0]; // PNL positive = system won
  const topWhale = [...players].sort((a, b) => Number(b.total_wagered) - Number(a.total_wagered))[0];

  if (loading) return <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Loading analytics...</div>;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ padding: '12px', background: 'var(--accent-primary-glow)', borderRadius: 'var(--radius-md)' }}>
          <Activity size={24} color="var(--accent-primary)" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Player Analytics</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Monitor user gaming and betting patterns across all games</p>
        </div>
      </div>

      {players.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          {/* Top Winner (Player winning most from system) */}
          <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-danger)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trophy size={16} color="var(--accent-danger)" /> Top Winner
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{topWinner?.name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-danger)' }}>
                  {formatCurrency(Math.abs(Math.min(0, Number(topWinner?.total_pnl || 0))))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Net Player Profit</div>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Total Wagered: <strong>{formatCurrency(Number(topWinner?.total_wagered))}</strong>
            </div>
          </div>

          {/* Top Loser (System winning most from player) */}
          <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingDown size={16} color="var(--accent-secondary)" /> Top Contributor
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{topLoser?.name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                  {formatCurrency(Math.max(0, Number(topLoser?.total_pnl || 0)))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Net System Profit</div>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Total Wagered: <strong>{formatCurrency(Number(topLoser?.total_wagered))}</strong>
            </div>
          </div>

          {/* High Roller */}
          <div className="glass-card" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={16} color="#3b82f6" /> Highest Volume
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{topWhale?.name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>
                  {formatCurrency(Number(topWhale?.total_wagered || 0))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Volume</div>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              System PnL: <strong>{Number(topWhale?.total_pnl) >= 0 ? '+' : ''}{formatCurrency(Number(topWhale?.total_pnl))}</strong>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} /> Detailed Player Reports
          </h3>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                padding: '10px 12px 10px 40px',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-glass)' }}>
                <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>PLAYER</th>
                <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>AVIATOR (BETS / VOL / PNL)</th>
                <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>COLOUR TRADING (BETS / VOL / PNL)</th>
                <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>OVERALL VOLUME</th>
                <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>SYSTEM PNL</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No players found</td>
                </tr>
              ) : (
                filteredPlayers.map(p => {
                  const sysPnl = Number(p.total_pnl);
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.email}</div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{p.aviator_bets_count} bets</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Vol: {formatCurrency(Number(p.aviator_wagered))}</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: Number(p.aviator_pnl) >= 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)' }}>
                          PnL: {Number(p.aviator_pnl) >= 0 ? '+' : ''}{formatCurrency(Number(p.aviator_pnl))}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{p.ct_bets_count} bets</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Vol: {formatCurrency(Number(p.ct_wagered))}</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: Number(p.ct_pnl) >= 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)' }}>
                          PnL: {Number(p.ct_pnl) >= 0 ? '+' : ''}{formatCurrency(Number(p.ct_pnl))}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatCurrency(Number(p.total_wagered))}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <span style={{ 
                          padding: '6px 10px', 
                          borderRadius: '8px', 
                          fontSize: '0.9rem', 
                          fontWeight: 700,
                          background: sysPnl >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: sysPnl >= 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)'
                        }}>
                          {sysPnl >= 0 ? '+' : ''}{formatCurrency(sysPnl)}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
