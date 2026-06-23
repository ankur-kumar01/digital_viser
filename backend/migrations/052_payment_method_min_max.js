/**
 * Migration 052: Payment Channel Min/Max Limits
 */

exports.up = async (conn) => {
  try {
    // 1. Add columns to payment_methods
    await conn.query(`
      ALTER TABLE payment_methods 
      ADD COLUMN min_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      ADD COLUMN max_amount DECIMAL(15,2) NOT NULL DEFAULT 10000000.00
    `);

    // 2. Set defaults for existing methods
    await conn.query(`
      UPDATE payment_methods 
      SET min_amount = 0.00, max_amount = 10000000.00
    `);

    console.log('✅ Migration 052: min_amount and max_amount fields added to payment_methods.');
  } catch (e) {
    if (e.errno === 1060) {
      console.log('⏭️ Migration 052 columns already exist.');
    } else {
      console.error('Error in migration 052 up:', e.message);
      throw e;
    }
  }
};

exports.down = async (conn) => {
  try {
    await conn.query(`
      ALTER TABLE payment_methods 
      DROP COLUMN min_amount,
      DROP COLUMN max_amount
    `);
    console.log('❌ Migration 052: min_amount and max_amount fields dropped from payment_methods.');
  } catch (e) {
    console.error('Error in migration 052 down:', e.message);
  }
};
