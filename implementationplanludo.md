# Ludo Multiplayer — Implementation Plan

## Phase 1: Database & Schema (HIGH Priority)

### 1.1 Add Database Indexes
**Files**: `backend/src/migrations/039_ludo_indexes.js` (new)
**Changes**:
```sql
CREATE INDEX idx_rooms_status ON ludo_rooms(status);
CREATE INDEX idx_rooms_entry_fee ON ludo_rooms(entry_fee);
CREATE INDEX idx_rooms_host ON ludo_rooms(host_id);
CREATE INDEX idx_rooms_challenger ON ludo_rooms(challenger_id);
CREATE INDEX idx_rooms_status_entry ON ludo_rooms(status, entry_fee);
CREATE INDEX idx_moves_room ON ludo_moves(room_id);
CREATE INDEX idx_moves_user ON ludo_moves(user_id);
```
**Why**: Matchmaking queries (`SELECT id FROM ludo_rooms WHERE status = 'waiting' AND entry_fee = ? AND host_id != ?`) and history queries (`SELECT ... WHERE host_id = ? OR challenger_id = ?`) scan entire tables.

---

### 1.2 Replace Hardcoded Bot User ID
**File**: `backend/src/services/ludoLogic.js`
**Changes**:
- Move bot user ID (`9999`) to a config constant or system_settings lookup
- Add `_getBotUserId()` method that queries `SELECT id FROM users WHERE email = 'bot@ludoclash.com'`
- Change `ensureBotUser()` to create with a configurable email/name from env vars
- If bot user doesn't exist, `playWithBot()` should throw a clear error rather than silently using `9999`

**Edge cases**: Migration fails, bot row deleted manually, multiple bot rows.

---

## Phase 2: Game Logic Fixes (MEDIUM Priority)

### 2.1 Socket Disconnect → Auto-Forfeit
**File**: `backend/src/services/ludoLogic.js`
**Changes**:
- Add `socket.on('disconnect')` handler in `handleSocketConnection()`
- Track which room the user is in via a `socket.userRooms` Map
- On disconnect, if user is in an active `playing` room, start a 30-second grace timer
- If user reconnects within 30s (via `ludo:get_active_game`), cancel the timer
- On timer expiry, auto-forfeit with `resolveWin()`

### 2.2 Auto-Forfeit After 3 Missed Turns
**File**: `backend/src/services/ludoLogic.js` — `startTurnTimeout()` (line 698)
**Changes**:
- After incrementing `missedTurns[missedPlayer]`, check if `>= 3`
- If `>= 3`, call `resolveWin(roomId, otherPlayerId, room.entry_fee)` instead of passing turn
- Emit `ludo:game_over` with reason `Opponent missed 3 turns`

### 2.3 Remove Premature `missedTurns` Reset
**File**: `backend/src/services/ludoLogic.js`
**Changes**:
- Remove `boardState.missedTurns[currentTurn] = 0;` from `rollDice()` (line 471-472) and `movePiece()` (line 563-564)
- Only reset `missedTurns` when the turn actually completes (i.e., when switching to the other player)
- This makes the 3-miss limit actually functional

### 2.4 Room Cleanup Cron
**File**: `backend/src/cron/ludoCleanup.js` (new)
**Changes**:
- Run every 15 minutes
- `UPDATE ludo_rooms SET status = 'cancelled' WHERE status = 'waiting' AND created_at < NOW() - INTERVAL 24 HOUR`
- `UPDATE ludo_rooms SET status = 'completed', winner_id = host_id, ... WHERE status = 'playing' AND updated_at < NOW() - INTERVAL 4 HOUR AND challenger_id IS NOT NULL` (abandoned games → host wins)
- `UPDATE ludo_rooms SET status = 'cancelled' ... WHERE status = 'playing' AND updated_at < NOW() - INTERVAL 4 HOUR AND challenger_id IS NULL` (stale waiting-turned-playing rooms)

