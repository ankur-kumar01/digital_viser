const crypto = require('crypto');
const { pool } = require('../db');

class AviatorGameLogic {
  constructor(io) {
    this.io = io;
    this.state = 'WAITING'; // WAITING, FLYING, CRASHED
    this.roundId = null;
    this.startTime = null;
    this.crashPoint = 1.0;
    this.serverSeed = null;
    this.clientSeed = null;
    this.hash = null;
    
    this.WAIT_TIME = 8000; // 8 seconds wait time
    this.timer = null;
    
    this.activeBets = new Map(); // userId -> { betAmount, id }

    this.initLoop();
  }

  async getHouseEdge() {
    try {
      const [rows] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'aviator_house_edge'");
      if (rows.length > 0 && !isNaN(parseFloat(rows[0].setting_value))) {
        return parseFloat(rows[0].setting_value);
      }
    } catch (err) {
      console.error('Error fetching house edge, defaulting to 3%', err);
    }
    return 3; // Default 3%
  }

  async generateRound() {
    this.serverSeed = crypto.randomBytes(16).toString('hex');
    this.clientSeed = crypto.randomBytes(16).toString('hex'); // In a full implementation, this could be the first player's seed or a public block hash

    const hash = crypto.createHmac('sha256', this.serverSeed).update(this.clientSeed).digest('hex');
    this.hash = hash;

    // Convert hex to integer
    const h = parseInt(hash.slice(0, 13), 16);
    const e = Math.pow(2, 52);

    const houseEdge = await this.getHouseEdge();
    const rtp = 100 - houseEdge;

    let result = Math.floor((rtp * e - h) / (e - h)) / 100;
    result = Math.max(1.00, result);
    
    // Cap at a reasonable max to prevent infinite flights
    this.crashPoint = Math.min(result, 10000.00);

    // Save round to DB
    try {
      const [res] = await pool.query(
        `INSERT INTO aviator_rounds (server_seed, client_seed, hash, crash_point, status) VALUES (?, ?, ?, ?, 'pending')`,
        [this.serverSeed, this.clientSeed, this.hash, this.crashPoint]
      );
      this.roundId = res.insertId;
    } catch (err) {
      console.error('Failed to create aviator round:', err);
    }
  }

  async startWaitPhase() {
    this.state = 'WAITING';
    this.activeBets.clear();
    await this.generateRound();

    // Broadcast waiting state
    this.io.emit('aviator_state', {
      state: 'WAITING',
      timeLeft: this.WAIT_TIME,
      roundId: this.roundId,
      hash: this.hash // Prove fairness before round starts
    });

    let timeLeft = this.WAIT_TIME;
    this.timer = setInterval(() => {
      timeLeft -= 1000;
      if (timeLeft <= 0) {
        clearInterval(this.timer);
        this.startFlightPhase();
      } else {
        this.io.emit('aviator_timer', { timeLeft });
      }
    }, 1000);
  }

  async startFlightPhase() {
    this.state = 'FLYING';
    this.startTime = Date.now();

    try {
      await pool.query('UPDATE aviator_rounds SET status = ?, start_time = ? WHERE id = ?', ['active', this.startTime, this.roundId]);
    } catch(err) {}

    this.io.emit('aviator_state', {
      state: 'FLYING',
      startTime: this.startTime,
      roundId: this.roundId
    });

    // Determine exact ms when crash will occur
    // Math.exp(0.2 * t) = crashPoint => 0.2 * t = Math.log(crashPoint) => t = Math.log(crashPoint) / 0.2
    const flightDurationSeconds = Math.log(this.crashPoint) / 0.2;
    const flightDurationMs = flightDurationSeconds * 1000;

    this.timer = setTimeout(() => {
      this.startCrashPhase();
    }, flightDurationMs);
  }

  async startCrashPhase() {
    this.state = 'CRASHED';

    try {
      await pool.query('UPDATE aviator_rounds SET status = ? WHERE id = ?', ['crashed', this.roundId]);
      
      // Mark all remaining active bets as lost
      if (this.roundId) {
        await pool.query('UPDATE aviator_bets SET status = ? WHERE round_id = ? AND status = ?', ['lost', this.roundId, 'active']);
      }
    } catch (err) {
      console.error('Error updating crashed state:', err);
    }

    this.io.emit('aviator_state', {
      state: 'CRASHED',
      crashPoint: this.crashPoint,
      roundId: this.roundId,
      serverSeed: this.serverSeed,
      clientSeed: this.clientSeed
    });

    // Wait a few seconds before starting next round
    setTimeout(() => {
      this.startWaitPhase();
    }, 4000);
  }

  initLoop() {
    this.startWaitPhase();
  }

  async handleBet(userId, amount) {
    if (this.state !== 'WAITING') {
      throw new Error('Game is already in progress');
    }
    if (!this.roundId) {
      throw new Error('Round not initialized');
    }

    if (this.activeBets.has(userId)) {
      throw new Error('Bet already placed for this round');
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [userRows] = await conn.query('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
      if (userRows.length === 0) throw new Error('User not found');
      const balance = parseFloat(userRows[0].balance);

      if (balance < amount) throw new Error('Insufficient balance');

      await conn.query('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, userId]);
      await conn.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)', [userId, 'game_bet', -amount, 'Aviator Bet']);

      const [betRes] = await conn.query(
        'INSERT INTO aviator_bets (round_id, user_id, bet_amount, status) VALUES (?, ?, ?, ?)',
        [this.roundId, userId, amount, 'active']
      );

      await conn.commit();
      
      this.activeBets.set(userId, { betAmount: amount, id: betRes.insertId });
      return { success: true, newBalance: balance - amount };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async handleCashout(userId) {
    if (this.state !== 'FLYING') {
      throw new Error('Cannot cashout right now');
    }

    const bet = this.activeBets.get(userId);
    if (!bet) {
      throw new Error('No active bet found for this round');
    }

    // Verify current multiplier
    const elapsedSecs = (Date.now() - this.startTime) / 1000;
    const currentMult = Math.exp(0.2 * elapsedSecs);

    if (currentMult >= this.crashPoint) {
      throw new Error('Plane already crashed!'); // Prevent race conditions
    }

    const winAmount = parseFloat((bet.betAmount * currentMult).toFixed(2));

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [winAmount, userId]);
      await conn.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)', [userId, 'game_win', winAmount, 'Aviator Win']);

      await conn.query('UPDATE aviator_bets SET status = ?, cashout_multiplier = ?, win_amount = ? WHERE id = ?', 
        ['cashed_out', currentMult, winAmount, bet.id]
      );

      await conn.commit();

      this.activeBets.delete(userId); // Remove from active bets so they can't cashout twice

      // Fetch new balance to return
      const [rows] = await pool.query('SELECT balance FROM users WHERE id = ?', [userId]);

      return { success: true, newBalance: parseFloat(rows[0].balance), multiplier: currentMult, winAmount };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = AviatorGameLogic;
