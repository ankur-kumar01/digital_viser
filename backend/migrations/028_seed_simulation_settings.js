module.exports = {
  up: async (pool) => {
    await pool.query(`
      INSERT IGNORE INTO system_settings (setting_key, setting_value, description)
      VALUES 
        ('enable_aviator_chat_simulation', 'true', 'Enable simulated live chats on dashboard and in Aviator game'),
        ('enable_aviator_bet_simulation', 'true', 'Enable simulated player bets in Aviator game'),
        ('enable_colour_trading_bet_simulation', 'true', 'Enable simulated player bets in Colour Trading game')
    `);
  },

  down: async (pool) => {
    await pool.query(`
      DELETE FROM system_settings 
      WHERE setting_key IN ('enable_aviator_chat_simulation', 'enable_aviator_bet_simulation', 'enable_colour_trading_bet_simulation')
    `);
  }
};
