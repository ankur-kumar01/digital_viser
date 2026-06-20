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
      const [rows] = await pool.query('SELECT period_number as period, result_color as color, result_number as number FROM ct_rounds WHERE status = "completed" ORDER BY id DESC LIMIT 15');
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
      const [bets] = await pool.query('SELECT color, bet_amount FROM ct_bets WHERE round_id = ?', [this.roundId]);
      
      // Calculate liability for each possible winning number 0-9
      const getLiabilityForNumber = (n) => {
        let totalPay = 0;
        bets.forEach(b => {
          const select = b.color; // stored select string: 'red', 'green', 'violet', or '0'-'9'
          const amt = parseFloat(b.bet_amount);
          
          // Number match: 9x payout
          if (select === n.toString()) {
            totalPay += amt * 9;
          }
          // Color matches:
          else if (select === 'red') {
            if ([2, 4, 6, 8].includes(n)) totalPay += amt * 2;
            else if (n === 0) totalPay += amt * 1.5; // Joint Red/Violet
          }
          else if (select === 'green') {
            if ([1, 3, 7, 9].includes(n)) totalPay += amt * 2;
            else if (n === 5) totalPay += amt * 1.5; // Joint Green/Violet
          }
          else if (select === 'violet') {
            if (n === 0 || n === 5) totalPay += amt * 4.5; // Standard Wingo Violet odds
          }
        });
        return totalPay;
      };

      let numberLiabilities = {};
      for (let n = 0; n <= 9; n++) {
        numberLiabilities[n] = getLiabilityForNumber(n);
      }

      // Find number with minimum liability
      let minLiabilityNumber = 0;
      let minVal = Infinity;
      for (let n = 0; n <= 9; n++) {
        if (numberLiabilities[n] < minVal) {
          minVal = numberLiabilities[n];
          minLiabilityNumber = n;
        }
      }

      // If no bets placed, choose a random number 0-9
      const totalBetsCount = bets.reduce((sum, b) => sum + parseFloat(b.bet_amount), 0);
      if (totalBetsCount === 0) {
        minLiabilityNumber = Math.floor(Math.random() * 10);
      }

      // 2. Determine if we use liability algorithm based on house edge
      const houseEdgePercent = await this.getHouseEdge();
      let finalNumber = 0;
      
      const roll = Math.random() * 100;
      if (roll < houseEdgePercent) {
        // Force House Win (Minimum Liability number)
        finalNumber = minLiabilityNumber;
      } else {
        // Random (Natural Probability 0-9 are equal)
        finalNumber = Math.floor(Math.random() * 10);
      }

      // Map winning number to winning color
      let finalColor = 'red';
      if (finalNumber === 0) finalColor = 'violet'; // Red & Violet split
      else if (finalNumber === 5) finalColor = 'violet'; // Green & Violet split
      else if ([1, 3, 7, 9].includes(finalNumber)) finalColor = 'green';
      else if ([2, 4, 6, 8].includes(finalNumber)) finalColor = 'red';

      // 3. Update Round with color and number
      await pool.query(
        'UPDATE ct_rounds SET result_color = ?, result_number = ?, status = "completed" WHERE id = ?',
        [finalColor, finalNumber, this.roundId]
      );

      // 4. Resolve Bets
      const [activeBets] = await pool.query('SELECT * FROM ct_bets WHERE round_id = ? AND status = "active"', [this.roundId]);
      
      for (const bet of activeBets) {
        let isWin = false;
        let mult = 0;
        
        const select = bet.color; // 'red', 'green', 'violet', or '0'-'9'
        const amt = parseFloat(bet.bet_amount);
        
        // Specific number bet
        if (select === finalNumber.toString()) {
          isWin = true;
          mult = 9;
        }
        // Color bets
        else if (select === 'red') {
          if ([2, 4, 6, 8].includes(finalNumber)) {
            isWin = true;
            mult = 2;
          } else if (finalNumber === 0) {
            isWin = true;
            mult = 1.5;
          }
        }
        else if (select === 'green') {
          if ([1, 3, 7, 9].includes(finalNumber)) {
            isWin = true;
            mult = 2;
          } else if (finalNumber === 5) {
            isWin = true;
            mult = 1.5;
          }
        }
        else if (select === 'violet') {
          if (finalNumber === 0 || finalNumber === 5) {
            isWin = true;
            mult = 4.5;
          }
        }
        
        if (isWin) {
          const winAmount = amt * mult;
          await pool.query('UPDATE users SET balance = balance + ? WHERE id = ?', [winAmount, bet.user_id]);
          await pool.query('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)', [
            bet.user_id, 
            'game_win', 
            winAmount, 
            `Colour Trading Win (Choice: ${select}, Result: ${finalNumber} ${finalColor})`
          ]);
          await pool.query('UPDATE ct_bets SET status = "won", win_amount = ? WHERE id = ?', [winAmount, bet.id]);
        } else {
          await pool.query('UPDATE ct_bets SET status = "lost", win_amount = 0 WHERE id = ?', [bet.id]);
        }
      }

      // Add to history and emit result
      this.history.push({ period: this.periodNumber, color: finalColor, number: finalNumber });
      if (this.history.length > 15) this.history.shift();

      this.io.emit('ct_result', {
        periodNumber: this.periodNumber,
        resultColor: finalColor,
        resultNumber: finalNumber,
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

      const [gameRows] = await conn.query('SELECT min_bet, max_bet FROM games WHERE slug = "colour-trading"');
      if (gameRows.length > 0) {
        const minBet = parseFloat(gameRows[0].min_bet);
        const maxBet = parseFloat(gameRows[0].max_bet);
        if (amount < minBet) throw new Error(`Minimum bet is ₹${minBet}`);
        if (amount > maxBet) throw new Error(`Maximum bet is ₹${maxBet}`);
      }

      const [userRows] = await conn.query(
        'SELECT balance, gaming_bonus_balance FROM users WHERE id = ? FOR UPDATE',
        [userId]
      );
      if (userRows.length === 0) throw new Error('User not found');

      const mainBalance = parseFloat(userRows[0].balance);
      const gamingBonus = parseFloat(userRows[0].gaming_bonus_balance || 0);

      // Priority: deduct from gaming_bonus_balance first
      let deductFromBonus = 0;
      let deductFromMain = 0;
      let walletUsed = 'main';

      if (gamingBonus >= amount) {
        deductFromBonus = amount;
        walletUsed = 'gaming_bonus';
      } else {
        deductFromMain = amount;
        walletUsed = 'main';
        if (mainBalance < amount) throw new Error('Insufficient balance');
      }

      if (deductFromBonus > 0) {
        await conn.query('UPDATE users SET gaming_bonus_balance = gaming_bonus_balance - ? WHERE id = ?', [deductFromBonus, userId]);
        await conn.query(
          'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
          [userId, 'game_bet', -deductFromBonus, `Colour Trading Bet (${color}) - Gaming Bonus`]
        );
      }
      if (deductFromMain > 0) {
        await conn.query('UPDATE users SET balance = balance - ? WHERE id = ?', [deductFromMain, userId]);
        await conn.query(
          'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
          [userId, 'game_bet', -deductFromMain, `Colour Trading Bet (${color})`]
        );
      }

      const [betRes] = await conn.query(
        'INSERT INTO ct_bets (round_id, user_id, color, bet_amount, status) VALUES (?, ?, ?, ?, "active")',
        [this.roundId, userId, color, amount]
      );

      await conn.commit();

      const newMain = mainBalance - deductFromMain;
      return { success: true, newBalance: newMain, walletUsed, betId: betRes.insertId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = ColourTradingLogic;
