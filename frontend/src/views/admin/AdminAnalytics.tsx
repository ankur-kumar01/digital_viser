import React, { useState, useEffect, useCallback } from 'react';
import { analyticsAPI } from '../../api';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Shield,
  Activity, BarChart3, RefreshCw, AlertTriangle, Zap,
  ArrowUpRight, ArrowDownRight, Target, Cpu, ChevronDown, ChevronUp,
  Calendar
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
type Period = '24h' | '2d' | '7d' | '30d' | 'custom';

interface OverviewData { deposits: any; withdrawals: any; net_flow: number; interest_credited: any; fdr_maturity_payouts: any; referral_commissions: any; bonus_unlocked: any; new_users: number; fdr_corpus: any; platform_totals: any; action_required: any; }
interface GamesData { aviator: any; colour_trading: any; fruit_slasher: any; ludo: any; cricket_fantasy: any; total_game_house_profit: number; }
interface FdrsData { new_fdrs: any; matured_fdrs: any; status_breakdown: any; daily_interest_timeline: any[]; top_investors: any[]; active_by_plan: any[]; }
interface UsersData { new_registrations: number; active_users: number; top_depositors: any[]; top_withdrawers: any[]; top_aviator_players: any[]; top_ct_players: any[]; top_fruit_players: any[]; }
interface TxData { totals: any; by_type: any[]; daily_timeline: any[]; large_transaction_alerts: any[]; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${(n || 0).toFixed(2)}`;
};
const pct = (n: number) => `${(n || 0).toFixed(1)}%`;

const TX_LABELS: Record<string, { label: string; color: string }> = {
  interest:              { label: 'FDR Interest',         color: '#10b981' },
  fdr_maturity:          { label: 'FDR Maturity Payout',  color: '#3b82f6' },
  deposit:               { label: 'Deposit',              color: '#22c55e' },
  withdrawal:            { label: 'Withdrawal',           color: '#ef4444' },
  fdr_referral_commission: { label: 'Referral Commission', color: '#a78bfa' },
  game_win:              { label: 'Game Win',             color: '#f59e0b' },
  game_loss:             { label: 'Game Loss',            color: '#f87171' },
  bonus_unlocked:        { label: 'Bonus Unlocked',       color: '#6366f1' },
  funds_unlocked_auto:   { label: 'Funds Auto-Unlocked',  color: '#8b5cf6' },
  referral_bonus:        { label: 'Referral Bonus',       color: '#ec4899' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon: Icon, color, trend }: { label: string; value: string; sub?: string; icon: any; color: string; trend?: 'up' | 'down' | 'neutral' }) => (
  <div className="premium-kpi-card" style={{ '--card-color': color } as React.CSSProperties}>
    <div className="kpi-icon-bg">
      <Icon size={48} color={color} strokeWidth={1.5} />
    </div>
    <div className="kpi-header">
      <span className="kpi-label">{label}</span>
      {trend && trend !== 'neutral' && (
        <div className={`kpi-trend trend-${trend}`} style={{ color: trend === 'up' ? '#10b981' : '#ef4444' }}>
          {trend === 'up' ? <ArrowUpRight size={18} strokeWidth={2.5} /> : <ArrowDownRight size={18} strokeWidth={2.5} />}
        </div>
      )}
    </div>
    <div className="kpi-value" style={{ color }}>{value}</div>
    {sub && <div className="kpi-sub">{sub}</div>}
  </div>
);

const SectionHeader = ({ icon: Icon, title, color, collapsed, onToggle }: { icon: any; title: string; color: string; collapsed: boolean; onToggle: () => void }) => (
  <div className="premium-section-header" onClick={onToggle} style={{ '--sec-color': color, marginBottom: collapsed ? 0 : '20px' } as React.CSSProperties}>
    <div className="sec-header-left">
      <div className="sec-icon-container" style={{ background: `linear-gradient(135deg, ${color}33, ${color}11)`, border: `1px solid ${color}40` }}>
        <Icon size={20} color={color} />
      </div>
      <span className="sec-title" style={{ color }}>{title}</span>
    </div>
    <div className="sec-header-right">
      {collapsed ? <ChevronDown size={20} color={color} /> : <ChevronUp size={20} color={color} />}
    </div>
  </div>
);

const GameBlock = ({ title, icon, color, data, extra }: { title: string; icon: string; color: string; data: any; extra?: React.ReactNode }) => {
  if (!data) return null;
  const profit = data.house_profit ?? data.net_revenue ?? 0;
  const wagered = data.total_wagered ?? data.total_fees_collected ?? data.total_pool ?? 0;
  const bets = data.total_bets ?? data.total_entries ?? data.completed_matches ?? 0;
  const winRate = data.win_rate_pct;

  return (
    <div className="premium-game-block" style={{ '--game-color': color } as React.CSSProperties}>
      <div className="game-header">
        <div className="game-title-container">
          <span className="game-emoji-icon">{icon}</span>
          <span className="game-title" style={{ color }}>{title}</span>
        </div>
        <div className={`game-profit-badge ${profit >= 0 ? 'profit-up' : 'profit-down'}`}>
          <span className="profit-indicator">{profit >= 0 ? '▲' : '▼'}</span>
          <span className="profit-amount">{fmtShort(Math.abs(profit))} P/L</span>
        </div>
      </div>
      
      <div className="game-stats-grid">
        {[
          { label: bets === data.completed_matches ? 'Matches' : 'Total Bets', value: bets.toLocaleString() },
          { label: 'Total Wagered', value: fmtShort(wagered) },
          { label: 'House Profit', value: fmtShort(profit), highlight: true, positive: profit >= 0 },
          ...(winRate !== undefined ? [{ label: 'Win Rate', value: pct(winRate) }] : []),
          ...(data.avg_cashout_multiplier !== undefined ? [{ label: 'Avg Multiplier', value: `${data.avg_cashout_multiplier}x` }] : []),
          ...(data.prize_distributed !== undefined ? [{ label: 'Prizes Paid', value: fmtShort(data.prize_distributed) }] : []),
          ...(data.total_paid_out !== undefined && data.total_wagered !== undefined ? [{ label: 'Paid Out', value: fmtShort(data.total_paid_out) }] : []),
          ...(data.live_now !== undefined ? [{ label: 'Live Now', value: data.live_now, highlight: data.live_now > 0 }] : []),
          ...(data.cancelled_rooms !== undefined ? [{ label: 'Cancelled', value: data.cancelled_rooms }] : []),
          ...(data.won_count !== undefined ? [{ label: 'Won', value: data.won_count }, { label: 'Lost', value: data.lost_count }] : []),
        ].slice(0, 6).map(({ label, value, highlight, positive }: any) => (
          <div key={label} className="game-stat-box">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={highlight ? { color: positive ? '#10b981' : '#ef4444' } : {}}>{value}</div>
          </div>
        ))}
      </div>
      {extra && <div className="game-extra-content">{extra}</div>}
    </div>
  );
};

const MiniTable = ({ headers, rows, emptyText = 'No data' }: { headers: string[]; rows: any[][]; emptyText?: string }) => (
  <div className="premium-table-container">
    <table className="premium-mini-table">
      <thead>
        <tr>
          {headers.map(h => <th key={h}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={headers.length} className="empty-row">{emptyText}</td></tr>
        ) : rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const AlertBadge = ({ count, color = '#f59e0b' }: { count: number; color?: string }) => count > 0 ? (
  <span className="premium-alert-badge" style={{ '--badge-color': color } as React.CSSProperties}>{count}</span>
) : null;

const LoadingSection = () => (
  <div className="premium-loading-section">
    <div className="loading-spinner" />
    <span>Loading intelligence...</span>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export const AdminAnalytics: React.FC = () => {
  const [period, setPeriod]         = useState<Period>('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const [overview, setOverview]   = useState<OverviewData | null>(null);
  const [games, setGames]         = useState<GamesData | null>(null);
  const [fdrs, setFdrs]           = useState<FdrsData | null>(null);
  const [users, setUsers]         = useState<UsersData | null>(null);
  const [txData, setTxData]       = useState<TxData | null>(null);

  const [loadingOverview, setLoadingOverview]   = useState(false);
  const [loadingGames, setLoadingGames]         = useState(false);
  const [loadingFdrs, setLoadingFdrs]           = useState(false);
  const [loadingUsers, setLoadingUsers]         = useState(false);
  const [loadingTx, setLoadingTx]               = useState(false);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setCollapsed(p => ({ ...p, [key]: !p[key] }));

  const from = period === 'custom' ? customFrom : undefined;
  const to   = period === 'custom' ? customTo   : undefined;

  const fetchData = useCallback(async () => {
    if (period === 'custom' && (!customFrom || !customTo)) return;

    setLoadingOverview(true); setLoadingGames(true); setLoadingFdrs(true); setLoadingUsers(true); setLoadingTx(true);
    setLastRefresh(new Date());

    const safeSet = async (setter: any, setLoading: any, fetcher: any) => {
      try { setter(await fetcher()); } catch { setter(null); } finally { setLoading(false); }
    };

    await Promise.all([
      safeSet(setOverview,  setLoadingOverview, () => analyticsAPI.getOverview(period, from, to)),
      safeSet(setGames,     setLoadingGames,    () => analyticsAPI.getGames(period, from, to)),
      safeSet(setFdrs,      setLoadingFdrs,     () => analyticsAPI.getFdrs(period, from, to)),
      safeSet(setUsers,     setLoadingUsers,    () => analyticsAPI.getUsers(period, from, to)),
      safeSet(setTxData,    setLoadingTx,       () => analyticsAPI.getTransactions(period, from, to)),
    ]);
  }, [period, customFrom, customTo, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const periodLabel: Record<Period, string> = { '24h': 'Last 24 Hours', '2d': 'Last 2 Days', '7d': 'Last 7 Days', '30d': 'Last 30 Days', 'custom': 'Custom Range' };

  return (
    <div className="admin-analytics-wrapper" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1440px', margin: '0 auto', position: 'relative' }}>
      
      {/* Background Glow Orbs */}
      <div className="bg-glow-orb orb-primary" />
      <div className="bg-glow-orb orb-secondary" />

      {/* ─── Header ─── */}
      <div className="dashboard-header">
        <div className="header-title-section">
          <div className="header-icon-box">
            <Shield size={24} color="#818cf8" strokeWidth={2} />
          </div>
          <div>
            <h1 className="header-title">Intelligence Center</h1>
            <div className="header-subtitle">
              <div className="live-indicator" />
              <span>Live Monitor · Refreshed {lastRefresh.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
        <button onClick={fetchData} className="refresh-btn">
          <RefreshCw size={16} />
          <span>Sync Data</span>
        </button>
      </div>

      {/* ─── Period Selector ─── */}
      <div className="premium-period-selector">
        <div className="period-tabs-wrapper">
          <Calendar size={18} color="rgba(156,163,175,0.8)" />
          <span className="period-label">Analysis Period</span>
          <div className="period-tabs">
            {(['24h', '2d', '7d', '30d', 'custom'] as Period[]).map(p => (
              <button key={p} 
                onClick={() => setPeriod(p)}
                className={`period-btn ${period === p ? 'active' : ''}`}>
                {p === 'custom' ? '📅 Custom' : p.toUpperCase()}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="custom-date-inputs">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="date-input" />
              <span className="date-sep">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="date-input" />
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — FINANCIAL OVERVIEW
      ════════════════════════════════════════════════════════════════════════*/}
      <div>
        <SectionHeader icon={DollarSign} title={`Financial Overview — ${periodLabel[period]}`} color="#f59e0b" collapsed={!!collapsed.overview} onToggle={() => toggleSection('overview')} />
        {!collapsed.overview && (
          loadingOverview ? <LoadingSection /> : overview ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Action Required alerts */}
              {(overview.action_required.pending_deposits.count > 0 || overview.action_required.pending_withdrawals.count > 0) && (
                <div className="alerts-container">
                  {overview.action_required.pending_deposits.count > 0 && (
                    <div className="premium-alert alert-warning">
                      <div className="alert-icon-box"><AlertTriangle size={18} /></div>
                      <div className="alert-content">
                        <span className="alert-title">Pending Deposits Action Required</span>
                        <span className="alert-desc">{overview.action_required.pending_deposits.count} deposits totaling {fmtShort(overview.action_required.pending_deposits.amount)} are awaiting approval.</span>
                      </div>
                    </div>
                  )}
                  {overview.action_required.pending_withdrawals.count > 0 && (
                    <div className="premium-alert alert-danger">
                      <div className="alert-icon-box"><AlertTriangle size={18} /></div>
                      <div className="alert-content">
                        <span className="alert-title">Pending Withdrawals Action Required</span>
                        <span className="alert-desc">{overview.action_required.pending_withdrawals.count} withdrawals totaling {fmtShort(overview.action_required.pending_withdrawals.amount)} are awaiting approval.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* KPI Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                <KpiCard label="Total Deposits" value={fmtShort(overview.deposits.approved.amount)} sub={`${overview.deposits.approved.count} approved | ${overview.deposits.pending.count} pending`} icon={TrendingUp} color="#22c55e" trend="up" />
                <KpiCard label="Total Withdrawals" value={fmtShort(overview.withdrawals.approved.amount)} sub={`${overview.withdrawals.approved.count} approved | ${overview.withdrawals.pending.count} pending`} icon={TrendingDown} color="#ef4444" trend="down" />
                <KpiCard label="Net Cash Flow" value={fmtShort(Math.abs(overview.net_flow))} sub={overview.net_flow >= 0 ? '▲ Net Inflow' : '▼ Net Outflow'} icon={Activity} color={overview.net_flow >= 0 ? '#10b981' : '#f87171'} trend={overview.net_flow >= 0 ? 'up' : 'down'} />
                <KpiCard label="Interest Credited" value={fmtShort(overview.interest_credited.amount)} sub={`${overview.interest_credited.count} transactions`} icon={Zap} color="#6366f1" />
                <KpiCard label="FDR Maturity Paid" value={fmtShort(overview.fdr_maturity_payouts.amount)} sub={`${overview.fdr_maturity_payouts.count} FDRs matured`} icon={Target} color="#8b5cf6" />
                <KpiCard label="Referral Commissions" value={fmtShort(overview.referral_commissions.amount)} sub={`${overview.referral_commissions.count} credits`} icon={Users} color="#a78bfa" />
                <KpiCard label="New Users" value={overview.new_users.toString()} sub="Registered this period" icon={Users} color="#3b82f6" />
                <KpiCard label="Active FDR Corpus" value={fmtShort(overview.fdr_corpus.total_corpus)} sub={`${overview.fdr_corpus.active_count} active FDRs`} icon={BarChart3} color="#f59e0b" />
              </div>

              {/* Platform balance snapshot */}
              <div className="premium-snapshot-card">
                <div className="snapshot-header">
                  <div className="snapshot-glow" />
                  <p className="snapshot-title">PLATFORM WALLET SNAPSHOT (ALL TIME)</p>
                </div>
                <div className="snapshot-grid">
                  {[
                    { label: 'Total Users', value: overview.platform_totals.total_users.toLocaleString(), color: '#3b82f6' },
                    { label: 'User Main Balances', value: fmtShort(overview.platform_totals.total_balance), color: '#22c55e' },
                    { label: 'Bonus Balances', value: fmtShort(overview.platform_totals.bonus_balance), color: '#a78bfa' },
                    { label: 'Referral Balances', value: fmtShort(overview.platform_totals.referral_balance), color: '#ec4899' },
                    { label: 'Locked Balances', value: fmtShort(overview.platform_totals.locked_balance), color: '#f87171' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="snapshot-item" style={{ '--item-color': color } as React.CSSProperties}>
                      <div className="snapshot-item-label">{label}</div>
                      <div className="snapshot-item-value">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deposit/Withdrawal breakdown table */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {[
                  { title: '💰 Deposit Breakdown', data: overview.deposits, color: '#22c55e' },
                  { title: '🏧 Withdrawal Breakdown', data: overview.withdrawals, color: '#ef4444' },
                ].map(({ title, data, color }) => (
                  <div key={title} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}20`, borderRadius: '12px', padding: '16px' }}>
                    <p style={{ fontWeight: 700, color, fontSize: '0.88rem', marginBottom: '12px' }}>{title}</p>
                    <MiniTable
                      headers={['Status', 'Count', 'Amount']}
                      rows={[
                        ['✅ Approved', data.approved.count, fmt(data.approved.amount)],
                        ['⏳ Pending',  data.pending.count,  fmt(data.pending.amount)],
                        ['❌ Rejected', data.rejected.count, fmt(data.rejected.amount)],
                        ['📊 Total',    data.total.count,    fmt(data.total.amount)],
                      ]}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : <div style={{ padding: '20px', color: 'rgba(156,163,175,0.5)', textAlign: 'center' }}>Failed to load overview data.</div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 — GAME ANALYTICS
      ════════════════════════════════════════════════════════════════════════*/}
      <div>
        <SectionHeader icon={BarChart3} title="Game Analytics" color="#06b6d4" collapsed={!!collapsed.games} onToggle={() => toggleSection('games')} />
        {!collapsed.games && (
          loadingGames ? <LoadingSection /> : games ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Total game revenue summary */}
              <div className="premium-revenue-banner">
                <div className="revenue-banner-bg" />
                <div className="revenue-banner-content">
                  <div className="revenue-label-group">
                    <div className="revenue-icon"><Cpu size={20} color="#22d3ee" /></div>
                    <span className="revenue-label">Combined Platform Game Revenue</span>
                  </div>
                  <div className="revenue-value-group">
                    <span className={`revenue-value ${games.total_game_house_profit >= 0 ? 'positive' : 'negative'}`}>
                      {games.total_game_house_profit >= 0 ? '+' : ''}{fmtShort(games.total_game_house_profit)}
                    </span>
                    <span className="revenue-sub">NET PROFIT</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                <GameBlock title="Aviator" icon="✈️" color="#f59e0b" data={games.aviator}
                  extra={games.aviator?.top_winners?.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <p style={{ fontSize: '0.7rem', color: 'rgba(156,163,175,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Top Winners</p>
                      <MiniTable headers={['Player', 'Won']}
                        rows={games.aviator.top_winners.map((w: any) => [w.name, fmt(w.total_won)])} />
                    </div>
                  )}
                />
                <GameBlock title="Colour Trading" icon="🎨" color="#ec4899" data={games.colour_trading}
                  extra={games.colour_trading?.by_color && (
                    <div style={{ marginTop: '4px' }}>
                      <p style={{ fontSize: '0.7rem', color: 'rgba(156,163,175,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>By Color</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {Object.entries(games.colour_trading.by_color).map(([color, stats]: [string, any]) => (
                          <div key={color} style={{ background: color === 'red' ? 'rgba(239,68,68,0.1)' : color === 'green' ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.1)', border: `1px solid ${color === 'red' ? '#ef4444' : color === 'green' ? '#10b981' : '#8b5cf6'}40`, borderRadius: '8px', padding: '8px 12px', flex: 1, minWidth: '80px' }}>
                            <div style={{ fontSize: '0.68rem', color: 'rgba(156,163,175,0.7)', marginBottom: '4px', textTransform: 'capitalize' }}>{color}</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#e5e7eb' }}>{stats.bets} bets</div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(156,163,175,0.7)' }}>{fmtShort(stats.wagered)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                />
                <GameBlock title="Fruit Slasher" icon="🍉" color="#10b981" data={games.fruit_slasher} />
                <GameBlock title="Ludo Multiplayer" icon="🎲" color="#6366f1" data={games.ludo} />
                <GameBlock title="Cricket Fantasy" icon="🏏" color="#f97316" data={{ ...games.cricket_fantasy, total_wagered: games.cricket_fantasy?.total_fees_collected, house_profit: games.cricket_fantasy?.net_revenue, total_bets: games.cricket_fantasy?.total_entries }} />
              </div>
            </div>
          ) : <div style={{ padding: '20px', color: 'rgba(156,163,175,0.5)', textAlign: 'center' }}>Failed to load game data.</div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3 — FDR ANALYTICS
      ════════════════════════════════════════════════════════════════════════*/}
      <div>
        <SectionHeader icon={TrendingUp} title="FDR Deep Analytics" color="#10b981" collapsed={!!collapsed.fdrs} onToggle={() => toggleSection('fdrs')} />
        {!collapsed.fdrs && (
          loadingFdrs ? <LoadingSection /> : fdrs ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                <KpiCard label="New FDRs Created" value={fdrs.new_fdrs.count.toString()} sub={fmtShort(fdrs.new_fdrs.amount)} icon={TrendingUp} color="#10b981" />
                <KpiCard label="FDRs Matured" value={fdrs.matured_fdrs.count.toString()} sub={fmtShort(fdrs.matured_fdrs.amount) + ' returned'} icon={Target} color="#6366f1" />
                {fdrs.status_breakdown?.active && <KpiCard label="Active FDRs" value={fdrs.status_breakdown.active.count.toString()} sub={fmtShort(fdrs.status_breakdown.active.corpus) + ' corpus'} icon={Activity} color="#f59e0b" />}
                {fdrs.status_breakdown?.completed && <KpiCard label="Completed FDRs" value={fdrs.status_breakdown.completed.count.toString()} sub={fmtShort(fdrs.status_breakdown.completed.accrued) + ' earned'} icon={Zap} color="#a78bfa" />}
              </div>

              {/* Daily Interest Timeline */}
              {fdrs.daily_interest_timeline.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '12px', padding: '16px 20px' }}>
                  <p style={{ fontWeight: 700, color: '#10b981', fontSize: '0.85rem', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>📅 Daily Interest Payout Timeline</p>
                  <MiniTable
                    headers={['Date', 'Interest Credited', 'Transactions']}
                    rows={fdrs.daily_interest_timeline.map(r => [
                      new Date(r.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                      fmt(r.amount),
                      r.tx_count.toLocaleString(),
                    ])}
                    emptyText="No interest credited in this period"
                  />
                </div>
              )}

              {/* Active by Plan & Top Investors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.85rem', marginBottom: '12px' }}>📐 Active FDRs by Plan Duration</p>
                  <MiniTable
                    headers={['Days', 'Count', 'Corpus', 'Avg Rate']}
                    rows={fdrs.active_by_plan.map(r => [
                      `${r.period_days}d`,
                      r.count.toLocaleString(),
                      fmtShort(r.corpus),
                      `${r.avg_rate}%`,
                    ])}
                    emptyText="No active FDRs"
                  />
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ fontWeight: 700, color: '#6366f1', fontSize: '0.85rem', marginBottom: '12px' }}>🏆 Top FDR Investors (Active)</p>
                  <MiniTable
                    headers={['Investor', 'FDRs', 'Invested', 'Earned']}
                    rows={fdrs.top_investors.map(r => [
                      r.name,
                      r.fdr_count,
                      fmtShort(r.total_invested),
                      fmtShort(r.total_earned),
                    ])}
                    emptyText="No active FDR investors"
                  />
                </div>
              </div>
            </div>
          ) : <div style={{ padding: '20px', color: 'rgba(156,163,175,0.5)', textAlign: 'center' }}>Failed to load FDR data.</div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4 — USER ANALYTICS
      ════════════════════════════════════════════════════════════════════════*/}
      <div>
        <SectionHeader icon={Users} title="User Activity Monitor" color="#3b82f6" collapsed={!!collapsed.users} onToggle={() => toggleSection('users')} />
        {!collapsed.users && (
          loadingUsers ? <LoadingSection /> : users ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                <KpiCard label="New Registrations" value={users.new_registrations.toString()} sub="Users joined this period" icon={Users} color="#22c55e" />
                <KpiCard label="Active Users" value={users.active_users.toString()} sub="Logged in this period" icon={Activity} color="#3b82f6" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ fontWeight: 700, color: '#22c55e', fontSize: '0.85rem', marginBottom: '12px' }}>💰 Top Depositors</p>
                  <MiniTable headers={['User', 'Txns', 'Total']} rows={users.top_depositors.map(r => [r.name, r.tx_count, fmt(r.total)])} emptyText="No deposits in period" />
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.85rem', marginBottom: '12px' }}>🏧 Top Withdrawers</p>
                  <MiniTable headers={['User', 'Txns', 'Total']} rows={users.top_withdrawers.map(r => [r.name, r.tx_count, fmt(r.total)])} emptyText="No withdrawals in period" />
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.85rem', marginBottom: '12px' }}>✈️ Top Aviator Players</p>
                  <MiniTable headers={['User', 'Bets', 'Wagered', 'Won']} rows={users.top_aviator_players.map(r => [r.name, r.bets, fmtShort(r.wagered), fmtShort(r.won)])} emptyText="No bets in period" />
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(236,72,153,0.15)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ fontWeight: 700, color: '#ec4899', fontSize: '0.85rem', marginBottom: '12px' }}>🎨 Top CT Players</p>
                  <MiniTable headers={['User', 'Bets', 'Wagered']} rows={users.top_ct_players.map(r => [r.name, r.bets, fmtShort(r.wagered)])} emptyText="No bets in period" />
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ fontWeight: 700, color: '#10b981', fontSize: '0.85rem', marginBottom: '12px' }}>🍉 Top Fruit Slasher Players</p>
                  <MiniTable headers={['User', 'Bets', 'Wagered']} rows={users.top_fruit_players.map(r => [r.name, r.bets, fmtShort(r.wagered)])} emptyText="No bets in period" />
                </div>
              </div>
            </div>
          ) : <div style={{ padding: '20px', color: 'rgba(156,163,175,0.5)', textAlign: 'center' }}>Failed to load user data.</div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 5 — TRANSACTION LEDGER & ALERTS
      ════════════════════════════════════════════════════════════════════════*/}
      <div>
        <SectionHeader icon={Activity}
          title={`Transaction Ledger Monitor${txData?.large_transaction_alerts?.length ? '' : ''}`}
          color="#f97316"
          collapsed={!!collapsed.tx} onToggle={() => toggleSection('tx')} />
        {!collapsed.tx && (
          loadingTx ? <LoadingSection /> : txData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Totals banner */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <KpiCard label="Total Transactions" value={txData.totals.count.toLocaleString()} sub="All types in period" icon={Activity} color="#f97316" />
                <KpiCard label="Total Volume" value={fmtShort(txData.totals.volume)} sub="Gross amount moved" icon={DollarSign} color="#fb923c" />
              </div>

              {/* Large transaction alerts */}
              {txData.large_transaction_alerts.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ fontWeight: 700, color: '#f87171', fontSize: '0.85rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} /> Large Transaction Alerts (≥ ₹10,000)
                    <AlertBadge count={txData.large_transaction_alerts.length} color="#ef4444" />
                  </p>
                  <MiniTable
                    headers={['User', 'Type', 'Amount', 'Description', 'Date']}
                    rows={txData.large_transaction_alerts.map(r => [
                      r.user_name,
                      <span key={r.id} style={{ background: `${(TX_LABELS[r.type]?.color || '#6b7280')}22`, color: TX_LABELS[r.type]?.color || '#9ca3af', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>{TX_LABELS[r.type]?.label || r.type}</span>,
                      <span key="amt" style={{ color: '#f87171', fontWeight: 700 }}>{fmt(r.amount)}</span>,
                      r.description?.slice(0, 30) + (r.description?.length > 30 ? '…' : ''),
                      new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                    ])}
                  />
                </div>
              )}

              {/* By Type Breakdown */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px' }}>
                <p style={{ fontWeight: 700, color: '#f97316', fontSize: '0.85rem', marginBottom: '12px' }}>📊 Breakdown by Transaction Type</p>
                <MiniTable
                  headers={['Type', 'Count', 'Total Amount', 'Avg', 'Max']}
                  rows={txData.by_type.map(r => [
                    <span key={r.type} style={{ background: `${(TX_LABELS[r.type]?.color || '#6b7280')}22`, color: TX_LABELS[r.type]?.color || '#9ca3af', borderRadius: '6px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600 }}>{TX_LABELS[r.type]?.label || r.type}</span>,
                    r.count.toLocaleString(),
                    fmt(r.total_amount),
                    fmt(r.avg_amount),
                    fmt(r.max_amount),
                  ])}
                  emptyText="No transactions in this period"
                />
              </div>
            </div>
          ) : <div style={{ padding: '20px', color: 'rgba(156,163,175,0.5)', textAlign: 'center' }}>Failed to load transaction data.</div>
        )}
      </div>

      <style>{`
        /* Minimalist Light Mode Enhancements */
        .admin-analytics-wrapper {
          font-family: 'Inter', system-ui, sans-serif;
          z-index: 1;
          color: #111827;
        }
        
        .bg-glow-orb {
          display: none;
        }

        /* Header Elements */
        .dashboard-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e5e7eb;
        }
        .header-title-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .header-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .header-title {
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 1.5rem;
          color: #111827;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .header-subtitle {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
          font-size: 0.75rem;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }
        .live-indicator {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          animation: pulse 2s infinite;
        }
        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 8px 16px;
          color: #374151;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.85rem;
          transition: all 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .refresh-btn:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        /* Period Selector */
        .premium-period-selector {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 12px 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .period-tabs-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .period-label {
          font-size: 0.8rem;
          color: #4b5563;
          font-weight: 600;
          margin-right: 8px;
        }
        .period-tabs {
          display: flex;
          gap: 4px;
          background: #f3f4f6;
          padding: 4px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }
        .period-btn {
          padding: 6px 14px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          transition: all 0.2s;
          background: transparent;
          color: #6b7280;
        }
        .period-btn:hover:not(.active) {
          color: #111827;
        }
        .period-btn.active {
          background: #ffffff;
          color: #111827;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .custom-date-inputs {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: 12px;
        }
        .date-input {
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 6px 10px;
          color: #111827;
          font-size: 0.8rem;
          font-family: 'Inter', sans-serif;
          outline: none;
        }
        .date-sep {
          color: #9ca3af;
        }

        /* KPI Cards */
        .premium-kpi-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          position: relative;
          transition: border-color 0.2s, box-shadow 0.2s;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .premium-kpi-card:hover {
          border-color: #d1d5db;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        .kpi-icon-bg {
          display: none;
        }
        .kpi-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .kpi-label {
          font-size: 0.75rem;
          color: #4b5563;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .kpi-trend {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .trend-up { color: #059669; }
        .trend-down { color: #dc2626; }
        .kpi-value {
          font-size: 1.5rem;
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          line-height: 1.2;
          color: #111827 !important;
        }
        .kpi-sub {
          font-size: 0.75rem;
          color: #6b7280;
          font-weight: 500;
        }

        /* Section Headers */
        .premium-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .premium-section-header:hover {
          background: #f3f4f6;
        }
        .sec-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sec-icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sec-icon-container svg {
          color: #4b5563 !important;
        }
        .sec-title {
          font-weight: 600;
          font-size: 1rem;
          color: #111827 !important;
        }
        .sec-header-right {
          color: #6b7280;
        }
        .sec-header-right svg {
          color: #6b7280 !important;
        }

        /* Alerts */
        .alerts-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 16px;
        }
        .premium-alert {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          border: 1px solid #e5e7eb;
        }
        .alert-warning {
          border-left: 4px solid #f59e0b;
        }
        .alert-danger {
          border-left: 4px solid #ef4444;
        }
        .alert-icon-box {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .alert-warning .alert-icon-box { color: #d97706; }
        .alert-danger .alert-icon-box { color: #dc2626; }
        .alert-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .alert-title {
          font-weight: 600;
          font-size: 0.85rem;
          color: #111827;
        }
        .alert-desc {
          font-size: 0.75rem;
          color: #4b5563;
        }

        /* Snapshot Card */
        .premium-snapshot-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .snapshot-header {
          margin-bottom: 16px;
        }
        .snapshot-glow {
          display: none;
        }
        .snapshot-title {
          font-size: 0.75rem;
          color: #4b5563;
          font-weight: 600;
          text-transform: uppercase;
        }
        .snapshot-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        .snapshot-item {
          background: #f9fafb;
          border-radius: 8px;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-left: 3px solid #d1d5db;
        }
        .snapshot-item-label {
          font-size: 0.7rem;
          color: #4b5563;
          margin-bottom: 4px;
          font-weight: 600;
        }
        .snapshot-item-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: #111827;
        }

        /* Game Block */
        .premium-game-block {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .game-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 12px;
          border-bottom: 1px solid #f3f4f6;
        }
        .game-title-container {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .game-emoji-icon {
          font-size: 1.25rem;
        }
        .game-title {
          font-weight: 600;
          font-size: 1rem;
          color: #111827 !important;
        }
        .game-profit-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .profit-up { color: #059669; }
        .profit-down { color: #dc2626; }
        .game-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .game-stat-box {
          padding: 8px 0;
        }
        .stat-label {
          font-size: 0.7rem;
          color: #4b5563;
          margin-bottom: 4px;
          font-weight: 500;
        }
        .stat-value {
          font-size: 0.95rem;
          font-weight: 600;
          color: #111827;
        }
        .game-extra-content {
          margin-top: 8px;
          padding-top: 12px;
          border-top: 1px solid #f3f4f6;
        }

        /* Revenue Banner */
        .premium-revenue-banner {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 20px;
        }
        .revenue-banner-bg { display: none; }
        .revenue-banner-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .revenue-label-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .revenue-icon {
          color: #475569;
        }
        .revenue-icon svg {
          color: #475569 !important;
        }
        .revenue-label {
          color: #0f172a;
          font-weight: 600;
          font-size: 1rem;
        }
        .revenue-value-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .revenue-value {
          font-weight: 700;
          font-size: 1.25rem;
        }
        .revenue-value.positive { color: #059669; }
        .revenue-value.negative { color: #dc2626; }
        .revenue-sub {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 500;
        }

        /* Mini Tables */
        .premium-table-container {
          background: #ffffff;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          overflow-x: auto;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .premium-mini-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
        }
        .premium-mini-table th {
          background: #f9fafb;
          padding: 10px 12px;
          text-align: left;
          color: #4b5563;
          font-weight: 600;
          border-bottom: 1px solid #e5e7eb;
          white-space: nowrap;
        }
        .premium-mini-table td {
          padding: 10px 12px;
          color: #1f2937;
          border-bottom: 1px solid #f3f4f6;
          white-space: nowrap;
        }
        .premium-mini-table tr:hover td {
          background: #f9fafb;
        }
        .premium-mini-table .empty-row {
          padding: 24px 12px;
          text-align: center;
          color: #9ca3af;
        }

        /* Utils */
        .premium-alert-badge {
          background: #f3f4f6;
          color: #111827;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 0.7rem;
          font-weight: 600;
          border: 1px solid #e5e7eb;
        }

        .premium-loading-section {
          padding: 40px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #4b5563;
          font-size: 0.85rem;
          font-weight: 500;
        }
        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
