/**
 * Migration 046: Performance Indexes
 * 
 * - PERF-003: Add index on users.created_at to optimize self-joins, filtering and ordering
 * - Optimize deposits.created_at and withdrawals.created_at to speed up admin queries
 */

exports.up = async (conn) => {
  // Add index on users.created_at
  try {
    await conn.query(`
      ALTER TABLE users
      ADD INDEX idx_users_created_at (created_at)
    `);
  } catch (e) {
    if (e.errno !== 1061) throw e; // 1061 is duplicate key/index error
  }

  // Add index on deposits.created_at
  try {
    await conn.query(`
      ALTER TABLE deposits
      ADD INDEX idx_deposits_created_at (created_at)
    `);
  } catch (e) {
    if (e.errno !== 1061) throw e;
  }

  // Add index on withdrawals.created_at
  try {
    await conn.query(`
      ALTER TABLE withdrawals
      ADD INDEX idx_withdrawals_created_at (created_at)
    `);
  } catch (e) {
    if (e.errno !== 1061) throw e;
  }

  console.log('✅ Migration 046: Performance indexes applied.');
};
