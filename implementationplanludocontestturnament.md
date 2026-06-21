# Ludo Tournament / Contest System — Implementation Plan

## Overview
Add tournament contests on top of the existing Ludo game. Admin creates tournaments with entry fee, prize pool, participant cap, and date window. Players join, play fixed matches (vs bots or real opponents), earn scores, and win prizes at the end.

---

## Phase 1: Database & Migration

### 1.1 Migration `042_ludo_tournaments.js`
**New tables:**

| Table | Columns | Notes |
|-------|---------|-------|
| `ludo_tournaments` | `id`, `name`, `description`, `entry_fee`, `prize_pool`, `max_participants`, `num_matches`, `admin_commission`, `status` (upcoming/active/completed/cancelled), `start_time`, `end_time`, `created_at`, `updated_at` | Core tournament definition |
| `ludo_tournament_participants` | `id`, `tournament_id` (FK), `user_id` (FK), `total_score`, `matches_played`, `best_scores` (JSON), `rank`, `prize_amount`, `joined_at` | Tracks each user's performance |
| `ludo_tournament_prizes` | `id`, `tournament_id` (FK), `rank_from`, `rank_to`, `prize_percentage` | Prize bracket configuration |

**Schema change to `ludo_rooms`:**
- Add `tournament_id INT DEFAULT NULL` column + FK to `ludo_tournaments`

---

## Phase 2: Backend Admin Routes (adminLudo.js)

### 2.1 Tournament CRUD (NEW tab in adminLudo.js)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/ludo/tournaments` | GET | List all tournaments with participant count |
| `/api/admin/ludo/tournaments` | POST | Create tournament (validates dates, fee, pool) |
| `/api/admin/ludo/tournaments/:id` | PUT | Update tournament (only if status is upcoming) |
| `/api/admin/ludo/tournaments/:id` | DELETE | Cancel tournament (refund all participants) |
| `/api/admin/ludo/tournaments/:id/process` | POST | Force prize distribution (manual trigger) |
| `/api/admin/ludo/tournaments/:id/standings` | GET | View full standings with user details |

**Validation:**
- Start time must be in the future
- End time must be after start time
- Entry fee ≥ 0
- Prize pool ≥ 0
- max_participants ≥ 2
- num_matches ≥ 1

---

## Phase 3: Backend User Routes (new `ludoTournaments.js`)

### 3.1 User-facing endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/ludo/tournaments` | GET | No | List active + upcoming tournaments |
| `/api/ludo/tournaments/:id` | GET | No | Single tournament details |
| `/api/ludo/tournaments/:id/join` | POST | Yes | Join tournament (deduct entry fee) |
| `/api/ludo/tournaments/:id/standings` | GET | No | Public leaderboard |
| `/api/ludo/tournaments/:id/my-stats` | GET | Yes | Current user's stats in this tournament |
| `/api/ludo/tournaments/joined` | GET | Yes | List tournaments the user has joined |

### 3.2 Join Flow
1. Validate tournament exists and status is `active` or `upcoming`
2. Check `max_participants` not reached
3. Check user hasn't already joined
4. Deduct `entry_fee` from user's balance → transaction log
5. Insert into `ludo_tournament_participants`
6. If tournament is `upcoming` and `start_time <= NOW()`, auto-set to `active`

---

## Phase 4: Socket Integration (ludoLogic.js)

### 4.1 Tournament Score Tracking in `resolveWin()`
After resolving a match win in `resolveWin(roomId, winnerId, entryFee)`:
1. Check if the `ludo_rooms` row has `tournament_id IS NOT NULL`
2. If yes, calculate the **winner's score** from the final board state:
   ```
   score = sum of piece positions
   piece at home (pos=58) → 100
   piece on track (pos=1-52) → pos value
   piece in base (pos=0) → 0
   ```
3. Also calculate **loser's score** (for their tournament record)
4. Update `ludo_tournament_participants`:
   - Increment `matches_played`
   - Append score to `best_scores` JSON array
   - Recalculate `total_score` = sum of best N scores where N = `num_matches` from tournament

### 4.2 Tournament Context in Room Creation
When a player joins a tournament and clicks "Find Match" or "Play Bot":
- Pass `tournament_id` along with the room creation
- Store in `ludo_rooms.tournament_id`
- Show "Tournament Match X/Y" in the game UI

---

## Phase 5: Tournament Finalization (cron)

### 5.1 Auto-finalize in `ludoCleanup.js`
Every 5 minutes (new interval):
1. Query: `SELECT * FROM ludo_tournaments WHERE status = 'active' AND end_time <= NOW()`
2. For each ended tournament:
   a. Set status = `completed`
   b. Get all participants ordered by `total_score DESC`
   c. Assign ranks
   d. Calculate prize amounts based on `ludo_tournament_prizes` + participant count
   e. Credit winners' balances
   f. Log transactions

### 5.2 Prize Distribution Logic
```
Net prize pool = prize_pool × (1 - admin_commission/100)
For each prize bracket (rank_from to rank_to):
  bracket_share = net_prize_pool × (prize_percentage / 100)
  per_person = bracket_share / (rank_to - rank_from + 1)
```

