const { pool } = require('../db');

class ColourTradingLogic {
  constructor(io) {
    this.io = io;
    this.state = 'BETTING'; // BETTING, PROCESSING, RESULT
    this.roundId = null;
    this.periodNumber = null;
    this.timeLeft = 30; // Total round time
    this.BETTING_TIME = 25;
    this.PROCESSING_TIME = 5;
    
    this.timer = null;
    this.history = []; // Keep track of last 10-15 results for new connections

    this.initLoop();
  }

  async getHouseEdge() {
    try {
      const [rows] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'colour_trading_house_edge'");
      if (rows.length > 0 && !isNaN(parseFloat(rows[0].setting_value))) {
        return parseFloat(rows[0].setting_value);
      }
    } catch (err) {
      console.error('Error fetching CT house edge, defaulting to 30%', err);
    }
    return 30; // Default 30%
  }

  async fetchHistory() {
    try {
      const [rows] = await pool.query('SELECT period_number as period, result_color as color FROM ct_rounds WHERE status = "completed" ORDER BY id DESC LIMIT 15');
      this.history = rows.reverse();
    } catch (err) {
      console.error('Failed to fetch CT history:', err);
    }
  }

  async startBettingPhase() {
    this.state = 'BETTING';
    this.timeLeft = this.BETTING_TIME;
    
    // Generate new period number (e.g. YYYYMMDD0001)
    const now = new Date();
    const dateStr = now.toISOString().slice(0,10).replace(/-/g, '');
    
    try {
      const [lastRound] = await pool.query('SELECT period_number FROM ct_rounds ORDER BY id DESC LIMIT 1');
      let nextPeriod = parseInt(dateStr + '0001');
      if (lastRound.length > 0) {
        const lastPeriodStr = lastRound[0].period_number.toString();
        if (lastPeriodStr.startsWith(dateStr)) {
          nextPeriod = parseInt(lastPeriodStr) + 1;
        }
      }
      this.periodNumber = nextPeriod;

      const [res] = await pool.query(
        'INSERT INTO ct_rounds (period_number, status) VALUES (?, "betting")',
        [this.periodNumber]
      );
      this.roundId = res.insertId;
    } catch (err) {
      console.error('Failed to create CT round:', err);
    }

    await this.fetchHistory();

    this.broadcastState();

    this.timer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        this.startProcessingPhase();
      } else {
        this.io.emit('ct_timer', { timeLeft: this.timeLeft });
      }
    }, 1000);
  }

  async startProcessingPhase() {
    this.state = 'PROCESSING';
    this.timeLeft = this.PROCESSING_TIME;
    
    try {
      await pool.query('UPDATE ct_rounds SET status = "processing" WHERE id = ?', [this.roundId]);
    } catch (err) {}

    this.broadcastState();

    // Calculate result
    await this.calculateResult();

    this.timer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        this.startBettingPhase(); // Loop back to betting
      } else {
        this.io.emit('ct_timer', { timeLeft: this.timeLeft });
      }
    }, 1000);
  }

  async calculateResult() {
    try {
      // 1. Get all bets for this round
      const [bets] = await pool.query('SELECT color, SUM(bet_amount) as total FROM ct_bets WHERE round_id = ? GROUP BY color', [this.roundId]);
      
      let liability = { red: 0, green: 0, violet: 0 };
      
      // Calculate liability (payouts: Red 2x, Green 2x, Violet 3x)
      bets.forEach(b => {
        if (b.color === 'red') liability.red = parseFloat(b.total) * 2;
        if (b.color === 'green') liability.green = parseFloat(b.total) * 2;
        if (b.color === 'violet') liability.violet = parseFloat(b.total) * 3;
      });

      // Find color with minimum liability
      const colors = ['red', 'green', 'violet'];
      let minLiabilityColor = 'red';
      let minVal = Infinity;
      colors.forEach(c => {
        if (liability[c] < minVal) {
          minVal = liability[c];
          minLiabilityColor = c;
        }
      });

      // If no bets placed, minVal is 0 and it picks 'red'. Let's pick randomly if all 0.
      if (liability.red === 0 && liability.green === 0 && liability.violet === 0) {
        const r = Math.random();
        if (r < 0.45) minLiabilityColor = 'red';
        else if (r < 0.90) minLiabilityColor = 'green';
        else minLiabilityColor = 'violet';
      }

      // 2. Determine if we use liability algorithm based on house edge
      const houseEdgePercent = await this.getHouseEdge();
      let finalColor = 'red';
      
      const roll = Math.random() * 100;
      if (roll < houseEdgePercent) {
        // Force House Win (Minimum Liability)
        finalColor = minLiabilityColor;
      } else {
        // Random (Natural Probability: Red 45%, Green 45%, Violet 10%)
        const r2 = Math.random();
        if (r2 < 0.45) finalColor = 'red';
        else if (r2 < 0.90) finalColor = 'green';
        else finalColor = 'violet';
      }

      // 3. Update Round
      await pool.query('UPDATE ct_rounds SET result_color = ?, status = "completed" WHERE id = ?', [finalColor, this.roundId]);

      // 4. Resolve Bets
      const [activeBets] = await pool.query('SELECT * FROM ct_bets WHERE round_id = ? AND status = "active"', [this.roundId]);
      
      for (const bet of activeBets) {
        if (bet.color === finalColor) {
          // Win
          const mult = finalColor === 'violet' ? 3 : 2;
          const winAmount = parseFloat(bet.bet_amount) * mult;
          
          await pool.query('UPDATE users SET balance = balance + ? WHERE id = ?', [winAmount, bet.user_id]);
          await pool.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)', [bet.user_id, 'game_win', winAmount, `Colour Trading Win (${finalColor})`]);
          await pool.query('UPDATE ct_bets SET status = "won", win_amount = ? WHERE id = ?', [winAmount, bet.id]);

          // Notify specific user of their win via socket if possible, or frontend will just refresh balance
        } else {
          // Lose
          await pool.query('UPDATE ct_bets SET status = "lost", win_amount = 0 WHERE id = ?', [bet.id]);
        }
      }

      // Add to history and emit result
      this.history.push({ period: this.periodNumber, color: finalColor });
      if (this.history.length > 15) this.history.shift();

      this.io.emit('ct_result', {
        periodNumber: this.periodNumber,
        resultColor: finalColor,
        history: this.history
      });

    } catch (err) {
      console.error('Error calculating CT result:', err);
    }
  }

  broadcastState() {
    this.io.emit('ct_state', {
      state: this.state,
      timeLeft: this.timeLeft,
      periodNumber: this.periodNumber,
      history: this.history
    });
  }

  initLoop() {
    this.startBettingPhase();
  }

  async handleBet(userId, amount, color) {
    if (this.state !== 'BETTING') {
      throw new Error('Betting is closed for this period');
    }
    if (!this.roundId) {
      throw new Error('Round not initialized');
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [userRows] = await conn.query('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
      if (userRows.length === 0) throw new Error('User not found');
      const balance = parseFloat(userRows[0].balance);

      if (balance < amount) throw new Error('Insufficient balance');

      await conn.query('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, userId]);
      await conn.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)', [userId, 'game_bet', -amount, `Colour Trading Bet (${color})`]);

      const [betRes] = await conn.query(
        'INSERT INTO ct_bets (round_id, user_id, color, bet_amount, status) VALUES (?, ?, ?, ?, "active")',
        [this.roundId, userId, color, amount]
      );

      await conn.commit();
      
      return { success: true, newBalance: balance - amount, betId: betRes.insertId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = ColourTradingLogic;