### 2.5 Simplify Board Visual (2-Player Only)
**File**: `frontend/src/views/games/ludo/LudoGame.tsx` — `renderBoardCells()`
**Changes**:
- Since it's a 2-player game (host vs challenger), simplify the board:
  - Keep only Host base (green, top-left) and Challenger base (yellow/blue, bottom-right)
  - Remove unused Blue (top-right) and Red (bottom-left) bases and their piece slots
  - Remove the unused `top-stretch` and `bottom-stretch` cells
- Alternatively, keep the 4-base aesthetic but add a 2-player disclaimer

---

## Phase 3: Refinements (LOW Priority)

### 3.1 Smarter Bot AI
**File**: `backend/src/services/ludoLogic.js` — `executeBotTurn()` (line 752)
**Changes**:
- Priority 1: If capture possible (roll lands on opponent), pick that piece
- Priority 2: Move piece that is closest to home (highest position)
- Priority 3: Avoid moving pieces to unsafe squares (not in safeZones)
- Priority 4: Release from base on 6
- Priority 5: Random valid move

### 3.2 Fix CSS Typo
**File**: `frontend/src/views/games/ludo/LudoGame.css:237`
**Changes**:
- `-webkit-text-fillColor: transparent` → `-webkit-text-fill-color: transparent`

### 3.3 TypeScript Interfaces (Frontend)
**File**: `frontend/src/views/games/ludo/LudoGame.tsx`
**Changes**:
- Define `LudoRoom`, `BoardState`, `LudoPiece`, `GameEvent` interfaces
- Replace `any` types throughout component
- Define typed socket event maps for emit/on

### 3.4 Configurable Turn Timeout
**File**: `backend/src/services/ludoLogic.js`
**Changes**:
- Read `ludo_turn_timeout` from `system_settings` table (default 16000ms)
- Fall back to hardcoded 16000 if missing
- Cache on init to avoid DB hit per turn

### 3.5 Configurable Wager Limits
**File**: `backend/src/services/ludoLogic.js` + `backend/src/routes/games/index.js`
**Changes**:
- Read `ludo_min_bet` and `ludo_max_bet` from `system_settings` instead of hardcoded `10`/`5000`
- Validate against DB values in all endpoints + socket handlers

### 3.6 Room List Pagination
**File**: `backend/src/services/ludoLogic.js` — `sendRoomsList()` + `broadcastRoomsList()`
**Changes**:
- Add `LIMIT 50` to prevent ever-growing payload
- Add optional offset/page support

---

## Rollout Order

| Step | Description | Est. Time |
|------|-------------|-----------|
| 1 | Create migration `039_ludo_indexes.js` | 5 min |
| 2 | Fix bot user ID (config + fallback + error) | 30 min |
| 3 | Add socket disconnect → auto-forfeit with grace timer | 45 min |
| 4 | Auto-forfeit after 3 missed turns + fix missedTurns reset | 20 min |
| 5 | Create room cleanup cron (`ludoCleanup.js`) | 30 min |
| 6 | Simplify board to 2-player visuals | 30 min |
| 7 | CSS typo fix | 2 min |
| 8 | Smarter bot AI | 40 min |
| 9 | TypeScript interfaces | 30 min |
| 10 | Configurable turn timeout + wager limits | 20 min |
| 11 | Room list pagination | 10 min |

**Total**: ~4.5 hours

---

## Verification

After each phase:
1. Run unit tests (if any exist)
2. Manual flow: login → find match → play to completion → verify bet history
3. Bot flow: play vs bot → verify AI moves → verify resolution + payout
4. Edge cases: disconnect mid-turn → verify auto-forfeit within 30s
5. Edge cases: AFK 3 turns → verify auto-forfeit
6. Admin: verify system_settings for `ludo_house_edge`, `ludo_min_bet`, `ludo_max_bet` apply correctly
