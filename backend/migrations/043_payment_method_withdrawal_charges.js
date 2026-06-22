module.exports = {
  up: async (pool) => {
    try {
      // Add JSON column without DEFAULT to support older MySQL/MariaDB versions (like on Hostinger)
      await pool.query(`
        ALTER TABLE payment_methods ADD COLUMN withdrawal_charges JSON NULL
      `);
      // Initialize existing rows with an empty array
      await pool.query(`
        UPDATE payment_methods SET withdrawal_charges = '[]' WHERE withdrawal_charges IS NULL
      `);
    } catch (e) {
      if (e.errno !== 1060) throw e;
    }
  },

  down: async (pool) => {
    try { 
      await pool.query('ALTER TABLE payment_methods DROP COLUMN withdrawal_charges'); 
    } catch (_) {}
  }
};
