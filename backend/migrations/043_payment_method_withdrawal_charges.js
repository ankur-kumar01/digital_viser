module.exports = {
  up: async (pool) => {
    try {
      await pool.query(`
        ALTER TABLE payment_methods ADD COLUMN withdrawal_charges JSON DEFAULT ('[]')
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
