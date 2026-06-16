module.exports = {
  up: async (conn) => {
    console.log('Inserting default fdr_referral_percent scheme...');
    await conn.query("INSERT IGNORE INTO reward_schemes (type, min_amount, reward_amount, is_active) VALUES ('fdr_referral_percent', 0, 5, 1)");
  },
  down: async (conn) => {
    console.log('Removing fdr_referral_percent scheme...');
    await conn.query("DELETE FROM reward_schemes WHERE type = 'fdr_referral_percent'");
  }
};