### 5.3 Auto-start tournaments
Every 5 minutes, also check:
- `SELECT * FROM ludo_tournaments WHERE status = 'upcoming' AND start_time <= NOW()`
- Set status = `active`

---

## Phase 6: Frontend — AdminLudo.tsx (Tournaments Tab)

### 6.1 Tournaments List
- Table: ID, Name, Entry Fee, Prize Pool, Participants, Status, Dates, Actions
- Status badges: Upcoming (blue), Active (green), Completed (grey), Cancelled (red)
- Actions: Edit (upcoming only), Cancel with refund, Process (force finalize), View Standings

### 6.2 Create/Edit Tournament Form
- Name, Description
- Entry Fee (₹), Prize Pool (₹)
- Max Participants, Num Matches per Player
- Admin Commission %
- Start Time, End Time (datetime pickers)

### 6.3 Prize Brackets Editor
- Dynamic rows: Rank From, Rank To, Prize %
- Auto-fill default brackets button
- Percentage must sum to ≤ 100

### 6.4 Standings Modal
- Full leaderboard: Rank, User Name, Score, Matches Played, Prize Amount

---

## Phase 7: Frontend — LudoGame.tsx (Tournament UI)

### 7.1 Tournament Lobby Section
- **Tournaments tab** alongside existing lobby UI
- Cards showing: Tournament name, entry fee, prize pool, participant count, time remaining
- "Join Now" button → enters tournament
- "My Tournaments" section showing joined tournaments with rank and score

### 7.2 Tournament Gameplay Overlay
When playing a match within a tournament:
- Small banner: "🎯 Tournament Match 3/5"
- Score display enhanced: "Your Score: 284 pts | Tournament Rank: #4"
- "Current Prize: ₹150" indicator

### 7.3 Tournament Standings (Public)
- Live leaderboard accessible from tournament card
- Shows top 20 with current user's rank highlighted
- Auto-refreshes every 30s

### 7.4 Tournament Results
- After tournament ends, show result card with final rank and prize won
- Link to view full standings

---

## Phase 8: Prize Brackets Lookup Table

### Default Brackets (auto-created per tournament)

| Participants | 1st | 2nd | 3rd | 4th-5th | 6th-10th | 11th-20th | 21st+ |
|-------------|-----|-----|-----|---------|----------|-----------|-------|
| 2-10 | 50% | 30% | 20% | - | - | - | - |
| 11-20 | 35% | 25% | 15% | 5% each | 2% each | - | - |
| 21-50 | 30% | 20% | 12% | 5% each | 3% each | 1% each | - |
| 51-100 | 25% | 15% | 10% | 4% each | 2% each | 1% each | 0.5% each |
| 101+ | 20% | 12% | 8% | 3% each | 2% each | 1% each | 0.5% each |

---

## Phase 9: API Client (api.ts)

Add to `gamesAPI` object:
```typescript
getLudoTournaments: () => request('GET', '/ludo/tournaments'),
getLudoTournament: (id: number) => request('GET', `/ludo/tournaments/${id}`),
joinLudoTournament: (id: number) => request('POST', `/ludo/tournaments/${id}/join`),
getLudoTournamentStandings: (id: number) => request('GET', `/ludo/tournaments/${id}/standings`),
getMyLudoTournamentStats: (id: number) => request('GET', `/ludo/tournaments/${id}/my-stats`),
getMyJoinedLudoTournaments: () => request('GET', '/ludo/tournaments/joined'),
```

---

## Rollout Order

| Step | Description | Est. Time |
|------|-------------|-----------|
| 1 | Migration `042_ludo_tournaments.js` | 15 min |
| 2 | Admin tournament routes in `adminLudo.js` (CRUD + standings + prizes) | 60 min |
| 3 | User tournament routes in new `ludoTournaments.js` | 30 min |
| 4 | Socket integration in `ludoLogic.js` (score tracking on resolveWin) | 30 min |
| 5 | Tournament finalization + auto-start in `ludoCleanup.js` | 30 min |
| 6 | Register routes in `server.js` + `api.ts` | 5 min |
| 7 | AdminLudo.tsx — Tournaments tab frontend | 60 min |
| 8 | LudoGame.tsx — Tournament lobby + gameplay UI | 90 min |
| 9 | LudoGame.css — Tournament styles | 30 min |
| 10 | Test: admin creates tournament → user joins → plays → finalize | 20 min |

**Total**: ~6 hours

---

## What stays unchanged
- **All existing Ludo game logic**: board rendering, dice rolling, piece movement, bot AI, matchmaking, room management, disconnect handling, turn timeouts, auto-forfeit — **untouched**
- **Existing admin pages**: Manage Games, System Settings, Game Bots — **untouched**
- **Existing Ludo CSS**: All styles remain — tournament styles are additions only
- **Existing API endpoints**: All `/games/ludo/*` routes remain — tournament uses new `/ludo/tournaments/*` path
