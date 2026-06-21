const { pool } = require('../db');

class LudoCleanup {
  constructor() {
    this.interval = null;
  }

  start() {
    // Run every 15 minutes
    this.interval = setInterval(() => this.cleanup(), 15 * 60 * 1000);
    console.log('🕹️ Ludo cleanup cron started (every 15min)');
    // Run immediately on start
    setTimeout(() => this.cleanup(), 10000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async cleanup() {
    try {
      // 1. Cancel waiting rooms older than 24 hours
      const [cancelledWaiting] = await pool.query(
        `UPDATE ludo_rooms SET status = 'cancelled' WHERE status = 'waiting' AND created_at < NOW() - INTERVAL 24 HOUR`
      );
      if (cancelledWaiting.affectedRows > 0) {
        console.log(`🧹 Ludo cleanup: Cancelled ${cancelledWaiting.affectedRows} stale waiting rooms`);
      }

      // 2. Refund + cancel waiting rooms older than 12 hours (refund host)
      const [staleWaiting] = await pool.query(
        `SELECT id, host_id, entry_fee FROM ludo_rooms WHERE status = 'waiting' AND created_at < NOW() - INTERVAL 12 HOUR`
      );
      for (const room of staleWaiting) {
        await pool.query('UPDATE users SET balance = balance + ? WHERE id = ?', [room.entry_fee, room.host_id]);
        await pool.query(
          'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, "refund", ?, ?)',
          [room.host_id, room.entry_fee, `Ludo Auto-Refund (Stale Room #${room.id})`]
        );
      }

      // 3. Abandoned playing rooms older than 4 hours — mark as completed
      const [abandonedPlaying] = await pool.query(
        `UPDATE ludo_rooms SET status = 'completed', winner_id = host_id
         WHERE status = 'playing' AND updated_at < NOW() - INTERVAL 4 HOUR AND challenger_id IS NOT NULL`
      );
      if (abandonedPlaying.affectedRows > 0) {
        console.log(`🧹 Ludo cleanup: Resolved ${abandonedPlaying.affectedRows} abandoned playing rooms (host wins)`);
      }

      // 4. Playing rooms with no challenger (shouldn't happen but just in case) — cancel
      const [orphaned] = await pool.query(
        `UPDATE ludo_rooms SET status = 'cancelled'
         WHERE status = 'playing' AND updated_at < NOW() - INTERVAL 4 HOUR AND challenger_id IS NULL`
      );
      if (orphaned.affectedRows > 0) {
        console.log(`🧹 Ludo cleanup: Cancelled ${orphaned.affectedRows} orphaned playing rooms`);
      }

    } catch (err) {
      console.error('❌ Ludo cleanup error:', err);
    }
  }
}

module.exports = LudoCleanup;
