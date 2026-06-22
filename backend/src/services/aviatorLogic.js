const crypto = require('crypto');
const { pool } = require('../db');
const { AVIATOR } = require('../constants');

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
    
    this.WAIT_TIME = AVIATOR.WAIT_DURATION_MS;
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

  async startWaitPhase(retryCount = 0) {
    this.state = 'WAITING';
    this.activeBets.clear();
    await this.generateRound();
    if (!this.roundId) {
      const maxRetries = 10;
      if (retryCount >= maxRetries) {
        console.error(`[Aviator] Failed to generate round after ${maxRetries} attempts. Halting.`);
        return;
      }
      // ISSUE-016 FIX: Exponential backoff instead of flat 5s infinite retry
      const delay = Math.min(5000 * Math.pow(2, retryCount), 60000);
      console.error(`[Aviator] Failed to generate round, retry ${retryCount + 1}/${maxRetries} in ${delay}ms...`);
      setTimeout(() => this.startWaitPhase(retryCount + 1), delay);
      return;
    }

    // Broadcast waiting state
    this.io.emit('aviator_state', {
      state: 'WAITING',
      timeLeft: this.WAIT_TIME,
      roundId: this.roundId,
      hash: this.hash // Prove fairness before round starts
    });
    this.io.emit('aviator_bets_update', []);

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
      serverTime: Date.now(),
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

      const [gameRows] = await conn.query('SELECT min_bet, max_bet FROM games WHERE slug = "aviator"');
      if (gameRows.length > 0) {
        const minBet = parseFloat(gameRows[0].min_bet);
        const maxBet = parseFloat(gameRows[0].max_bet);
        if (amount < minBet) throw new Error(`Minimum bet is ₹${minBet}`);
        if (amount > maxBet) throw new Error(`Maximum bet is ₹${maxBet}`);
      }

      const [userRows] = await conn.query(
        'SELECT balance, gaming_bonus_balance, name, phone_number FROM users WHERE id = ? FOR UPDATE',
        [userId]
      );
      if (userRows.length === 0) throw new Error('User not found');

      const mainBalance = parseFloat(userRows[0].balance);
      const gamingBonus = parseFloat(userRows[0].gaming_bonus_balance || 0);
      const userName = userRows[0].name || 'User';
      const userPhone = userRows[0].phone_number || '';

      // Priority: deduct from gaming_bonus_balance first
      let deductFromBonus = 0;
      let deductFromMain = 0;
      let walletUsed = 'main';

      if (gamingBonus >= amount) {
        // Full amount from gaming bonus
        deductFromBonus = amount;
        walletUsed = 'gaming_bonus';
      } else {
        // No gaming bonus (or insufficient) → full from main
        deductFromMain = amount;
        walletUsed = 'main';
        if (mainBalance < amount) throw new Error('Insufficient balance');
      }

      if (deductFromBonus > 0) {
        await conn.query('UPDATE users SET gaming_bonus_balance = gaming_bonus_balance - ? WHERE id = ?', [deductFromBonus, userId]);
        await conn.query(
          'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
          [userId, 'game_bet', -deductFromBonus, 'Aviator Bet (Gaming Bonus)']
        );
      }
      if (deductFromMain > 0) {
        await conn.query('UPDATE users SET balance = balance - ? WHERE id = ?', [deductFromMain, userId]);
        await conn.query(
          'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
          [userId, 'game_bet', -deductFromMain, 'Aviator Bet']
        );
      }

      const [betRes] = await conn.query(
        'INSERT INTO aviator_bets (round_id, user_id, bet_amount, status) VALUES (?, ?, ?, ?)',
        [this.roundId, userId, amount, 'active']
      );

      await conn.commit();

      // FIX BUG-006: Query actual DB balance so the response is always accurate
      // regardless of which wallet (main or bonus) was deducted from
      const [freshUser] = await pool.query('SELECT balance, gaming_bonus_balance FROM users WHERE id = ?', [userId]);
      const freshBalance = freshUser.length > 0 ? parseFloat(freshUser[0].balance) : 0;
      const freshBonus = freshUser.length > 0 ? parseFloat(freshUser[0].gaming_bonus_balance || 0) : 0;

      this.activeBets.set(userId, { 
        id: betRes.insertId, 
        userId,
        name: userName,
        phone_number: userPhone,
        betAmount: amount, 
        cashedOut: false,
        multiplier: null,
        winAmount: 0,
        walletUsed 
      });

      this.io.emit('aviator_bets_update', Array.from(this.activeBets.values()).map(b => ({
        id: b.id,
        userId: b.userId,
        name: b.name,
        phone_number: b.phone_number,
        bet: b.betAmount,
        cashedOut: b.cashedOut,
        targetMult: b.multiplier,
        winAmount: b.winAmount
      })));

      return { success: true, newBalance: freshBalance, gamingBonusBalance: freshBonus, walletUsed };
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
    if (bet.cashedOut) {
      throw new Error('Already cashed out!');
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

      // Winnings ALWAYS go to main balance (even if bet was from gaming bonus)
      await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [winAmount, userId]);
      const winDesc = bet.walletUsed === 'gaming_bonus'
        ? `Aviator Win (Gaming Bonus Bet → Main Wallet)`
        : 'Aviator Win';
      await conn.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [userId, 'game_win', winAmount, winDesc]
      );

      await conn.query(
        'UPDATE aviator_bets SET status = ?, cashout_multiplier = ?, win_amount = ? WHERE id = ?',
        ['cashed_out', currentMult, winAmount, bet.id]
      );

      await conn.commit();

      bet.cashedOut = true;
      bet.multiplier = currentMult;
      bet.winAmount = winAmount;

      const [rows] = await pool.query('SELECT balance, gaming_bonus_balance FROM users WHERE id = ?', [userId]);

      this.io.emit('aviator_bets_update', Array.from(this.activeBets.values()).map(b => ({
        id: b.id,
        userId: b.userId,
        name: b.name,
        phone_number: b.phone_number,
        bet: b.betAmount,
        cashedOut: b.cashedOut,
        targetMult: b.multiplier,
        winAmount: b.winAmount
      })));

      return {
        success: true,
        newBalance: parseFloat(rows[0].balance),
        gamingBonusBalance: parseFloat(rows[0].gaming_bonus_balance || 0),
        multiplier: currentMult,
        winAmount,
        walletUsed: bet.walletUsed
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = AviatorGameLogic;
