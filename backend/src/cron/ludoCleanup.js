const { pool } = require('../db');
const { finalizeTournament } = require('../routes/adminLudo');
const { logger } = require('../utils');

class LudoCleanup {
  constructor() {
    this.interval = null;
    this.tournamentInterval = null;
  }

  start() {
    // Run every 15 minutes
    this.interval = setInterval(() => this.cleanup(), 15 * 60 * 1000);
    console.log('🕹️ Ludo cleanup cron started (every 15min)');
    // Run immediately on start
    setTimeout(() => this.cleanup(), 10000);

    // Tournament check every 5 minutes
    this.tournamentInterval = setInterval(() => this.processTournaments(), 5 * 60 * 1000);
    setTimeout(() => this.processTournaments(), 5000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.tournamentInterval) {
      clearInterval(this.tournamentInterval);
      this.tournamentInterval = null;
    }
  }

  async cleanup() {
    try {
      // ISSUE-012 FIX: Refund FIRST, then cancel. Old code cancelled before refunding.

      // 1. Refund + cancel waiting rooms older than 12 hours (refund host before cancelling)
      const [staleWaiting] = await pool.query(
        `SELECT id, host_id, entry_fee, host_wallet_used FROM ludo_rooms WHERE status = 'waiting' AND created_at < NOW() - INTERVAL 12 HOUR`
      );
      for (const room of staleWaiting) {
        const hostWallet = room.host_wallet_used || 'balance';
        const safeWallet = ['balance', 'gaming_bonus_balance'].includes(hostWallet) ? hostWallet : 'balance';
        await pool.query(`UPDATE users SET ${safeWallet} = ${safeWallet} + ? WHERE id = ?`, [room.entry_fee, room.host_id]);
        await pool.query(
          'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, "refund", ?, ?)',
          [room.host_id, room.entry_fee, `Ludo Auto-Refund (Stale Room #${room.id})`]
        );
        await pool.query(`UPDATE ludo_rooms SET status = 'cancelled' WHERE id = ?`, [room.id]);
      }
      if (staleWaiting.length > 0) {
        logger.info(`Ludo cleanup: Refunded and cancelled ${staleWaiting.length} stale waiting rooms`);
      }

      // 2. Abandoned playing rooms older than 4 hours — mark as completed (host wins)
      const [abandonedPlaying] = await pool.query(
        `UPDATE ludo_rooms SET status = 'completed', winner_id = host_id
         WHERE status = 'playing' AND updated_at < NOW() - INTERVAL 4 HOUR AND challenger_id IS NOT NULL`
      );
      if (abandonedPlaying.affectedRows > 0) {
        logger.info(`Ludo cleanup: Resolved ${abandonedPlaying.affectedRows} abandoned playing rooms (host wins)`);
      }

      // 3. Playing rooms with no challenger — cancel
      const [orphaned] = await pool.query(
        `UPDATE ludo_rooms SET status = 'cancelled'
         WHERE status = 'playing' AND updated_at < NOW() - INTERVAL 4 HOUR AND challenger_id IS NULL`
      );
      if (orphaned.affectedRows > 0) {
        logger.info(`Ludo cleanup: Cancelled ${orphaned.affectedRows} orphaned playing rooms`);
      }

    } catch (err) {
      logger.error('Ludo cleanup error', { error: err.message, stack: err.stack });
    }
  }

  async processTournaments() {
    try {
      // Auto-activate tournaments that have reached start_time
      const [toActivate] = await pool.query(
        `UPDATE ludo_tournaments SET status = 'active' WHERE status = 'upcoming' AND start_time <= NOW()`
      );
      if (toActivate.affectedRows > 0) {
        logger.info(`Activated ${toActivate.affectedRows} tournaments`);
      }

      // Finalize tournaments that have reached end_time
      const [toFinalize] = await pool.query(
        `SELECT id FROM ludo_tournaments WHERE status = 'active' AND end_time <= NOW()`
      );
      for (const t of toFinalize) {
        try {
          await finalizeTournament(t.id, pool);
          logger.info(`Finalized tournament #${t.id}`);
        } catch (err) {
          logger.error(`Failed to finalize tournament #${t.id}`, { error: err.message });
        }
      }
    } catch (err) {
      logger.error('Tournament processing error', { error: err.message, stack: err.stack });
    }
  }
}

module.exports = LudoCleanup;
