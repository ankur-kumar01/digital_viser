const { pool } = require('../db');
const { addDays, logger } = require('../utils');

async function processDailyFinancials(triggeredBy = 'system') {
  const mainConn = await pool.getConnection();
  let historyId = null;
  try {
    // --- SAFETY GUARD: Never process beyond today's REAL-WORLD date ---
    const realWorldToday = new Date().toISOString().split('T')[0];

    // Retrieve simulated date
    const [stateRows] = await mainConn.query(
      "SELECT value_data FROM system_state WHERE key_name = 'simulated_date'"
    );
    let currentDate = stateRows.length > 0 ? stateRows[0].value_data : realWorldToday;

    // HARD SAFETY CEILING: simulated_date can NEVER exceed today's real-world date.
    // This is the primary guard that prevents future-date interest from ever being credited.
    if (currentDate > realWorldToday) {
      logger.warn(`[InterestEngine] SAFETY BLOCK: simulated_date (${currentDate}) is in the future vs real date (${realWorldToday}). Clamping to today.`);
      currentDate = realWorldToday;
    }

    // Insert running log entry in cron_history
    const [histResult] = await mainConn.query(
      "INSERT INTO cron_history (cron_name, status, details) VALUES ('daily_financials', 'running', ?)",
      [JSON.stringify({ triggered_by: triggeredBy, processing_date: currentDate })]
    );
    historyId = histResult.insertId;

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

    // Fetch dynamic FDR coin referral percent
    const [coinSchemes] = await mainConn.query("SELECT reward_amount FROM reward_schemes WHERE type = 'fdr_coin_referral_percent' AND is_active = true");
    const monthlyCoinReferralPercent = coinSchemes.length > 0 ? parseFloat(coinSchemes[0].reward_amount) : 0;

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

        // Process pending installments.
        // SAFETY: nextInstDate must be:
        //   1. <= currentDate (the processed simulated/real date)
        //   2. <= endDate (must not exceed FDR maturity)
        //   3. <= realWorldToday (HARD WALL: never credit future-date interest under any circumstance)
        const installmentCeiling = currentDate < endDate ? currentDate : endDate;
        // Apply the real-world ceiling as an additional hard guard
        const hardCeiling = installmentCeiling < realWorldToday ? installmentCeiling : realWorldToday;

        while (nextInstDate && nextInstDate <= hardCeiling) {
          // Query active yield boosters for user on this specific installment date
          const [boosterRows] = await conn.query(
            `SELECT b.yield_boost_percent, b.unlock_game, b.unlock_value, uyb.activated_at
             FROM user_yield_boosters uyb
             JOIN fdr_yield_boosters b ON uyb.booster_id = b.id
             WHERE uyb.user_id = ?
               AND DATE(uyb.activated_at) <= DATE(?)
               AND DATE(uyb.expires_at) >= DATE(?)`,
            [userId, nextInstDate, nextInstDate]
          );
          
          const { getGameplayCount } = require('./audienceResolver');
          let totalBoost = 0.0;

          for (const booster of boosterRows) {
            let isUnlocked = true;
            if (booster.unlock_value > 0) {
              const activatedDateStr = booster.activated_at instanceof Date
                ? booster.activated_at.toISOString().split('T')[0]
                : (typeof booster.activated_at === 'string' ? booster.activated_at.split(' ')[0] : new Date(booster.activated_at).toISOString().split('T')[0]);
              
              const playsCount = await getGameplayCount(userId, booster.unlock_game, activatedDateStr, nextInstDate);
              isUnlocked = playsCount >= booster.unlock_value;
            }
            if (isUnlocked) {
              totalBoost += parseFloat(booster.yield_boost_percent);
            }
          }
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

        // Handle maturity - ONLY mark completed if real-world today >= endDate.
        // This prevents marking FDRs as complete before their actual maturity date in production.
        if (realWorldToday >= endDate && currentDate >= endDate) {
          // Double-check it's still active (avoid double-processing in race conditions)
          const [checkFdr] = await conn.query("SELECT status FROM fdrs WHERE id = ? FOR UPDATE", [fdr.id]);
          if (checkFdr.length > 0 && checkFdr[0].status === 'active') {
            await conn.query("UPDATE fdrs SET status = 'completed' WHERE id = ? AND status = 'active'", [fdr.id]);
            
            // Apply normal close charges
            const [charges] = await conn.query("SELECT * FROM fdr_closure_charges WHERE closure_type = 'normal_close' AND is_active = TRUE");
            let totalCharges = 0;
            const chargeLogs = [];
            
            for (const charge of charges) {
              let amt = charge.charge_type === 'percent' ? fdrAmount * (parseFloat(charge.value) / 100) : parseFloat(charge.value);
              amt = Math.min(amt, Math.max(0, fdrAmount - totalCharges));
              if (amt > 0) {
                totalCharges += amt;
                chargeLogs.push({ name: charge.name, amount: amt, desc: `FDR #${fdr.id} Normal Close Charge: ${charge.name}` });
              }
            }
            
            const netPrincipal = fdrAmount - totalCharges;

            await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [netPrincipal, userId]);
            await conn.query(
              'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
              [userId, 'fdr_maturity', fdrAmount, `FDR #${fdr.id} matured - principal returned`]
            );
            
            for (const log of chargeLogs) {
              await conn.query(
                'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
                [userId, 'fdr_closure_charge', -log.amount, log.desc]
              );
            }

            // Unlock linked bonus funds if any
            const [lockedBonuses] = await conn.query("SELECT * FROM locked_funds WHERE linked_entity_type = 'fdr' AND linked_entity_id = ? AND status = 'locked'", [fdr.id]);
            for (const locked of lockedBonuses) {
              await conn.query("UPDATE locked_funds SET status = 'unlocked', unlocked_at = NOW() WHERE id = ?", [locked.id]);
              await conn.query("UPDATE users SET locked_bonus_balance = locked_bonus_balance - ?, bonus_balance = bonus_balance + ? WHERE id = ?", [parseFloat(locked.amount), parseFloat(locked.amount), locked.user_id]);
              await conn.query("INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)", [locked.user_id, 'bonus_unlocked', locked.amount, `FDR Bonus Unlocked from FDR #${fdr.id}`]);
            }
          }
        }

        // Process Referral Commission Daily
        // SAFETY: Only process referral commission dates up to the real-world today ceiling
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

          // SAFETY: referral commission ceiling = min(currentDate, endDate, realWorldToday)
          const refCeiling = [currentDate, endDate, realWorldToday].sort()[0];

          while (refInstDate <= refCeiling) {
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

        // Process Coin Referral Commission Daily (Direct Credit to Coin Balance)
        // SAFETY: Only process referral commission dates up to the real-world today ceiling
        if (monthlyCoinReferralPercent > 0) {
          let lastCoinRefCommDate = fdr.last_coin_referral_commission_date
            ? (typeof fdr.last_coin_referral_commission_date === 'string'
              ? fdr.last_coin_referral_commission_date.split('T')[0]
              : new Date(fdr.last_coin_referral_commission_date).toISOString().split('T')[0])
            : (typeof fdr.start_date === 'string'
              ? fdr.start_date.split('T')[0]
              : new Date(fdr.start_date).toISOString().split('T')[0]);

          const [userReferrerRows] = await conn.query("SELECT invited_by FROM users WHERE id = ?", [fdr.user_id]);
          const invitedBy = userReferrerRows.length > 0 ? userReferrerRows[0].invited_by : null;

          let refInstDate = addDays(lastCoinRefCommDate, 1);
          let refProcessed = false;

          const refCeiling = [currentDate, endDate, realWorldToday].sort()[0];

          while (refInstDate <= refCeiling) {
            if (invitedBy) {
              const dailyCoinCommissionPercent = monthlyCoinReferralPercent / 30;
              const dailyCoinCommissionAmount = (fdrAmount * dailyCoinCommissionPercent) / 100;
              
              // Directly credit coin_balance without locking!
              await conn.query(
                "UPDATE users SET coin_balance = coin_balance + ? WHERE id = ?",
                [dailyCoinCommissionAmount, invitedBy]
              );
              
              await conn.query(
                "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)",
                [invitedBy, 'fdr_coin_referral_commission', dailyCoinCommissionAmount, `${dailyCoinCommissionPercent.toFixed(4)}% daily recurring coin commission from referred user's active FDR #${fdr.id}`]
              );
            }
            lastCoinRefCommDate = refInstDate;
            refInstDate = addDays(refInstDate, 1);
            refProcessed = true;
          }

          if (refProcessed) {
            await conn.query(
              "UPDATE fdrs SET last_coin_referral_commission_date = ? WHERE id = ?",
              [lastCoinRefCommDate, fdr.id]
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
      // SAFETY: Only unlock funds whose unlock_date has passed in the REAL world
      const [timeLockedFunds] = await lockConn.query(
        "SELECT * FROM locked_funds WHERE status = 'locked' AND unlock_date IS NOT NULL AND unlock_date <= ?",
        [realWorldToday]
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

    // Update daily_financials_last_processed_date key in system_state
    await mainConn.query(
      "INSERT INTO system_state (key_name, value_data) VALUES ('daily_financials_last_processed_date', ?) ON DUPLICATE KEY UPDATE value_data = ?",
      [currentDate, currentDate]
    );

    // Update cron history to success
    const detailsJson = JSON.stringify({
      processed_fdrs: processedFdrs,
      unlocked_funds: unlockedFunds,
      simulated_date: currentDate,
      real_world_date: realWorldToday,
      triggered_by: triggeredBy
    });
    await mainConn.query(
      "UPDATE cron_history SET status = 'success', completed_at = CURRENT_TIMESTAMP, details = ? WHERE id = ?",
      [detailsJson, historyId]
    );

    logger.info(`[Cron] Processed ${processedFdrs} active FDRs and unlocked ${unlockedFunds} time-locked funds for ${currentDate} (real date: ${realWorldToday}).`);
  } catch (err) {
    if (historyId) {
      try {
        await mainConn.query(
          "UPDATE cron_history SET status = 'failure', completed_at = CURRENT_TIMESTAMP, error_message = ? WHERE id = ?",
          [err.message, historyId]
        );
      } catch (logErr) {
        console.error('Failed to log cron failure:', logErr.message);
      }
    }
    logger.error('Cron job global execution error', { error: err.message });
  } finally {
    mainConn.release();
  }
}

module.exports = { processDailyFinancials };
