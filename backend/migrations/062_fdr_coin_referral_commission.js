const mysql = require('mysql2/promise');

async function up(conn) {
  // 1. Add last_coin_referral_commission_date to fdrs table if not exists
  const [cols] = await conn.query(`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fdrs' AND COLUMN_NAME = 'last_coin_referral_commission_date'
  `);

  if (cols.length === 0) {
    await conn.query(`
      ALTER TABLE fdrs
      ADD COLUMN last_coin_referral_commission_date DATE DEFAULT NULL
    `);
  }

  // 2. Initialize last_coin_referral_commission_date to CURRENT_DATE() for existing active FDRs
  // Per user instruction: do not consider previous dates if FDR is from an earlier date.
  await conn.query(`
    UPDATE fdrs 
    SET last_coin_referral_commission_date = CURRENT_DATE() 
    WHERE status = 'active' AND last_coin_referral_commission_date IS NULL
  `);

  // 3. Insert default reward scheme for FDR recurring coin referral (1% monthly)
  await conn.query(`
    INSERT INTO reward_schemes (type, min_amount, reward_amount, is_active) 
    SELECT 'fdr_coin_referral_percent', 0, 1.00, true
    WHERE NOT EXISTS (
      SELECT 1 FROM reward_schemes WHERE type = 'fdr_coin_referral_percent'
    )
  `);
}

module.exports = { up };
