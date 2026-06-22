/**
 * Migration 045: Bug fix schema additions
 * 
 * - SEC-003: Add is_used column to password_resets for OTP invalidation
 * - BUG-003: Add host_wallet_used column to ludo_rooms for correct refund wallet tracking
 */

exports.up = async (conn) => {
  // SEC-003: Allow tracking whether an OTP has been used (prevents reuse attacks)
  try {
    await conn.query(`
      ALTER TABLE password_resets
      ADD COLUMN is_used TINYINT(1) NOT NULL DEFAULT 0
    `);
  } catch (e) {
    if (e.errno !== 1060) throw e; // 1060 is duplicate column error
  }

  // BUG-003: Track which wallet (balance or gaming_bonus_balance) the host used when creating a room
  try {
    await conn.query(`
      ALTER TABLE ludo_rooms
      ADD COLUMN host_wallet_used VARCHAR(30) NOT NULL DEFAULT 'balance'
    `);
  } catch (e) {
    if (e.errno !== 1060) throw e;
  }

  // Also add challenger_wallet_used for completeness (if challenger needs a refund in edge cases)
  try {
    await conn.query(`
      ALTER TABLE ludo_rooms
      ADD COLUMN challenger_wallet_used VARCHAR(30) NULL DEFAULT NULL
    `);
  } catch (e) {
    if (e.errno !== 1060) throw e;
  }

  console.log('✅ Migration 045: Bug fix schema additions applied.');
};
