import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../api';
import { Activity, Trophy, TrendingDown, Users, Search, Target, ChevronLeft, ChevronRight } from 'lucide-react';

const formatCurrency = (val: number | string) => {
  return `\u20B9${parseFloat(val.toString() || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
};

const GAME_TABS = [
  { key: 'all', label: 'All Games', icon: '🎮' },
  { key: 'aviator', label: 'Aviator', icon: '✈️' },
  { key: 'colourtrading', label: 'Colour Trading', icon: '🎨' },
  { key: 'ludo', label: 'Ludo', icon: '🎲' },
  { key: 'fantasy', label: 'Cricket Fantasy', icon: '🏏' },
];

const GAME_COLUMNS: Record<string, { label: string; bets: string; vol: string; pnl: string; pnlLabel: string }> = {
  aviator: { label: 'Aviator', bets: 'aviator_bets_count', vol: 'aviator_wagered', pnl: 'aviator_pnl', pnlLabel: 'System PnL' },
  colourtrading: { label: 'Colour Trading', bets: 'ct_bets_count', vol: 'ct_wagered', pnl: 'ct_pnl', pnlLabel: 'System PnL' },
  ludo: { label: 'Ludo', bets: 'ludo_bets_count', vol: 'ludo_wagered', pnl: 'ludo_pnl', pnlLabel: 'System PnL' },
  fantasy: { label: 'Cricket Fantasy', bets: 'fantasy_bets_count', vol: 'fantasy_fees', pnl: 'fantasy_pnl', pnlLabel: 'System PnL' },
};

export const AdminPlayerAnalytics: React.FC = () => {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeGame, setActiveGame] = useState('all');
  const [insights, setInsights] = useState<{ topWinner: any; topLoser: any; topWhale: any }>({ topWinner: null, topLoser: null, topWhale: null });

  const fetchPlayers = useCallback(async (p: number, g: string, s: string) => {
    setLoading(true);
    try {
      const res = await adminAPI.getGamePlayersAnalytics(p, 20, s || undefined, g);
      setPlayers(res.players || []);
      setPage(res.pagination?.page || 1);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
      setInsights(res.insights || { topWinner: null, topLoser: null, topWhale: null });
    } catch (err) {
      console.error('Failed to fetch players analytics', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlayers(page, activeGame, search);
  }, [page, activeGame, fetchPlayers]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleTabChange = (key: string) => {
    setActiveGame(key);
    setPage(1);
    setSearch('');
    setSearchInput('');
  };

  const getGameCell = (p: any, gameKey: string) => {
    const cols = GAME_COLUMNS[gameKey];
    if (!cols) return null;
    const bets = Number(p[cols.bets] || 0);
    const vol = Number(p[cols.vol] || 0);
    const pnl = Number(p[cols.pnl] || 0);
    return (
      <td style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{bets} bets</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Vol: {formatCurrency(vol)}</div>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: pnl >= 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)' }}>
          {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
        </div>
      </td>
    );
  };

  // Pagination controls
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid var(--border-glass)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Showing {players.length} of {total} players
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              padding: '8px 12px', border: '1px solid var(--border-light)', borderRadius: '6px',
              background: 'var(--bg-tertiary)', color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: page <= 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          {pages.map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                padding: '8px 14px', border: '1px solid var(--border-light)', borderRadius: '6px',
                background: p === page ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: p === page ? '#fff' : 'var(--text-primary)',
                fontWeight: p === page ? 700 : 400, cursor: 'pointer'
              }}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              padding: '8px 12px', border: '1px solid var(--border-light)', borderRadius: '6px',
              background: 'var(--bg-tertiary)', color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  };

  if (loading && players.length === 0) {
    return <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Loading analytics...</div>;
  }

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

      {/* KPI Insight Cards */}
      {insights.topWinner && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-danger)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trophy size={16} color="var(--accent-danger)" /> Top Winner
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{insights.topWinner?.name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-danger)' }}>
                  {formatCurrency(Math.abs(Math.min(0, Number(insights.topWinner?.total_pnl || 0))))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Net Player Profit</div>
              </div>
            </div>
          </div>
          <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingDown size={16} color="var(--accent-secondary)" /> Top Contributor
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{insights.topLoser?.name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                  {formatCurrency(Math.max(0, Number(insights.topLoser?.total_pnl || 0)))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Net System Profit</div>
              </div>
            </div>
          </div>
          <div className="glass-card" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={16} color="#3b82f6" /> Highest Volume
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{insights.topWhale?.name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>
                  {formatCurrency(Number(insights.topWhale?.total_wagered || 0))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Volume</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {GAME_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            style={{
              padding: '10px 18px', border: 'none', borderRadius: '10px', cursor: 'pointer',
              background: activeGame === tab.key ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: activeGame === tab.key ? '#fff' : 'var(--text-primary)',
              fontWeight: activeGame === tab.key ? 600 : 400,
              fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} /> Detailed Player Reports
            {activeGame !== 'all' && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>({GAME_TABS.find(t => t.key === activeGame)?.label})</span>}
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', width: '250px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)',
                  borderRadius: '8px', padding: '10px 12px 10px 40px', color: 'var(--text-primary)', outline: 'none'
                }}
              />
            </div>
            <button
              onClick={handleSearch}
              style={{
                padding: '10px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                background: 'var(--accent-primary)', color: '#fff', fontWeight: 600
              }}
            >
              Search
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: activeGame === 'all' ? '1400px' : '800px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-glass)' }}>
                <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>PLAYER</th>
                {activeGame === 'all' ? (
                  <>
                    <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>AVIATOR (BETS/VOL/PNL)</th>
                    <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>COLOUR TRADING (BETS/VOL/PNL)</th>
                    <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>FRUIT SLASHER (BETS/VOL/PNL)</th>
                    <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>LUDO (MATCHES/VOL/PNL)</th>
                    <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>FANTASY (ENTRIES/FEES/PNL)</th>
                  </>
                ) : (
                  <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>
                    {GAME_COLUMNS[activeGame]?.label} (BETS/VOL/PNL)
                  </th>
                )}
                <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>OVERALL VOLUME</th>
                <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>SYSTEM PNL</th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr>
                  <td colSpan={activeGame === 'all' ? 8 : 4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No players found</td>
                </tr>
              ) : (
                players.map(p => {
                  const sysPnl = Number(p.total_pnl);
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.email}</div>
                      </td>
                      {activeGame === 'all' ? (
                        <>
                          {getGameCell(p, 'aviator')}
                          {getGameCell(p, 'colourtrading')}
                          {getGameCell(p, 'fruitslasher')}
                          {getGameCell(p, 'ludo')}
                          {getGameCell(p, 'fantasy')}
                        </>
                      ) : (
                        getGameCell(p, activeGame)
                      )}
                      <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatCurrency(Number(p.total_wagered))}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <span style={{
                          padding: '6px 10px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700,
                          background: sysPnl >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: sysPnl >= 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)'
                        }}>
                          {sysPnl >= 0 ? '+' : ''}{formatCurrency(sysPnl)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {renderPagination()}
      </div>
    </div>
  );
};