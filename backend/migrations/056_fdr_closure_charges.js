module.exports = {
  up: async (pool) => {
    // Create the fdr_closure_charges table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fdr_closure_charges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        closure_type ENUM('force_close', 'normal_close') NOT NULL,
        name VARCHAR(100) NOT NULL,
        charge_type ENUM('fixed', 'percent') DEFAULT 'percent',
        value DECIMAL(10,4) NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert some default charges to showcase functionality
    await pool.query(`
      INSERT INTO fdr_closure_charges (closure_type, name, charge_type, value, is_active)
      VALUES 
        ('force_close', 'Early Cancellation Penalty', 'percent', 5.0000, 1),
        ('force_close', 'Processing Fee', 'fixed', 50.0000, 1),
        ('normal_close', 'Settlement Charge', 'fixed', 10.0000, 0)
    `);
  },

  down: async (pool) => {
    await pool.query('DROP TABLE IF EXISTS fdr_closure_charges');
  }
};
