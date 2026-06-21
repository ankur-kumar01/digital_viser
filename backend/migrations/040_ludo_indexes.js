module.exports = {
  up: async (pool) => {
    const addIndex = async (table, name, columns) => {
      try {
        await pool.query(`ALTER TABLE ${table} ADD INDEX ${name} (${columns})`);
      } catch (e) {
        if (e.errno === 1061) {
          console.log(`Index ${name} already exists on ${table}, skipping`);
        } else {
          throw e;
        }
      }
    };

    await addIndex('ludo_rooms', 'idx_rooms_status', 'status');
    await addIndex('ludo_rooms', 'idx_rooms_entry_fee', 'entry_fee');
    await addIndex('ludo_rooms', 'idx_rooms_host', 'host_id');
    await addIndex('ludo_rooms', 'idx_rooms_challenger', 'challenger_id');
    await addIndex('ludo_rooms', 'idx_rooms_status_entry', 'status, entry_fee');
    await addIndex('ludo_moves', 'idx_moves_room', 'room_id');
    await addIndex('ludo_moves', 'idx_moves_user', 'user_id');
  },

  down: async (pool) => {
    const dropIndex = async (table, name) => {
      try {
        await pool.query(`ALTER TABLE ${table} DROP INDEX ${name}`);
      } catch (e) {
        if (e.errno === 1091) {
          console.log(`Index ${name} does not exist on ${table}, skipping`);
        } else {
          throw e;
        }
      }
    };

    await dropIndex('ludo_rooms', 'idx_rooms_status');
    await dropIndex('ludo_rooms', 'idx_rooms_entry_fee');
    await dropIndex('ludo_rooms', 'idx_rooms_host');
    await dropIndex('ludo_rooms', 'idx_rooms_challenger');
    await dropIndex('ludo_rooms', 'idx_rooms_status_entry');
    await dropIndex('ludo_moves', 'idx_moves_room');
    await dropIndex('ludo_moves', 'idx_moves_user');
  }
};
