const express = require('express');
const { pool } = require('../db');
const jwt = require('jsonwebtoken');

const router = express.Router();
const JWT_SECRET = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET;

// ─── Admin Auth Middleware ────────────────────────────────────────────────────
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
router.use(adminAuth);

// ─── Date Range Helper ────────────────────────────────────────────────────────
function getDateRange(req) {
  const { period, from, to } = req.query;
  const now = new Date();

  if (from && to) {
    return {
      start: from + ' 00:00:00',
      end:   to   + ' 23:59:59',
      label: `${from} to ${to}`,
      isCustom: true,
    };
  }

  const hoursMap = { '24h': 24, '2d': 48, '7d': 168, '30d': 720 };
  const h = hoursMap[period] || 168;
  const start = new Date(now.getTime() - h * 3600000);

  const fmt = (d) => d.toISOString().replace('T', ' ').slice(0, 19);
  return { start: fmt(start), end: fmt(now), label: period || '7d', isCustom: false };
}

const n = (v) => parseFloat(v || 0);
const i = (v) => parseInt(v  || 0, 10);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/analytics/overview
// Financial KPIs: deposits, withdrawals, net flow, interest, FDR corpus, users
// ─────────────────────────────────────────────────────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const { start, end } = getDateRange(req);
    const dp = [start, end];

    const [[dep], [wit], [interest], [fdrMat], [refComm], [bonusUnlocked], [newUsers],
           [fdrCorpus], [platformTotals], [pendingDep], [pendingWit]] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) tc, COALESCE(SUM(amount),0) ta,
                COALESCE(SUM(CASE WHEN status='approved' THEN amount END),0) aa, COUNT(CASE WHEN status='approved' THEN 1 END) ac,
                COALESCE(SUM(CASE WHEN status='pending'  THEN amount END),0) pa, COUNT(CASE WHEN status='pending'  THEN 1 END) pc,
                COALESCE(SUM(CASE WHEN status='rejected' THEN amount END),0) ra, COUNT(CASE WHEN status='rejected' THEN 1 END) rc
         FROM deposits WHERE created_at BETWEEN ? AND ?`, dp),
      pool.query(
        `SELECT COUNT(*) tc, COALESCE(SUM(amount),0) ta,
                COALESCE(SUM(CASE WHEN status='approved' THEN amount END),0) aa, COUNT(CASE WHEN status='approved' THEN 1 END) ac,
                COALESCE(SUM(CASE WHEN status='pending'  THEN amount END),0) pa, COUNT(CASE WHEN status='pending'  THEN 1 END) pc,
                COALESCE(SUM(CASE WHEN status='rejected' THEN amount END),0) ra, COUNT(CASE WHEN status='rejected' THEN 1 END) rc
         FROM withdrawals WHERE created_at BETWEEN ? AND ?`, dp),
      pool.query(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM transactions WHERE type='interest' AND created_at BETWEEN ? AND ?`, dp),
      pool.query(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM transactions WHERE type='fdr_maturity' AND created_at BETWEEN ? AND ?`, dp),
      pool.query(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM transactions WHERE type='fdr_referral_commission' AND created_at BETWEEN ? AND ?`, dp),
      pool.query(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM transactions WHERE type IN ('bonus_unlocked','funds_unlocked_auto') AND created_at BETWEEN ? AND ?`, dp),
      pool.query(`SELECT COUNT(*) c FROM users WHERE created_at BETWEEN ? AND ?`, dp),
      pool.query(`SELECT COUNT(*) ac, COALESCE(SUM(amount),0) corpus, COALESCE(SUM(accrued_interest),0) accrued FROM fdrs WHERE status='active'`),
      pool.query(`SELECT COUNT(*) total_users, COALESCE(SUM(balance),0) tb, COALESCE(SUM(bonus_balance),0) bb, COALESCE(SUM(referral_balance),0) rb, COALESCE(SUM(locked_balance),0) lb FROM users`),
      pool.query(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM deposits WHERE status='pending'`),
      pool.query(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM withdrawals WHERE status='pending'`),
    ]);

    const d = dep[0], w = wit[0];
    res.json({
      period: req.query.period || '7d',
      from: start, to: end,
      deposits: {
        total: { count: i(d.tc), amount: n(d.ta) },
        approved: { count: i(d.ac), amount: n(d.aa) },
        pending:  { count: i(d.pc), amount: n(d.pa) },
        rejected: { count: i(d.rc), amount: n(d.ra) },
      },
      withdrawals: {
        total: { count: i(w.tc), amount: n(w.ta) },
        approved: { count: i(w.ac), amount: n(w.aa) },
        pending:  { count: i(w.pc), amount: n(w.pa) },
        rejected: { count: i(w.rc), amount: n(w.ra) },
      },
      net_flow: n(d.aa) - n(w.aa),
      interest_credited: { count: i(interest[0].c), amount: n(interest[0].s) },
      fdr_maturity_payouts: { count: i(fdrMat[0].c), amount: n(fdrMat[0].s) },
      referral_commissions: { count: i(refComm[0].c), amount: n(refComm[0].s) },
      bonus_unlocked: { count: i(bonusUnlocked[0].c), amount: n(bonusUnlocked[0].s) },
      new_users: i(newUsers[0].c),
      fdr_corpus: { active_count: i(fdrCorpus[0].ac), total_corpus: n(fdrCorpus[0].corpus), total_accrued: n(fdrCorpus[0].accrued) },
      platform_totals: {
        total_users: i(platformTotals[0].total_users),
        total_balance: n(platformTotals[0].tb),
        bonus_balance: n(platformTotals[0].bb),
        referral_balance: n(platformTotals[0].rb),
        locked_balance: n(platformTotals[0].lb),
      },
      action_required: {
        pending_deposits: { count: i(pendingDep[0].c), amount: n(pendingDep[0].s) },
        pending_withdrawals: { count: i(pendingWit[0].c), amount: n(pendingWit[0].s) },
      },
    });
  } catch (err) {
    console.error('[Analytics/overview]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/analytics/games
// Per-game breakdown: bets, wager, wins, losses, house profit
// ─────────────────────────────────────────────────────────────────────────────
router.get('/games', async (req, res) => {
  try {
    const { start, end } = getDateRange(req);
    const dp = [start, end];

    // Fetch ludo house edge from settings
    const [ludoSettings] = await pool.query(
      "SELECT setting_value FROM system_settings WHERE setting_key='ludo_house_edge'"
    );
    const ludoHouseEdgePct = parseFloat(ludoSettings[0]?.setting_value || 5);

    const [
      [aviator], [aviatorTopWin],
      [ct], [ctByColor],
      [fruit],
      [ludo], [ludoCancelled],
      [fantasy]
    ] = await Promise.all([
      // Aviator
      pool.query(
        `SELECT COUNT(*) tc,
                COUNT(CASE WHEN status='cashed_out' THEN 1 END) won_count,
                COUNT(CASE WHEN status='lost' THEN 1 END) lost_count,
                COALESCE(SUM(bet_amount),0) total_wagered,
                COALESCE(SUM(CASE WHEN status='cashed_out' THEN COALESCE(win_amount,0) ELSE 0 END),0) total_paid_out,
                COALESCE(AVG(CASE WHEN status='cashed_out' THEN cashout_multiplier END),0) avg_multiplier,
                COALESCE(MAX(CASE WHEN status='cashed_out' THEN COALESCE(win_amount,0) ELSE 0 END),0) top_win
         FROM aviator_bets WHERE status != 'active' AND created_at BETWEEN ? AND ?`, dp),
      pool.query(
        `SELECT u.name, u.email, SUM(ab.win_amount) total_won 
         FROM aviator_bets ab JOIN users u ON ab.user_id = u.id 
         WHERE ab.status='cashed_out' AND ab.created_at BETWEEN ? AND ?
         GROUP BY ab.user_id ORDER BY total_won DESC LIMIT 5`, dp),
      // Colour Trading
      pool.query(
        `SELECT COUNT(*) tc,
                COUNT(CASE WHEN status='won' THEN 1 END) won_count,
                COUNT(CASE WHEN status='lost' THEN 1 END) lost_count,
                COALESCE(SUM(bet_amount),0) total_wagered,
                COALESCE(SUM(CASE WHEN status='won' THEN COALESCE(win_amount,0) ELSE 0 END),0) total_paid_out
         FROM ct_bets WHERE status != 'active' AND created_at BETWEEN ? AND ?`, dp),
      pool.query(
        `SELECT color,
                COUNT(*) bets, COALESCE(SUM(bet_amount),0) wagered,
                COUNT(CASE WHEN status='won' THEN 1 END) wins,
                COALESCE(SUM(CASE WHEN status='won' THEN COALESCE(win_amount,0) ELSE 0 END),0) paid_out
         FROM ct_bets WHERE status != 'active' AND created_at BETWEEN ? AND ?
         GROUP BY color`, dp),
      // Fruit Slasher
      pool.query(
        `SELECT COUNT(*) tc,
                COUNT(CASE WHEN status='won' THEN 1 END) won_count,
                COUNT(CASE WHEN status='lost' THEN 1 END) lost_count,
                COALESCE(SUM(bet_amount),0) total_wagered,
                COALESCE(SUM(CASE WHEN status='won' THEN COALESCE(win_amount,0) ELSE 0 END),0) total_paid_out,
                COALESCE(AVG(CASE WHEN status='won' THEN multiplier_reached END),0) avg_cashout_multiplier
         FROM fruit_bets WHERE status != 'active' AND created_at BETWEEN ? AND ?`, dp),
      // Ludo
      pool.query(
        `SELECT COUNT(*) tc,
                COUNT(CASE WHEN status='completed' AND challenger_id IS NOT NULL THEN 1 END) completed_matches,
                COALESCE(SUM(CASE WHEN status='completed' AND challenger_id IS NOT NULL THEN entry_fee * 2 ELSE 0 END),0) total_pool,
                COUNT(CASE WHEN status='playing' THEN 1 END) live_now
         FROM ludo_rooms WHERE created_at BETWEEN ? AND ?`, dp),
      pool.query(
        `SELECT COUNT(*) cancelled FROM ludo_rooms WHERE status='cancelled' AND created_at BETWEEN ? AND ?`, dp),
      // Fantasy Cricket
      pool.query(
        `SELECT COUNT(*) tc,
                COALESCE(SUM(fee_paid),0) total_fees,
                COALESCE(SUM(prize_won),0) total_prizes
         FROM fantasy_contest_entries WHERE created_at BETWEEN ? AND ?`, dp),
    ]);

    const av = aviator[0];
    const avTotalWagered = n(av.total_wagered);
    const avPaidOut = n(av.total_paid_out);

    const ctRow = ct[0];
    const ctTotalWagered = n(ctRow.total_wagered);
    const ctPaidOut = n(ctRow.total_paid_out);

    const fr = fruit[0];
    const frTotalWagered = n(fr.total_wagered);
    const frPaidOut = n(fr.total_paid_out);

    const lu = ludo[0];
    const luTotalPool = n(lu.total_pool);
    const luHouseProfit = luTotalPool * (ludoHouseEdgePct / 100);

    const fan = fantasy[0];
    const fanFees = n(fan.total_fees);
    const fanPrizes = n(fan.total_prizes);

    res.json({
      period: req.query.period || '7d',
      from: start, to: end,
      aviator: {
        total_bets: i(av.tc),
        won_count: i(av.won_count),
        lost_count: i(av.lost_count),
        win_rate_pct: av.tc > 0 ? +((i(av.won_count) / i(av.tc)) * 100).toFixed(1) : 0,
        total_wagered: avTotalWagered,
        total_paid_out: avPaidOut,
        house_profit: +(avTotalWagered - avPaidOut).toFixed(2),
        house_margin_pct: avTotalWagered > 0 ? +(((avTotalWagered - avPaidOut) / avTotalWagered) * 100).toFixed(1) : 0,
        avg_cashout_multiplier: +n(av.avg_multiplier).toFixed(2),
        top_single_win: n(av.top_win),
        top_winners: aviatorTopWin,
      },
      colour_trading: {
        total_bets: i(ctRow.tc),
        won_count: i(ctRow.won_count),
        lost_count: i(ctRow.lost_count),
        win_rate_pct: ctRow.tc > 0 ? +((i(ctRow.won_count) / i(ctRow.tc)) * 100).toFixed(1) : 0,
        total_wagered: ctTotalWagered,
        total_paid_out: ctPaidOut,
        house_profit: +(ctTotalWagered - ctPaidOut).toFixed(2),
        house_margin_pct: ctTotalWagered > 0 ? +(((ctTotalWagered - ctPaidOut) / ctTotalWagered) * 100).toFixed(1) : 0,
        by_color: ctByColor.reduce((acc, row) => {
          acc[row.color] = { bets: i(row.bets), wagered: n(row.wagered), wins: i(row.wins), paid_out: n(row.paid_out) };
          return acc;
        }, {}),
      },
      fruit_slasher: {
        total_bets: i(fr.tc),
        won_count: i(fr.won_count),
        lost_count: i(fr.lost_count),
        win_rate_pct: fr.tc > 0 ? +((i(fr.won_count) / i(fr.tc)) * 100).toFixed(1) : 0,
        total_wagered: frTotalWagered,
        total_paid_out: frPaidOut,
        house_profit: +(frTotalWagered - frPaidOut).toFixed(2),
        house_margin_pct: frTotalWagered > 0 ? +(((frTotalWagered - frPaidOut) / frTotalWagered) * 100).toFixed(1) : 0,
        avg_cashout_multiplier: +n(fr.avg_cashout_multiplier).toFixed(2),
      },
      ludo: {
        total_rooms_created: i(lu.tc),
        completed_matches: i(lu.completed_matches),
        cancelled_rooms: i(ludoCancelled[0].cancelled),
        live_now: i(lu.live_now),
        total_pool: luTotalPool,
        house_edge_pct: ludoHouseEdgePct,
        house_profit: +luHouseProfit.toFixed(2),
        prize_distributed: +(luTotalPool - luHouseProfit).toFixed(2),
      },
      cricket_fantasy: {
        total_entries: i(fan.tc),
        total_fees_collected: fanFees,
        total_prizes_distributed: fanPrizes,
        net_revenue: +(fanFees - fanPrizes).toFixed(2),
        avg_fee_per_entry: fan.tc > 0 ? +(fanFees / i(fan.tc)).toFixed(2) : 0,
      },
      // Combined platform game revenue
      total_game_house_profit: +((avTotalWagered - avPaidOut) + (ctTotalWagered - ctPaidOut) + (frTotalWagered - frPaidOut) + luHouseProfit + (fanFees - fanPrizes)).toFixed(2),
    });
  } catch (err) {
    console.error('[Analytics/games]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/analytics/fdrs
// FDR corpus deep analytics: new FDRs, matured, daily interest timeline
// ─────────────────────────────────────────────────────────────────────────────
router.get('/fdrs', async (req, res) => {
  try {
    const { start, end } = getDateRange(req);
    const dp = [start, end];

    const [[newFdrs], [maturedFdrs], [statusBreakdown], dailyInterest, topInvestors, [fdrByPlan]] = await Promise.all([
      pool.query(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM fdrs WHERE created_at BETWEEN ? AND ?`, dp),
      pool.query(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM fdrs WHERE status='completed' AND updated_at BETWEEN ? AND ?`, dp),
      pool.query(
        `SELECT status, COUNT(*) c, COALESCE(SUM(amount),0) corpus, COALESCE(SUM(accrued_interest),0) accrued
         FROM fdrs GROUP BY status`),
      pool.query(
        `SELECT DATE(created_at) day, COALESCE(SUM(amount),0) daily_interest, COUNT(*) tx_count
         FROM transactions WHERE type='interest' AND created_at BETWEEN ? AND ?
         GROUP BY DATE(created_at) ORDER BY day ASC`, dp),
      pool.query(
        `SELECT u.name, u.email,
                COUNT(f.id) fdr_count,
                COALESCE(SUM(f.amount),0) total_invested,
                COALESCE(SUM(f.accrued_interest),0) total_earned
         FROM fdrs f JOIN users u ON f.user_id = u.id
         WHERE f.status='active'
         GROUP BY f.user_id ORDER BY total_invested DESC LIMIT 10`),
      pool.query(
        `SELECT period_days, COUNT(*) c, COALESCE(SUM(amount),0) s, COALESCE(AVG(interest_percent),0) avg_rate
         FROM fdrs WHERE status='active'
         GROUP BY period_days ORDER BY period_days ASC`),
    ]);

    const statusMap = {};
    statusBreakdown.forEach(r => {
      statusMap[r.status] = { count: i(r.c), corpus: n(r.corpus), accrued: n(r.accrued) };
    });

    res.json({
      period: req.query.period || '7d',
      from: start, to: end,
      new_fdrs: { count: i(newFdrs[0].c), amount: n(newFdrs[0].s) },
      matured_fdrs: { count: i(maturedFdrs[0].c), amount: n(maturedFdrs[0].s) },
      status_breakdown: statusMap,
      daily_interest_timeline: dailyInterest.map(r => ({
        day: r.day,
        amount: n(r.daily_interest),
        tx_count: i(r.tx_count),
      })),
      top_investors: topInvestors.map(r => ({
        name: r.name,
        email: r.email,
        fdr_count: i(r.fdr_count),
        total_invested: n(r.total_invested),
        total_earned: n(r.total_earned),
      })),
      active_by_plan: fdrByPlan.map(r => ({
        period_days: i(r.period_days),
        count: i(r.c),
        corpus: n(r.s),
        avg_rate: +n(r.avg_rate).toFixed(2),
      })),
    });
  } catch (err) {
    console.error('[Analytics/fdrs]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/analytics/users
// User metrics: registrations, active logins, top depositors, top players
// ─────────────────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { start, end } = getDateRange(req);
    const dp = [start, end];

    const [[newReg], [activeUsers], topDepositors, topWithdrawers, topAviator, topCt, topFruit] = await Promise.all([
      pool.query(`SELECT COUNT(*) c FROM users WHERE created_at BETWEEN ? AND ?`, dp),
      pool.query(`SELECT COUNT(DISTINCT user_id) c FROM login_history WHERE login_at BETWEEN ? AND ?`, dp),
      pool.query(
        `SELECT u.name, u.email, COUNT(d.id) tx_count, COALESCE(SUM(d.amount),0) total
         FROM deposits d JOIN users u ON d.user_id = u.id
         WHERE d.status='approved' AND d.created_at BETWEEN ? AND ?
         GROUP BY d.user_id ORDER BY total DESC LIMIT 10`, dp),
      pool.query(
        `SELECT u.name, u.email, COUNT(w.id) tx_count, COALESCE(SUM(w.amount),0) total
         FROM withdrawals w JOIN users u ON w.user_id = u.id
         WHERE w.status='approved' AND w.created_at BETWEEN ? AND ?
         GROUP BY w.user_id ORDER BY total DESC LIMIT 10`, dp),
      pool.query(
        `SELECT u.name, COUNT(ab.id) bets, COALESCE(SUM(ab.bet_amount),0) wagered, COALESCE(SUM(CASE WHEN ab.status='cashed_out' THEN ab.win_amount ELSE 0 END),0) won
         FROM aviator_bets ab JOIN users u ON ab.user_id = u.id
         WHERE ab.created_at BETWEEN ? AND ?
         GROUP BY ab.user_id ORDER BY wagered DESC LIMIT 5`, dp),
      pool.query(
        `SELECT u.name, COUNT(cb.id) bets, COALESCE(SUM(cb.bet_amount),0) wagered
         FROM ct_bets cb JOIN users u ON cb.user_id = u.id
         WHERE cb.created_at BETWEEN ? AND ?
         GROUP BY cb.user_id ORDER BY wagered DESC LIMIT 5`, dp),
      pool.query(
        `SELECT u.name, COUNT(fb.id) bets, COALESCE(SUM(fb.bet_amount),0) wagered
         FROM fruit_bets fb JOIN users u ON fb.user_id = u.id
         WHERE fb.created_at BETWEEN ? AND ?
         GROUP BY fb.user_id ORDER BY wagered DESC LIMIT 5`, dp),
    ]);

    res.json({
      period: req.query.period || '7d',
      from: start, to: end,
      new_registrations: i(newReg[0].c),
      active_users: i(activeUsers[0].c),
      top_depositors: topDepositors.map(r => ({ name: r.name, email: r.email, tx_count: i(r.tx_count), total: n(r.total) })),
      top_withdrawers: topWithdrawers.map(r => ({ name: r.name, email: r.email, tx_count: i(r.tx_count), total: n(r.total) })),
      top_aviator_players: topAviator.map(r => ({ name: r.name, bets: i(r.bets), wagered: n(r.wagered), won: n(r.won) })),
      top_ct_players: topCt.map(r => ({ name: r.name, bets: i(r.bets), wagered: n(r.wagered) })),
      top_fruit_players: topFruit.map(r => ({ name: r.name, bets: i(r.bets), wagered: n(r.wagered) })),
    });
  } catch (err) {
    console.error('[Analytics/users]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/analytics/transactions
// Transaction ledger: by type, volume, count, daily timeline, large tx alerts
// ─────────────────────────────────────────────────────────────────────────────
router.get('/transactions', async (req, res) => {
  try {
    const { start, end } = getDateRange(req);
    const dp = [start, end];

    const [byType, dailyTimeline, largeAlerts, [totals]] = await Promise.all([
      pool.query(
        `SELECT type, COUNT(*) c, COALESCE(SUM(amount),0) s, COALESCE(AVG(amount),0) avg_amt,
                COALESCE(MAX(amount),0) max_amt
         FROM transactions WHERE created_at BETWEEN ? AND ?
         GROUP BY type ORDER BY s DESC`, dp),
      pool.query(
        `SELECT DATE(created_at) day, type, COALESCE(SUM(amount),0) daily_total, COUNT(*) tx_count
         FROM transactions WHERE created_at BETWEEN ? AND ?
         GROUP BY DATE(created_at), type ORDER BY day ASC, daily_total DESC`, dp),
      pool.query(
        `SELECT t.id, t.type, t.amount, t.description, t.created_at, u.name, u.email
         FROM transactions t JOIN users u ON t.user_id = u.id
         WHERE t.created_at BETWEEN ? AND ? AND t.amount >= 10000
         ORDER BY t.amount DESC LIMIT 20`, dp),
      pool.query(`SELECT COUNT(*) total_count, COALESCE(SUM(amount),0) total_volume FROM transactions WHERE created_at BETWEEN ? AND ?`, dp),
    ]);

    res.json({
      period: req.query.period || '7d',
      from: start, to: end,
      totals: { count: i(totals.total_count), volume: n(totals.total_volume) },
      by_type: byType.map(r => ({
        type: r.type,
        count: i(r.c),
        total_amount: n(r.s),
        avg_amount: +n(r.avg_amt).toFixed(2),
        max_amount: n(r.max_amt),
      })),
      daily_timeline: dailyTimeline.map(r => ({
        day: r.day,
        type: r.type,
        total: n(r.daily_total),
        count: i(r.tx_count),
      })),
      large_transaction_alerts: largeAlerts.map(r => ({
        id: r.id,
        type: r.type,
        amount: n(r.amount),
        description: r.description,
        user_name: r.name,
        user_email: r.email,
        created_at: r.created_at,
      })),
    });
  } catch (err) {
    console.error('[Analytics/transactions]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
