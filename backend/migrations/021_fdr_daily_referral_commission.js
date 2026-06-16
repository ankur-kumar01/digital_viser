module.exports = {
  up: async (conn) => {
    // Add column to track last referral commission
    await conn.query(`
      ALTER TABLE fdrs
      ADD COLUMN last_referral_commission_date DATE NULL
    `);

    // Initialize the new column with the start_date for existing active FDRs
    await conn.query(`
      UPDATE fdrs
      SET last_referral_commission_date = start_date
      WHERE status = 'active'
    `);
  },
  down: async (conn) => {
    await conn.query(`
      ALTER TABLE fdrs
      DROP COLUMN last_referral_commission_date
    `);
  }
};
