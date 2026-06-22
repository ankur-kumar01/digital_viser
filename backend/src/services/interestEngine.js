const { pool } = require('../db');

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function processDailyFinancials() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const currentDate = new Date().toISOString().split('T')[0];
    let processedFdrs = 0;
    let unlockedFunds = 0;

    // === GLOBAL INTEREST ENGINE ===
    // Get all active FDRs globally
    const [activeFdrs] = await conn.query("SELECT * FROM fdrs WHERE status = 'active' FOR UPDATE SKIP LOCKED");

    // Fetch dynamic FDR referral percent
    const [schemes] = await conn.query("SELECT reward_amount FROM reward_schemes WHERE type = 'fdr_referral_percent' AND is_active = true");
    const monthlyReferralPercent = schemes.length > 0 ? parseFloat(schemes[0].reward_amount) : 0;

    for (const fdr of activeFdrs) {
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
        const interest = fdrAmount * interestPercent / 100;

        await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [interest, userId]);
        accruedInterest += interest;
        lastInstDate = nextInstDate;
        nextInstDate = addDays(nextInstDate, fdr.period_days);

        await conn.query(
          'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
          [userId, 'interest', interest, `Interest from FDR #${fdr.id}`]
        );

        installmentProcessed = true;
      }

      if (installmentProcessed) {
        await conn.query(
          'UPDATE fdrs SET accrued_interest = ?, last_installment_date = ?, next_installment_date = ? WHERE id = ?',
          [accruedInterest, lastInstDate, nextInstDate, fdr.id]
        );
      }

      // Handle maturity
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

        let refInstDate = addDays(lastRefCommDate, 1);
        let refProcessed = false;

        // Process all pending daily referral commissions up to current date
        while (refInstDate <= currentDate && refInstDate <= endDate) {
          // Find who invited the FDR owner
          const [userRows] = await conn.query("SELECT invited_by FROM users WHERE id = ?", [fdr.user_id]);
          if (userRows.length > 0 && userRows[0].invited_by) {
            const invitedBy = userRows[0].invited_by;
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

      processedFdrs++;
    }

    // === GLOBAL TIME-LOCKED FUNDS ENGINE ===
    const [timeLockedFunds] = await conn.query(
      "SELECT * FROM locked_funds WHERE status = 'locked' AND unlock_date IS NOT NULL AND unlock_date <= ?",
      [currentDate]
    );

    for (const locked of timeLockedFunds) {
      let balanceField = '';
      let lockedField = '';
      
      if (locked.wallet_type === 'normal') { balanceField = 'balance'; lockedField = 'locked_balance'; }
      else if (locked.wallet_type === 'bonus') { balanceField = 'bonus_balance'; lockedField = 'locked_bonus_balance'; }
      else if (locked.wallet_type === 'referral') { balanceField = 'referral_balance'; lockedField = 'locked_referral_balance'; }

      await conn.query("UPDATE locked_funds SET status = 'unlocked', unlocked_at = NOW() WHERE id = ?", [locked.id]);
      await conn.query(`UPDATE users SET ${balanceField} = ${balanceField} + ?, ${lockedField} = ${lockedField} - ? WHERE id = ?`, [parseFloat(locked.amount), parseFloat(locked.amount), locked.user_id]);
      await conn.query("INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)", [locked.user_id, 'funds_unlocked_auto', locked.amount, `System auto-unlocked ${locked.wallet_type} funds after reaching unlock date`]);
      unlockedFunds++;
    }

    // Record last run time
    const now = new Date().toISOString();
    await conn.query("INSERT INTO system_state (key_name, value_data) VALUES ('cron_last_run', ?) ON DUPLICATE KEY UPDATE value_data = ?", [now, now]);

    await conn.commit();
    console.log(`[Cron] Processed ${processedFdrs} active FDRs and unlocked ${unlockedFunds} time-locked funds for ${currentDate}.`);
  } catch (err) {
    await conn.rollback();
    console.error('[Cron] Error during daily financial processing:', err);
  } finally {
    conn.release();
  }
}

module.exports = { processDailyFinancials };
