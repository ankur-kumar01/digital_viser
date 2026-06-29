exports.up = async (connection) => {
  await connection.query(`
    INSERT INTO system_settings (setting_key, setting_value, description) 
    VALUES 
      ('allow_coin_withdrawal_charges', 'true', 'Allow users to pay withdrawal charges with coins'),
      ('coin_to_inr_charge_rate', '1', 'Coins required to pay 1 INR in withdrawal charges')
    ON DUPLICATE KEY UPDATE 
      setting_value = VALUES(setting_value)
  `);
};

exports.down = async (connection) => {
  await connection.query(`
    DELETE FROM system_settings WHERE setting_key IN ('allow_coin_withdrawal_charges', 'coin_to_inr_charge_rate')
  `);
};
