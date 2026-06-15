module.exports = {
  up: async (pool) => {
    // 1. Modify ct_bets color column type to VARCHAR(10) so it can store numbers as string selections
    await pool.query(`
      ALTER TABLE ct_bets MODIFY COLUMN color VARCHAR(10) NOT NULL
    `);

    // 2. Modify ct_rounds result_color column type to VARCHAR(10)
    await pool.query(`
      ALTER TABLE ct_rounds MODIFY COLUMN result_color VARCHAR(10) NULL
    `);

    // 3. Add result_number column to ct_rounds
    await pool.query(`
      ALTER TABLE ct_rounds ADD COLUMN result_number INT NULL AFTER result_color
    `);
  },

  down: async (pool) => {
    // Revert columns to original state
    await pool.query(`
      ALTER TABLE ct_rounds DROP COLUMN result_number
    `);
    await pool.query(`
      ALTER TABLE ct_rounds MODIFY COLUMN result_color ENUM('red', 'green', 'violet') NULL
    `);
    await pool.query(`
      ALTER TABLE ct_bets MODIFY COLUMN color ENUM('red', 'green', 'violet') NOT NULL
    `);
  }
};
