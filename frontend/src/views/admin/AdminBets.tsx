import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../api';
import { Gamepad2, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatGlobalDate } from '../../utils/dateFormatter';

export const AdminBets: React.FC = () => {
  const [bets, setBets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [gameFilter, setGameFilter] = useState('all');

  const totalPages = Math.ceil(total / limit);

  const fetchBets = async () => {
    try {
      setIsLoading(true);
      const data = await adminAPI.getBets(currentPage, limit);
      setBets(data.bets);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch bets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBets();
  }, [currentPage, limit]);

  const filteredBets = gameFilter === 'all' ? bets : bets.filter(b => b.game_type === gameFilter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'var(--accent-primary)';
      case 'cashed_out':
      case 'won': return 'var(--accent-secondary)';
      case 'lost': return 'var(--accent-danger)';
      default: return 'var(--text-secondary)';
    }
  };

  const getGameBadge = (game_type: string) => {
    const colors: Record<string, string> = {
      aviator: '#8B5CF6',
      colour_trading: '#F59E0B',
      fruit_slasher: '#10B981'
    };
    const labels: Record<string, string> = {
      aviator: 'Aviator',
      colour_trading: 'Colour Trading',
      fruit_slasher: 'Fruit Slasher'
    };
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '20px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: `${colors[game_type]}20`,
        color: colors[game_type]
      }}>
        {labels[game_type] || game_type}
      </span>
    );
  };

  if (isLoading) return <div style={{ padding: '32px' }}>Loading bets...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Gamepad2 size={28} color="var(--accent-primary)" />
          All Bets
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>View all bets placed across all games, sorted by most recent.</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {['all', 'aviator', 'colour_trading', 'fruit_slasher'].map(game => (
          <button
            key={game}
            onClick={() => setGameFilter(game)}
            style={{
              padding: '6px 16px',
              background: gameFilter === game ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: gameFilter === game ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '20px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'capitalize'
            }}
          >
            {game === 'all' ? 'All Games' : game.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Game</th>
              <th>Bet Amount</th>
              <th>Win Amount</th>
              <th>Multiplier</th>
              <th>Status</th>
              {filteredBets.some(b => b.color) && <th>Color</th>}
            </tr>
          </thead>
          <tbody>
            {filteredBets.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No bets found.</td>
              </tr>
            ) : (
              filteredBets.map((bet) => (
                <tr key={`${bet.game_type}-${bet.id}`}>
                  <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatGlobalDate(bet.created_at)}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{bet.user_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{bet.user_email}</div>
                  </td>
                  <td>{getGameBadge(bet.game_type)}</td>
                  <td style={{ fontWeight: 600 }}>₹{parseFloat(bet.bet_amount).toFixed(2)}</td>
                  <td style={{ fontWeight: 700, color: bet.win_amount ? 'var(--accent-secondary)' : 'var(--text-muted)' }}>
                    {bet.win_amount ? `₹${parseFloat(bet.win_amount).toFixed(2)}` : '-'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {bet.cashout_multiplier ? `${parseFloat(bet.cashout_multiplier).toFixed(2)}x` : '-'}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      background: `${getStatusColor(bet.status)}20`,
                      color: getStatusColor(bet.status)
                    }}>
                      {bet.status.replace('_', ' ')}
                    </span>
                  </td>
                  {filteredBets.some(b => b.color) && (
                    <td style={{ textTransform: 'capitalize' }}>{bet.color || '-'}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <span>Show</span>
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setCurrentPage(1); }}
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '4px 8px', outline: 'none', cursor: 'pointer' }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>entries per page (Total: {total})</span>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} style={{ padding: '6px 10px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ padding: '6px 12px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>
              <ArrowLeft size={16} /> Prev
            </button>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '0 8px' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ padding: '6px 12px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>
              Next <ArrowRight size={16} />
            </button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} style={{ padding: '6px 10px', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
