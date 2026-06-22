const { pool } = require('../db');
const { addDays, logger } = require('../utils');

async function processDailyFinancials() {
  const mainConn = await pool.getConnection();
  try {
    // Retrieve simulated date
    const [stateRows] = await mainConn.query(
      "SELECT value_data FROM system_state WHERE key_name = 'simulated_date'"
    );
    const currentDate = stateRows.length > 0 ? stateRows[0].value_data : new Date().toISOString().split('T')[0];

    // Auto-expire yield boosters that have expired relative to currentDate
    await mainConn.query(
      `UPDATE user_yield_boosters 
       SET status = 'completed' 
       WHERE status = 'active' AND DATE(expires_at) < DATE(?)`,
      [currentDate]
    );

    let processedFdrs = 0;
    let unlockedFunds = 0;

    // === GLOBAL INTEREST ENGINE ===
    // Fetch dynamic FDR referral percent
    const [schemes] = await mainConn.query("SELECT reward_amount FROM reward_schemes WHERE type = 'fdr_referral_percent' AND is_active = true");
    const monthlyReferralPercent = schemes.length > 0 ? parseFloat(schemes[0].reward_amount) : 0;

    // Get all active FDR IDs globally (locked individually)
    const [activeFdrRows] = await mainConn.query("SELECT id FROM fdrs WHERE status = 'active'");

    for (const fdrRow of activeFdrRows) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // Lock specific FDR row
        const [fdrs] = await conn.query("SELECT * FROM fdrs WHERE id = ? AND status = 'active' FOR UPDATE", [fdrRow.id]);
        if (fdrs.length === 0) {
          await conn.commit();
          conn.release();
          continue;
        }

        const fdr = fdrs[0];
        const userId = fdr.user_id;
        let nextInstDate = fdr.next_installment_date
          ? (typeof fdr.next_installment_date === 'string'
            ? fdr.next_installment_date.split('T')[0]
            : new Date(fdr.next_installment_date).toISOString().split('T')[0])
          : null;

        let lastInstDate = fdr.last_installment_date
          ? (typeof fdr.last_installment_date === 'string'
            ? fdr.last_installment_date.split('T')[0]
            : new Date(fdr.last_installment_date).toISOString().split('T')[0])
          : null;

        const endDate = typeof fdr.end_date === 'string'
          ? fdr.end_date.split('T')[0]
          : new Date(fdr.end_date).toISOString().split('T')[0];

        let accruedInterest = parseFloat(fdr.accrued_interest);
        const fdrAmount = parseFloat(fdr.amount);
        const interestPercent = parseFloat(fdr.interest_percent);
        let installmentProcessed = false;

        // Process all pending installments up to the current date
        while (nextInstDate && nextInstDate <= currentDate && nextInstDate <= endDate) {
          // Query active yield boosters for user on this specific installment date
          const [boosterRows] = await conn.query(
            `SELECT SUM(b.yield_boost_percent) as total_boost
             FROM user_yield_boosters uyb
             JOIN fdr_yield_boosters b ON uyb.booster_id = b.id
             WHERE uyb.user_id = ?
               AND DATE(uyb.activated_at) <= DATE(?)
               AND DATE(uyb.expires_at) >= DATE(?)`,
            [userId, nextInstDate, nextInstDate]
          );
          const totalBoost = boosterRows[0]?.total_boost ? parseFloat(boosterRows[0].total_boost) : 0.0;
          const boostedRate = interestPercent + totalBoost;
          const interest = fdrAmount * boostedRate / 100;

          await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [interest, userId]);
          accruedInterest += interest;
          lastInstDate = nextInstDate;
          nextInstDate = addDays(nextInstDate, fdr.period_days);

          const boostDesc = totalBoost > 0 ? ` (+${totalBoost.toFixed(2)}% Boost applied)` : '';
          await conn.query(
            'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
            [userId, 'interest', interest, `Interest from FDR #${fdr.id}${boostDesc}`]
          );

          installmentProcessed = true;
        }

        if (installmentProcessed) {
          await conn.query(
            'UPDATE fdrs SET accrued_interest = ?, last_installment_date = ?, next_installment_date = ? WHERE id = ?',
            [accruedInterest, lastInstDate, nextInstDate, fdr.id]
          );
        }

        // Handle maturity - only process if status is active
        if (currentDate >= endDate) {
          await conn.query("UPDATE fdrs SET status = 'completed' WHERE id = ? AND status = 'active'", [fdr.id]);
          await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [fdrAmount, userId]);
          await conn.query(
            'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
            [userId, 'fdr_maturity', fdrAmount, `FDR #${fdr.id} matured - principal returned`]
          );

          // Unlock linked bonus funds if any
          const [lockedBonuses] = await conn.query("SELECT * FROM locked_funds WHERE linked_entity_type = 'fdr' AND linked_entity_id = ? AND status = 'locked'", [fdr.id]);
          for (const locked of lockedBonuses) {
            await conn.query("UPDATE locked_funds SET status = 'unlocked', unlocked_at = NOW() WHERE id = ?", [locked.id]);
            await conn.query("UPDATE users SET locked_bonus_balance = locked_bonus_balance - ?, bonus_balance = bonus_balance + ? WHERE id = ?", [parseFloat(locked.amount), parseFloat(locked.amount), locked.user_id]);
            await conn.query("INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)", [locked.user_id, 'bonus_unlocked', locked.amount, `FDR Bonus Unlocked from FDR #${fdr.id}`]);
          }
        }

        // Process Referral Commission Daily
        if (monthlyReferralPercent > 0) {
          let lastRefCommDate = fdr.last_referral_commission_date
            ? (typeof fdr.last_referral_commission_date === 'string'
              ? fdr.last_referral_commission_date.split('T')[0]
              : new Date(fdr.last_referral_commission_date).toISOString().split('T')[0])
            : (typeof fdr.start_date === 'string'
              ? fdr.start_date.split('T')[0]
              : new Date(fdr.start_date).toISOString().split('T')[0]);

          const [userReferrerRows] = await conn.query("SELECT invited_by FROM users WHERE id = ?", [fdr.user_id]);
          const invitedBy = userReferrerRows.length > 0 ? userReferrerRows[0].invited_by : null;

          let refInstDate = addDays(lastRefCommDate, 1);
          let refProcessed = false;

          while (refInstDate <= currentDate && refInstDate <= endDate) {
            if (invitedBy) {
              const dailyCommissionPercent = monthlyReferralPercent / 30;
              const dailyCommissionAmount = (fdrAmount * dailyCommissionPercent) / 100;
              
              await conn.query(
                "UPDATE users SET locked_referral_balance = locked_referral_balance + ? WHERE id = ?",
                [dailyCommissionAmount, invitedBy]
              );
              
              await conn.query(
                "INSERT INTO locked_funds (user_id, wallet_type, amount, linked_entity_id, linked_entity_type, status) VALUES (?, 'referral', ?, ?, 'fdr_referral', 'locked')",
                [invitedBy, dailyCommissionAmount, fdr.id]
              );
              
              await conn.query(
                "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)",
                [invitedBy, 'fdr_referral_commission', dailyCommissionAmount, `${dailyCommissionPercent.toFixed(4)}% daily recurring commission from referred user's active FDR #${fdr.id}`]
              );
            }
            lastRefCommDate = refInstDate;
            refInstDate = addDays(refInstDate, 1);
            refProcessed = true;
          }

          if (refProcessed) {
            await conn.query(
              "UPDATE fdrs SET last_referral_commission_date = ? WHERE id = ?",
              [lastRefCommDate, fdr.id]
            );
          }
        }

        await conn.commit();
        processedFdrs++;
      } catch (err) {
        await conn.rollback();
        logger.error(`Error processing FDR #${fdrRow.id}`, { error: err.message, stack: err.stack });
      } finally {
        conn.release();
      }
    }

    // === GLOBAL TIME-LOCKED FUNDS ENGINE ===
    const lockConn = await pool.getConnection();
    try {
      await lockConn.beginTransaction();
      const [timeLockedFunds] = await lockConn.query(
        "SELECT * FROM locked_funds WHERE status = 'locked' AND unlock_date IS NOT NULL AND unlock_date <= ?",
        [currentDate]
      );

      for (const locked of timeLockedFunds) {
        let balanceField = '';
        let lockedField = '';
        
        if (locked.wallet_type === 'normal') { balanceField = 'balance'; lockedField = 'locked_balance'; }
        else if (locked.wallet_type === 'bonus') { balanceField = 'bonus_balance'; lockedField = 'locked_bonus_balance'; }
        else if (locked.wallet_type === 'referral') { balanceField = 'referral_balance'; lockedField = 'locked_referral_balance'; }

        await lockConn.query("UPDATE locked_funds SET status = 'unlocked', unlocked_at = NOW() WHERE id = ?", [locked.id]);
        await lockConn.query(`UPDATE users SET ${balanceField} = ${balanceField} + ?, ${lockedField} = ${lockedField} - ? WHERE id = ?`, [parseFloat(locked.amount), parseFloat(locked.amount), locked.user_id]);
        await lockConn.query("INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)", [locked.user_id, 'funds_unlocked_auto', locked.amount, `System auto-unlocked ${locked.wallet_type} funds after reaching unlock date`]);
        unlockedFunds++;
      }

      const now = new Date().toISOString();
      await lockConn.query("INSERT INTO system_state (key_name, value_data) VALUES ('cron_last_run', ?) ON DUPLICATE KEY UPDATE value_data = ?", [now, now]);
      await lockConn.commit();
    } catch (err) {
      await lockConn.rollback();
      logger.error('Error processing time-locked funds', { error: err.message, stack: err.stack });
    } finally {
      lockConn.release();
    }

    logger.info(`[Cron] Processed ${processedFdrs} active FDRs and unlocked ${unlockedFunds} time-locked funds for ${currentDate}.`);
  } catch (err) {
    logger.error('Cron job global execution error', { error: err.message });
  } finally {
    mainConn.release();
  }
}

module.exports = { processDailyFinancials };
