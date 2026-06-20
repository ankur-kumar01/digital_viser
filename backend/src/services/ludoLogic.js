const { pool } = require('../db');

class LudoLogic {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // local tracking of active rooms timers/states
    this.ensureBotUser();
  }

  async ensureBotUser() {
    try {
      await pool.query(`
        INSERT INTO users (id, name, email, password_hash)
        VALUES (9999, 'Guest_7842', 'bot@ludoclash.com', 'disabled')
        ON DUPLICATE KEY UPDATE name = 'Guest_7842'
      `);
      console.log('LudoBot user verified in database (ID: 9999)');
    } catch (err) {
      console.error('Failed to verify LudoBot user in database:', err);
    }
  }

  handleSocketConnection(socket) {
    const userId = socket.user.userId;

    // Send active rooms lists to user
    this.sendRoomsList(socket);

    socket.on('ludo:get_rooms', () => {
      this.sendRoomsList(socket);
    });

    socket.on('ludo:get_active_game', async (callback) => {
      try {
        const [rooms] = await pool.query(
          `SELECT lr.*, u1.name as host_name, u2.name as challenger_name
           FROM ludo_rooms lr
           LEFT JOIN users u1 ON lr.host_id = u1.id
           LEFT JOIN users u2 ON lr.challenger_id = u2.id
           WHERE lr.status = "playing" AND (lr.host_id = ? OR lr.challenger_id = ?)
           LIMIT 1`,
          [userId, userId]
        );

        if (rooms.length > 0) {
          const room = rooms[0];
          const boardState = typeof room.board_state === 'string' ? JSON.parse(room.board_state) : room.board_state;
          const gameRoomData = {
            id: room.id,
            entryFee: parseFloat(room.entry_fee),
            hostId: room.host_id,
            hostName: room.host_name,
            challengerId: room.challenger_id,
            challengerName: room.challenger_name || 'Player 2',
            boardState
          };
          socket.join(`ludo_room_${room.id}`);
          if (typeof callback === 'function') callback({ success: true, room: gameRoomData });
        } else {
          if (typeof callback === 'function') callback({ success: false });
        }
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('ludo:forfeit', async (data, callback) => {
      const roomId = parseInt(data.roomId);
      try {
        const [rooms] = await pool.query('SELECT * FROM ludo_rooms WHERE id = ?', [roomId]);
        if (rooms.length === 0) throw new Error('Room not found');
        const room = rooms[0];
        
        if (room.status !== 'playing') throw new Error('Match is not active');
        if (room.host_id !== userId && room.challenger_id !== userId) throw new Error('You are not in this room');

        const winnerId = room.host_id === userId ? room.challenger_id : room.host_id;
        await this.resolveWin(roomId, winnerId, room.entry_fee);
        
        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('ludo:find_match', async (data, callback) => {
      const entryFee = parseFloat(data.entryFee);
      try {
        if (isNaN(entryFee) || entryFee < 10 || entryFee > 5000) {
          throw new Error('Wager entry fee must be between ₹10 and ₹5000');
        }

        // Search for a waiting room with same entry fee not created by this user
        const [existingRooms] = await pool.query(
          'SELECT id FROM ludo_rooms WHERE status = "waiting" AND entry_fee = ? AND host_id != ? ORDER BY created_at ASC LIMIT 1',
          [entryFee, userId]
        );

        if (existingRooms.length > 0) {
          const roomId = existingRooms[0].id;
          const result = await this.joinRoom(userId, roomId, socket);
          if (typeof callback === 'function') callback({ success: true, action: 'joined', room: result });
          this.broadcastRoomsList();
        } else {
          const result = await this.createRoom(userId, entryFee);
          socket.join(`ludo_room_${result.id}`);
          if (typeof callback === 'function') callback({ success: true, action: 'created', room: result });
          this.broadcastRoomsList();
        }
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('ludo:create_room', async (data, callback) => {
      const entryFee = parseFloat(data.entryFee);
      try {
        const result = await this.createRoom(userId, entryFee);
        socket.join(`ludo_room_${result.id}`);
        if (typeof callback === 'function') callback({ success: true, room: result });
        this.broadcastRoomsList();
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('ludo:join_room', async (data, callback) => {
      const roomId = parseInt(data.roomId);
      try {
        const result = await this.joinRoom(userId, roomId, socket);
        if (typeof callback === 'function') callback({ success: true, room: result });
        this.broadcastRoomsList();
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('ludo:play_bot', async (data, callback) => {
      const entryFee = parseFloat(data.entryFee);
      try {
        const result = await this.playWithBot(userId, entryFee, socket);
        if (typeof callback === 'function') callback({ success: true, room: result });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('ludo:cancel_room', async (data, callback) => {
      const roomId = parseInt(data.roomId);
      try {
        await this.cancelRoom(userId, roomId);
        if (typeof callback === 'function') callback({ success: true });
        this.broadcastRoomsList();
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('ludo:roll_dice', async (data, callback) => {
      const roomId = parseInt(data.roomId);
      try {
        const result = await this.rollDice(userId, roomId);
        if (typeof callback === 'function') callback({ success: true, roll: result.roll, phase: result.phase });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('ludo:move_piece', async (data, callback) => {
      const roomId = parseInt(data.roomId);
      const pieceIndex = parseInt(data.pieceIndex);
      try {
        const result = await this.movePiece(userId, roomId, pieceIndex);
        if (typeof callback === 'function') callback({ success: true, result });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });
  }

  async sendRoomsList(socket) {
    try {
      const [rows] = await pool.query(
        `SELECT lr.id, lr.entry_fee, lr.status, u.name as host_name, lr.created_at
         FROM ludo_rooms lr
         LEFT JOIN users u ON lr.host_id = u.id
         WHERE lr.status = 'waiting'
         ORDER BY lr.created_at DESC`
      );
      socket.emit('ludo:rooms_list', rows);
    } catch (err) {
      console.error('Error fetching Ludo rooms list:', err);
    }
  }

  async broadcastRoomsList() {
    try {
      const [rows] = await pool.query(
        `SELECT lr.id, lr.entry_fee, lr.status, u.name as host_name, lr.created_at
         FROM ludo_rooms lr
         LEFT JOIN users u ON lr.host_id = u.id
         WHERE lr.status = 'waiting'
         ORDER BY lr.created_at DESC`
      );
      this.io.emit('ludo:rooms_list', rows);
    } catch (err) {
      console.error('Error broadcasting Ludo rooms list:', err);
    }
  }

  async createRoom(hostId, entryFee) {
    if (isNaN(entryFee) || entryFee < 10 || entryFee > 5000) {
      throw new Error('Wager entry fee must be between ₹10 and ₹5000');
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Check balance
      const [userRows] = await conn.query('SELECT balance, gaming_bonus_balance FROM users WHERE id = ? FOR UPDATE', [hostId]);
      if (userRows.length === 0) throw new Error('User not found');

      const mainBal = parseFloat(userRows[0].balance) || 0;
      const bonusBal = parseFloat(userRows[0].gaming_bonus_balance) || 0;
      const totalBal = Math.max(mainBal, bonusBal);

      if (totalBal < entryFee) {
        throw new Error('Insufficient balance to join room');
      }

      // Deduct entry fee
      const walletField = bonusBal >= entryFee ? 'gaming_bonus_balance' : 'balance';
      await conn.query(`UPDATE users SET ${walletField} = ${walletField} - ? WHERE id = ?`, [entryFee, hostId]);
      await conn.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [hostId, 'game_bet', -entryFee, `Ludo Entry Fee (${walletField === 'gaming_bonus_balance' ? 'Bonus' : 'Main'})`]
      );

      // Initial Board state
      const initialBoard = {
        turn: 'host',
        phase: 'roll', // 'roll' | 'move'
        dice: 0,
        hostPieces: [0, 0, 0, 0], // index position on path (0 is Base, 1 to 57 path, 58 is Home)
        challengerPieces: [0, 0, 0, 0],
        turnStartTime: Date.now(),
        missedTurns: { host: 0, challenger: 0 }
      };

      const [result] = await conn.query(
        'INSERT INTO ludo_rooms (entry_fee, host_id, board_state, status) VALUES (?, ?, ?, "waiting")',
        [entryFee, hostId, JSON.stringify(initialBoard)]
      );

      await conn.commit();
      return { id: result.insertId, entryFee, hostId, boardState: initialBoard };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async cancelRoom(hostId, roomId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rooms] = await conn.query('SELECT * FROM ludo_rooms WHERE id = ? FOR UPDATE', [roomId]);
      if (rooms.length === 0) throw new Error('Room not found');
      const room = rooms[0];

      if (room.host_id !== hostId) throw new Error('You cannot cancel this room');
      if (room.status !== 'waiting') throw new Error('Room is already active or finished');

      // Refund host
      await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [room.entry_fee, hostId]);
      await conn.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [hostId, 'refund', room.entry_fee, `Ludo Refund (Room #${roomId})`]
      );

      // Cancel room
      await conn.query('UPDATE ludo_rooms SET status = "cancelled" WHERE id = ?', [roomId]);

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async joinRoom(challengerId, roomId, socket) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rooms] = await conn.query('SELECT * FROM ludo_rooms WHERE id = ? FOR UPDATE', [roomId]);
      if (rooms.length === 0) throw new Error('Room not found');
      const room = rooms[0];

      if (room.status !== 'waiting') throw new Error('Room is already full or inactive');
      if (room.host_id === challengerId) throw new Error('You cannot join your own room');

      // Check balance
      const [userRows] = await conn.query('SELECT balance, gaming_bonus_balance FROM users WHERE id = ? FOR UPDATE', [challengerId]);
      if (userRows.length === 0) throw new Error('User not found');

      const mainBal = parseFloat(userRows[0].balance) || 0;
      const bonusBal = parseFloat(userRows[0].gaming_bonus_balance) || 0;
      const totalBal = Math.max(mainBal, bonusBal);
      const entryFee = parseFloat(room.entry_fee);

      if (totalBal < entryFee) {
        throw new Error('Insufficient balance to join Ludo match');
      }

      // Deduct entry fee
      const walletField = bonusBal >= entryFee ? 'gaming_bonus_balance' : 'balance';
      await conn.query(`UPDATE users SET ${walletField} = ${walletField} - ? WHERE id = ?`, [entryFee, challengerId]);
      await conn.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [challengerId, 'game_bet', -entryFee, `Ludo Entry Fee (${walletField === 'gaming_bonus_balance' ? 'Bonus' : 'Main'})`]
      );

      // Fetch host details
      const [hostRows] = await conn.query('SELECT name FROM users WHERE id = ?', [room.host_id]);
      const hostName = hostRows[0]?.name || 'Player 1';
      const [challengerRows] = await conn.query('SELECT name FROM users WHERE id = ?', [challengerId]);
      const challengerName = challengerRows[0]?.name || 'Player 2';

      // Update room to active
      const boardState = typeof room.board_state === 'string' ? JSON.parse(room.board_state) : room.board_state;
      boardState.turnStartTime = Date.now();

      await conn.query(
        'UPDATE ludo_rooms SET challenger_id = ?, status = "playing", board_state = ? WHERE id = ?',
        [challengerId, JSON.stringify(boardState), roomId]
      );

      await conn.commit();

      const gameRoomData = {
        id: roomId,
        entryFee,
        hostId: room.host_id,
        hostName,
        challengerId,
        challengerName,
        boardState
      };

      // Notify users inside this room
      socket.join(`ludo_room_${roomId}`);
      this.io.to(`ludo_room_${roomId}`).emit('ludo:game_start', gameRoomData);
      
      this.startTurnTimeout(roomId);

      return gameRoomData;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async playWithBot(hostId, entryFee, socket) {
    if (isNaN(entryFee) || entryFee < 10 || entryFee > 5000) {
      throw new Error('Wager entry fee must be between ₹10 and ₹5000');
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Check balance
      const [userRows] = await conn.query('SELECT balance, gaming_bonus_balance FROM users WHERE id = ? FOR UPDATE', [hostId]);
      if (userRows.length === 0) throw new Error('User not found');

      const mainBal = parseFloat(userRows[0].balance) || 0;
      const bonusBal = parseFloat(userRows[0].gaming_bonus_balance) || 0;
      const totalBal = Math.max(mainBal, bonusBal);

      if (totalBal < entryFee) {
        throw new Error('Insufficient balance to join room');
      }

      // Deduct entry fee
      const walletField = bonusBal >= entryFee ? 'gaming_bonus_balance' : 'balance';
      await conn.query(`UPDATE users SET ${walletField} = ${walletField} - ? WHERE id = ?`, [entryFee, hostId]);
      await conn.query(
        'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
        [hostId, 'game_bet', -entryFee, `Ludo Entry Fee (${walletField === 'gaming_bonus_balance' ? 'Bonus' : 'Main'})`]
      );

      // Setup board state
      const initialBoard = {
        turn: 'host',
        phase: 'roll',
        dice: 0,
        hostPieces: [0, 0, 0, 0],
        challengerPieces: [0, 0, 0, 0],
        turnStartTime: Date.now(),
        missedTurns: { host: 0, challenger: 0 }
      };

      const challengerId = 9999; // simulated bot ID
      const challengerName = 'Guest_7842';
      const [hostRows] = await conn.query('SELECT name FROM users WHERE id = ?', [hostId]);
      const hostName = hostRows[0]?.name || 'Player 1';

      const [result] = await conn.query(
        'INSERT INTO ludo_rooms (entry_fee, host_id, challenger_id, board_state, status) VALUES (?, ?, ?, ?, "playing")',
        [entryFee, hostId, challengerId, JSON.stringify(initialBoard)]
      );

      const roomId = result.insertId;

      await conn.commit();

      const gameRoomData = {
        id: roomId,
        entryFee,
        hostId,
        hostName,
        challengerId,
        challengerName,
        boardState: initialBoard
      };

      socket.join(`ludo_room_${roomId}`);
      this.startTurnTimeout(roomId);
      // Notify client
      setTimeout(() => {
        this.io.to(`ludo_room_${roomId}`).emit('ludo:game_start', gameRoomData);
      }, 500);

      return gameRoomData;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async rollDice(userId, roomId) {
    const [rooms] = await pool.query('SELECT * FROM ludo_rooms WHERE id = ?', [roomId]);
    if (rooms.length === 0) throw new Error('Room not found');
    const room = rooms[0];

    if (room.status !== 'playing') throw new Error('Match has ended or is not active');
    
    const isHost = room.host_id === userId;
    const isChallenger = room.challenger_id === userId;
    if (!isHost && !isChallenger) throw new Error('You are not in this game room');

    const boardState = typeof room.board_state === 'string' ? JSON.parse(room.board_state) : room.board_state;
    const currentTurn = boardState.turn; // 'host' or 'challenger'
    
    if (isHost && currentTurn !== 'host') throw new Error('It is not your turn');
    if (isChallenger && currentTurn !== 'challenger') throw new Error('It is not your turn');
    if (boardState.phase !== 'roll') throw new Error('Waiting for piece move, not roll');

    // Reset missed turns since player is active
    boardState.missedTurns = boardState.missedTurns || { host: 0, challenger: 0 };
    boardState.missedTurns[currentTurn] = 0;

    // Roll random 1-6
    const roll = Math.floor(Math.random() * 6) + 1;
    boardState.dice = roll;
    boardState.phase = 'move';
    boardState.turnStartTime = Date.now();

    await pool.query('UPDATE ludo_rooms SET board_state = ? WHERE id = ?', [JSON.stringify(boardState), roomId]);
    
    this.io.to(`ludo_room_${roomId}`).emit('ludo:dice_rolled', {
      roll,
      boardState,
      roomId
    });

    // Check if player has any valid move
    const hasMoves = this.checkValidMoves(currentTurn, boardState, roll);

    if (!hasMoves) {
      setTimeout(async () => {
        try {
          const [rooms] = await pool.query('SELECT * FROM ludo_rooms WHERE id = ?', [roomId]);
          if (rooms.length === 0 || rooms[0].status !== 'playing') return;
          const currentRoomState = typeof rooms[0].board_state === 'string' ? JSON.parse(rooms[0].board_state) : rooms[0].board_state;
          
          if (currentRoomState.phase === 'move' && currentRoomState.dice === roll && currentRoomState.turn === currentTurn) {
            currentRoomState.phase = 'roll';
            currentRoomState.turn = currentTurn === 'host' ? 'challenger' : 'host';
            currentRoomState.dice = 0;
            currentRoomState.turnStartTime = Date.now();

            await pool.query('UPDATE ludo_rooms SET board_state = ? WHERE id = ?', [JSON.stringify(currentRoomState), roomId]);
            
            this.io.to(`ludo_room_${roomId}`).emit('ludo:turn_passed', {
              boardState: currentRoomState,
              reason: `You rolled a ${roll}, but no valid moves are possible!`
            });
            this.startTurnTimeout(roomId);
            this.checkTriggerBotTurn(roomId, currentRoomState.turn, rooms[0].challenger_id);
          }
        } catch (err) {
          console.error(err);
        }
      }, 1500);
      
      return { roll, phase: 'move' };
    }

    return { roll, phase: boardState.phase };
  }

  checkValidMoves(player, boardState, dice) {
    const pieces = player === 'host' ? boardState.hostPieces : boardState.challengerPieces;
    let validCount = 0;
    
    pieces.forEach((pos) => {
      // To release from base (0), need a 6
      if (pos === 0) {
        if (dice === 6) validCount++;
      } else if (pos > 0 && pos < 58) {
        // Can't move past 58 (Home center)
        if (pos + dice <= 58) validCount++;
      }
    });

    return validCount > 0;
  }

  async movePiece(userId, roomId, pieceIndex) {
    const [rooms] = await pool.query('SELECT * FROM ludo_rooms WHERE id = ?', [roomId]);
    if (rooms.length === 0) throw new Error('Room not found');
    const room = rooms[0];

    if (room.status !== 'playing') throw new Error('Match is inactive');

    const isHost = room.host_id === userId;
    const isChallenger = room.challenger_id === userId;
    if (!isHost && !isChallenger) throw new Error('You are not in this room');

    const boardState = typeof room.board_state === 'string' ? JSON.parse(room.board_state) : room.board_state;
    const currentTurn = boardState.turn;
    
    if (isHost && currentTurn !== 'host') throw new Error('It is not your turn');
    if (isChallenger && currentTurn !== 'challenger') throw new Error('It is not your turn');
    if (boardState.phase !== 'move') throw new Error('You must roll the dice first');

    // Reset missed turns since player is active
    boardState.missedTurns = boardState.missedTurns || { host: 0, challenger: 0 };
    boardState.missedTurns[currentTurn] = 0;

    const pieces = isHost ? boardState.hostPieces : boardState.challengerPieces;
    if (pieceIndex < 0 || pieceIndex > 3) throw new Error('Invalid piece index');

    const originalPos = pieces[pieceIndex];
    const dice = boardState.dice;

    // Validate movement rules
    if (originalPos === 0 && dice !== 6) throw new Error('Must roll a 6 to release piece from base');
    if (originalPos + dice > 58) throw new Error('Piece movement exceeds home goal limit');

    // Execute Move
    let nextPos = 0;
    if (originalPos === 0 && dice === 6) {
      nextPos = 1; // Released onto start position
    } else {
      nextPos = originalPos + dice;
    }

    pieces[pieceIndex] = nextPos;

    // Log move
    await pool.query(
      'INSERT INTO ludo_moves (room_id, user_id, piece_index, from_pos, to_pos, dice_value) VALUES (?, ?, ?, ?, ?, ?)',
      [roomId, userId, pieceIndex, originalPos, nextPos, dice]
    );

    // Capture check
    let hasCaptured = false;
    const safeZones = [1, 9, 14, 22, 27, 35, 40, 48]; // standard Ludo safe slots
    const isSafe = safeZones.includes(nextPos);

    if (!isSafe && nextPos < 53) {
      // Map positions relative to check captures
      // Host track runs 1 to 52. Challenger track starts at offset 26.
      // So host pos nextPos is challenger pos (nextPos + 26) % 52
      const oppPieces = isHost ? boardState.challengerPieces : boardState.hostPieces;
      
      const hostToChallengerPos = (pos) => (pos + 26) % 52 || 52;
      const challengerToHostPos = (pos) => (pos + 26) % 52 || 52;

      for (let idx = 0; idx < 4; idx++) {
        const oppPos = oppPieces[idx];
        if (oppPos > 0 && oppPos < 53) {
          const mappedOppPos = isHost ? challengerToHostPos(oppPos) : hostToChallengerPos(oppPos);
          if (mappedOppPos === nextPos) {
            // Captured! Send piece back to base (0)
            oppPieces[idx] = 0;
            hasCaptured = true;
          }
        }
      }
    }

    // Win condition check (all 4 pieces at 58)
    const isWin = pieces.every(pos => pos === 58);

    if (isWin) {
      await this.resolveWin(roomId, userId, room.entry_fee);
      return { winner: userId };
    }

    // Turn transition: roll a 6 or get a capture grants another roll
    if (dice === 6 || hasCaptured) {
      boardState.phase = 'roll';
      boardState.dice = 0;
    } else {
      boardState.phase = 'roll';
      boardState.turn = isHost ? 'challenger' : 'host';
      boardState.dice = 0;
    }
    
    boardState.turnStartTime = Date.now();

    await pool.query('UPDATE ludo_rooms SET board_state = ? WHERE id = ?', [JSON.stringify(boardState), roomId]);
    
    this.io.to(`ludo_room_${roomId}`).emit('ludo:board_updated', {
      boardState,
      roomId
    });

    this.startTurnTimeout(roomId);
    this.checkTriggerBotTurn(roomId, boardState.turn, room.challenger_id);

    return { boardState };
  }

  async resolveWin(roomId, winnerId, entryFee) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rooms] = await conn.query('SELECT * FROM ludo_rooms WHERE id = ? FOR UPDATE', [roomId]);
      if (rooms[0].status !== 'playing') throw new Error('Match already resolved');

      // Fetch house edge setting
      const [settings] = await conn.query('SELECT setting_value FROM system_settings WHERE setting_key = "ludo_house_edge"');
      const houseEdge = parseFloat(settings[0]?.setting_value) || 5;

      const totalPool = parseFloat(entryFee) * 2;
      const winPayout = totalPool * (1 - houseEdge / 100);

      // If winner is bot (9999), no payout is given
      if (winnerId !== 9999) {
        await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [winPayout, winnerId]);
        await conn.query(
          'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
          [winnerId, 'game_win', winPayout, `Ludo Match Winner (Room #${roomId})`]
        );
      }

      await conn.query(
        'UPDATE ludo_rooms SET winner_id = ?, status = "completed" WHERE id = ?',
        [winnerId, roomId]
      );

      await conn.commit();

      this.io.to(`ludo_room_${roomId}`).emit('ludo:game_over', {
        winnerId,
        winPayout,
        roomId
      });

      this.clearRoomTimers(roomId);
    } catch (err) {
      await conn.rollback();
      console.error('Ludo win resolution error:', err);
    } finally {
      conn.release();
    }
  }

  startTurnTimeout(roomId) {
    this.clearRoomTimers(roomId);

    const timer = setTimeout(async () => {
      try {
        const [rooms] = await pool.query('SELECT * FROM ludo_rooms WHERE id = ?', [roomId]);
        if (rooms.length === 0 || rooms[0].status !== 'playing') return;

        const room = rooms[0];
        const boardState = typeof room.board_state === 'string' ? JSON.parse(room.board_state) : room.board_state;
        
        // Auto forfeit / pass turn
        const missedPlayer = boardState.turn;
        console.log(`Ludo Room #${roomId}: Player "${missedPlayer}" missed turn timeout`);

        boardState.missedTurns = boardState.missedTurns || { host: 0, challenger: 0 };
        boardState.missedTurns[missedPlayer] = (boardState.missedTurns[missedPlayer] || 0) + 1;

        if (boardState.missedTurns[missedPlayer] >= 3) {
          // Forfeit game
          console.log(`Ludo Room #${roomId}: Player "${missedPlayer}" forfeited by missing 3 turns`);
          const winnerId = missedPlayer === 'host' ? room.challenger_id : room.host_id;
          await this.resolveWin(roomId, winnerId, room.entry_fee);
          return;
        }

        // Pass turn
        boardState.phase = 'roll';
        boardState.turn = missedPlayer === 'host' ? 'challenger' : 'host';
        boardState.dice = 0;
        boardState.turnStartTime = Date.now();

        await pool.query('UPDATE ludo_rooms SET board_state = ? WHERE id = ?', [JSON.stringify(boardState), roomId]);
        
        this.io.to(`ludo_room_${roomId}`).emit('ludo:turn_passed', {
          boardState,
          reason: `Turn skipped! You have missed ${boardState.missedTurns[missedPlayer]}/3 turns.`
        });
        
        this.startTurnTimeout(roomId);
        this.checkTriggerBotTurn(roomId, boardState.turn, room.challenger_id);
      } catch (err) {
        console.error('Error handling turn timeout:', err);
      }
    }, 16000); // 16 seconds turn limit

    this.rooms.set(roomId, timer);
  }

  clearRoomTimers(roomId) {
    if (this.rooms.has(roomId)) {
      clearTimeout(this.rooms.get(roomId));
      this.rooms.delete(roomId);
    }
  }

  checkTriggerBotTurn(roomId, currentTurn, challengerId) {
    if (challengerId === 9999 && currentTurn === 'challenger') {
      setTimeout(() => this.executeBotTurn(roomId), 1500);
    }
  }

  async executeBotTurn(roomId) {
    try {
      const [rooms] = await pool.query('SELECT * FROM ludo_rooms WHERE id = ?', [roomId]);
      if (rooms.length === 0 || rooms[0].status !== 'playing') return;

      const room = rooms[0];
      const boardState = typeof room.board_state === 'string' ? JSON.parse(room.board_state) : room.board_state;
      if (boardState.turn !== 'challenger') return;

      // 1. Roll Dice
      const roll = Math.floor(Math.random() * 6) + 1;
      boardState.dice = roll;
      boardState.phase = 'move';
      boardState.turnStartTime = Date.now();
      
      await pool.query('UPDATE ludo_rooms SET board_state = ? WHERE id = ?', [JSON.stringify(boardState), roomId]);
      
      this.io.to(`ludo_room_${roomId}`).emit('ludo:dice_rolled', {
        roll,
        boardState,
        roomId
      });

      // 2. Select piece to move
      const hasMoves = this.checkValidMoves('challenger', boardState, roll);
      if (!hasMoves) {
        // Auto pass
        setTimeout(async () => {
          boardState.phase = 'roll';
          boardState.turn = 'host';
          boardState.dice = 0;
          boardState.turnStartTime = Date.now();

          await pool.query('UPDATE ludo_rooms SET board_state = ? WHERE id = ?', [JSON.stringify(boardState), roomId]);
          
          this.io.to(`ludo_room_${roomId}`).emit('ludo:board_updated', {
            boardState,
            roomId
          });
          this.startTurnTimeout(roomId);
        }, 1000);
        return;
      }

      // Pick piece (bot decision logic)
      setTimeout(async () => {
        const pieces = boardState.challengerPieces;
        let selectedIndex = -1;

        // Try to release on 6
        if (roll === 6) {
          selectedIndex = pieces.findIndex(pos => pos === 0);
        }

        // If no piece to release, pick a random piece that is valid to move
        if (selectedIndex === -1) {
          const validIndices = [];
          pieces.forEach((pos, idx) => {
            if (pos > 0 && pos + roll <= 58) {
              validIndices.push(idx);
            }
          });
          if (validIndices.length > 0) {
            selectedIndex = validIndices[Math.floor(Math.random() * validIndices.length)];
          }
        }

        // Fallback
        if (selectedIndex === -1) {
          selectedIndex = pieces.findIndex(pos => (pos === 0 && roll === 6) || (pos > 0 && pos + roll <= 58));
        }

        if (selectedIndex !== -1) {
          await this.movePiece(9999, roomId, selectedIndex);
        }
      }, 1000);

    } catch (err) {
      console.error('Error executing Ludo bot turn:', err);
    }
  }
}

module.exports = LudoLogic;
