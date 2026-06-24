# 🏏 Cricket Fantasy Game — Bugs & Issues Audit

> **Scope:** Full-stack audit of the fantasy cricket subsystem — backend routes, cron engine, API service, database schema, and React frontend.  
> **Date:** 2026-06-24  
> **Project:** Digital_Viser

---

## 🔴 Critical Bugs (Must Fix)

---

### BUG-F01: `prize_won DEFAULT 0.00` prevents refund/distribution guards from working

**Files:**
- `backend/migrations/037_fantasy_cricket_schema.js` — Line 128
- `backend/src/cron/fantasyCricketCron.js` — Line 263
- `backend/src/routes/adminFantasy.js` — Line 227

**Description:**  
The schema defines `prize_won DECIMAL(10,2) DEFAULT 0.00`, but the cron and admin refund logic filters entries with `WHERE prize_won IS NULL`. Since `DEFAULT 0.00` means the column is **never** `NULL`, these guards **never match any rows** — meaning:

- **Refunds for abandoned matches are silently skipped** — no user ever gets refunded.
- **Refunds for cancelled contests are silently skipped.**
- Entries that have already been paid a prize can be paid again on retries.

**Impact:** Users permanently lose money when matches are abandoned or contests are cancelled.

**Fix:** Change the schema default to `DEFAULT NULL` (via a new migration) and update the INSERT in `fantasy.js` contest-join to not specify `prize_won`, OR change all `WHERE prize_won IS NULL` clauses to `WHERE (prize_won IS NULL OR prize_won = 0)`.

```sql
-- New migration to fix:
ALTER TABLE fantasy_contest_entries MODIFY COLUMN prize_won DECIMAL(10,2) DEFAULT NULL;
UPDATE fantasy_contest_entries SET prize_won = NULL WHERE prize_won = 0.00;
```

---

### BUG-F02: Edit Team flow is broken — `selectedPlayers` is emptied

**File:** `frontend/src/views/games/cricket/CricketGame.tsx` — Lines 182–193

**Code:**
```typescript
const openEditTeam = (team: any) => {
  setEditingTeamId(team.id);
  setCaptainId(team.captain_player_id);
  setViceCaptainId(team.vice_captain_player_id);
  setSelectedPlayers([]); // ← BUG: EMPTIES the player list
  setTeamSelectionPhase('pick_captain'); // jumps to C/VC selection
  setViewState('create_team');
};
```

**Description:**  
When a user clicks "Edit" on their team, `selectedPlayers` is cleared to `[]`. The captain/VC selection screen then iterates `selectedPlayers.map(...)` — which renders **nothing**. The user sees an empty list and cannot actually change their captain or vice-captain.

**Root Cause:** The team's player list (`fantasy_team_players`) is never fetched from the backend. The comment on line 190 says `// Would need team_players fetch`.

**Impact:** Team editing is completely non-functional. Users must delete and recreate teams.

**Fix:**
1. Add a backend endpoint to fetch a team's players:
   ```javascript
   // In fantasy.js
   router.get('/team/:id/players', async (req, res) => {
     const [players] = await pool.query(
       'SELECT player_id FROM fantasy_team_players WHERE team_id = ?',
       [req.params.id]
     );
     res.json(players.map(p => p.player_id));
   });
   ```
2. In the frontend `openEditTeam`, fetch and populate `selectedPlayers` before switching views:
   ```typescript
   const openEditTeam = async (team: any) => {
     const playerIds = await fantasyAPI.getTeamPlayers(team.id);
     setSelectedPlayers(playerIds);
     setCaptainId(team.captain_player_id);
     setViceCaptainId(team.vice_captain_player_id);
     setEditingTeamId(team.id);
     setTeamSelectionPhase('pick_captain');
     setViewState('create_team');
   };
   ```

---

### BUG-F03: Contest join has redundant + conflicting duplicate-entry guards

**File:** `backend/src/routes/fantasy.js` — Lines 268–283

**Code:**
```javascript
// Check 1: Hard block (line 270-273) — always prevents more than 1 entry
const [entries] = await conn.query(
  'SELECT id FROM fantasy_contest_entries WHERE user_id = ? AND contest_id = ?',
  [userId, contestId]
);
if (entries.length > 0) throw new Error('You have already joined this contest');

// Check 2: max_entries_per_user (line 276-283) — UNREACHABLE when maxEntries=1
const [existingEntries] = await conn.query(
  'SELECT COUNT(*) as cnt FROM fantasy_contest_entries WHERE user_id = ? AND contest_id = ?',
  [userId, contestId]
);
const maxEntries = contest.max_entries_per_user || 1;
if (existingEntries[0].cnt >= maxEntries) {
  throw new Error(`Maximum ${maxEntries} entries allowed per user in this contest`);
}
```

**Description:**  
The first check **always blocks** any user from joining the same contest twice, regardless of `max_entries_per_user`. If `max_entries_per_user` is set to e.g. 3, users **still cannot join more than once** because Check 1 fires first and throws.

**Impact:** The `max_entries_per_user` feature is completely broken — multi-entry contests are impossible.

**Fix:** Remove Check 1 (lines 268–273) entirely. Rely solely on the `max_entries_per_user` guard (Check 2), which is the correct, flexible implementation.

---

### BUG-F04: Captain/VC ID type mismatch — `number` vs `string` comparison

**File:** `backend/src/routes/fantasy.js` — Lines 67–68 and 184–185

**Description:**  
The team creation route (POST) receives `playerIds`, `captainId`, and `viceCaptainId` from `req.body` as JSON. The edit route (PUT) reads player IDs from the database:

```javascript
// PUT /team/:id — Edit route
const playerIds = teamPlayers.map(tp => tp.player_id); // DB returns INT
if (!playerIds.includes(captainId) || !playerIds.includes(viceCaptainId))
  // captainId from req.body could be a STRING "5"
```

If the client sends `captainId` as a string `"5"` and the DB returns integers `[5, 6, 7...]`, `Array.includes` with strict equality fails silently:
```javascript
[5].includes("5") // === false
```

The user gets an error "Captain and Vice-Captain must be among your selected players" even though they picked a valid player.

**Impact:** Team editing may fail silently or with misleading error messages.

**Fix:** Coerce IDs to numbers at the top of both routes:
```javascript
const captainId = Number(req.body.captainId);
const viceCaptainId = Number(req.body.viceCaptainId);
const playerIds = (req.body.playerIds || []).map(Number);
```

---

### BUG-F05: `distributePrizes()` doesn't SELECT `fee_paid` — non-guaranteed refunds are ₹0

**File:** `backend/src/cron/fantasyCricketCron.js` — Lines 303–309 and 349

**Code:**
```javascript
// Line 303: SELECT query
const [entries] = await conn.query(`
  SELECT ce.id, ce.user_id, ce.team_id, ut.team_rank, ut.total_points
  -- ❌ MISSING: ce.fee_paid
  FROM fantasy_contest_entries ce
  JOIN fantasy_user_teams ut ON ce.team_id = ut.id
  WHERE ce.contest_id = ?
  ORDER BY ut.team_rank ASC
`, [contest.id]);

// Line 349: Attempted refund for non-guaranteed contests
const fee = parseFloat(entry.fee_paid || 0); // fee_paid is UNDEFINED → always 0
```

**Description:**  
The prize distribution query does **not** select `ce.fee_paid`. When refunding non-guaranteed contests that didn't fill minimum spots, `entry.fee_paid` is `undefined`, so `parseFloat(undefined || 0)` = `0`. Users get refunded ₹0.

**Impact:** Users permanently lose their entry fees when a non-guaranteed contest doesn't fill.

**Fix:** Add `ce.fee_paid` to the SELECT:
```javascript
const [entries] = await conn.query(`
  SELECT ce.id, ce.user_id, ce.team_id, ce.fee_paid, ut.team_rank, ut.total_points
  FROM fantasy_contest_entries ce
  JOIN fantasy_user_teams ut ON ce.team_id = ut.id
  WHERE ce.contest_id = ?
  ORDER BY ut.team_rank ASC
`, [contest.id]);
```

---

## 🟠 Important Issues

---

### ISSUE-F01: Scoring engine ignores 11 out of 18 configured point rules

**File:** `backend/src/cron/fantasyCricketCron.js` — Lines 170–179

**Description:**  
The database seeds 18 scoring rules in the `fantasy_point_system` table, but the live scoring engine only applies **7 of 18**:

| ✅ Applied (7) | ❌ Ignored (11) |
|---|---|
| `run` (+1), `boundary` (+1), `six` (+2), `wicket` (+25), `catch` (+8), `half_century` (+8), `century` (+16), `duck` (-2) | `lbw_bowled` (+8), `three_wickets` (+4), `four_wickets` (+8), `five_wickets` (+16), `maiden_over` (+12), `three_catches` (+4), `stumping` (+12), `run_out_direct` (+12), `run_out_thrower` (+6), `run_out_catcher` (+6) |

**Impact:** Players see these bonus rules advertised in "How to Play" (line 656 of CricketGame.tsx) and in the admin Scoring tab, but they never actually trigger. This creates false expectations and makes scoring less interesting.

**Fix:** Add the missing calculations after the existing scoring block:
```javascript
// Wicket hauls
if (s.wickets >= 5) calculatedPoints += (pointsConfig['five_wickets'] || 16);
else if (s.wickets >= 4) calculatedPoints += (pointsConfig['four_wickets'] || 8);
else if (s.wickets >= 3) calculatedPoints += (pointsConfig['three_wickets'] || 4);

// 3-catch bonus
if (s.catches >= 3) calculatedPoints += (pointsConfig['three_catches'] || 4);

// Fielding bonuses
calculatedPoints += (s.stumpings || 0) * (pointsConfig['stumping'] || 12);
calculatedPoints += (s.runOuts || 0) * (pointsConfig['run_out_direct'] || 12);
calculatedPoints += (s.maidenOvers || 0) * (pointsConfig['maiden_over'] || 12);
```

---

### ISSUE-F02: API scorecard parser doesn't extract enough stats for bonus rules

**File:** `backend/src/services/fantasyApi.js` — Lines 186–228

**Description:**  
Even if ISSUE-F01 is fixed, the CricAPI scorecard parser doesn't extract:
- Maiden overs (available in bowling data)
- LBW/bowled dismissal types (available in `dismissal` field)
- Stumping stats
- Run-out details (direct hit vs thrower vs catcher)
- Dot balls

The stats object always hardcodes these to zero:
```javascript
dotBalls: 0, maidenOvers: 0, runOuts: 0, stumpings: 0
```

**Impact:** Even after fixing the scoring engine (ISSUE-F01), these bonus points will never be awarded because the data is never parsed from the API response.

**Fix:** Parse these fields from the CricAPI scorecard response. The `bowling` array typically includes maiden overs (`m` field), and dismissals include type information.

---

### ISSUE-F03: Team rank stored per-team, not per-contest — wrong for multi-contest entries

**File:** `backend/src/cron/fantasyCricketCron.js` — Lines 236–247

**Description:**  
The rank recalculation writes `team_rank` to the `fantasy_user_teams` table:
```sql
UPDATE fantasy_user_teams ut ... SET ut.team_rank = ranked.rnk
```

`fantasy_user_teams.team_rank` is a **single column**. If a user enters the same team into two different contests:
- Contest A (2 entries): User is rank #1
- Contest B (100 entries): User is rank #50

Whichever contest is processed last overwrites the rank. The stored value is non-deterministic.

**Impact:** Users see incorrect ranks. Prize distribution could use wrong ranks in edge cases.

**Fix:** Move `team_rank` to `fantasy_contest_entries` table, or use a per-contest ranking approach.

---

### ISSUE-F04: `_processingMatches` concurrency guard has a leak/clear-all bug

**File:** `backend/src/cron/fantasyCricketCron.js` — Lines 128–209

**Description:**  
If `processLiveMatches()` throws during the for-loop (e.g., on match #2 out of 3), the catch block clears **all** processing markers:
```javascript
catch (err) {
  this._processingMatches.clear(); // ← Clears ALL, not just the failed one
}
```

Matches processed before the error have already advanced state (updated scores, triggered prizes). Clearing their processing markers means the next cron run could try to reprocess them, potentially double-awarding prizes.

**Fix:** Use `try/catch` inside the for-loop per match, and only delete the specific match's marker on error.

---

### ISSUE-F05: No rate limiting on fantasy endpoints

**File:** `backend/src/server.js` — Line 275

```javascript
app.use('/api/fantasy', require('./middleware/auth'), fantasyRoutes);
// No rate limiter applied (unlike /api/auth/login, /api/spin/claim, etc.)
```

**Impact:** A malicious user could spam team creation or contest joining at high volume, causing excessive DB queries with `FOR UPDATE` row locks and potentially overwhelming the database.

**Fix:** Add a rate limiter:
```javascript
const fantasyLimiter = rateLimit({ windowMs: 60000, max: 30, ... });
app.use('/api/fantasy', fantasyLimiter, require('./middleware/auth'), fantasyRoutes);
```

---

### ISSUE-F06: Admin match deletion doesn't use a transaction

**File:** `backend/src/routes/adminFantasy.js` — Lines 77–89

**Description:**  
The delete-match route runs 6 sequential `DELETE` queries without a transaction:
```javascript
await pool.query('DELETE FROM fantasy_contest_entries ...');  // Query 1
await pool.query('DELETE FROM fantasy_contests ...');         // Query 2
await pool.query('DELETE FROM fantasy_team_players ...');     // Query 3 ← fails here?
await pool.query('DELETE FROM fantasy_user_teams ...');       // Query 4 ← never runs
await pool.query('DELETE FROM fantasy_match_players ...');    // Query 5 ← never runs
await pool.query('DELETE FROM fantasy_matches ...');          // Query 6 ← never runs
```

**Impact:** If any query fails mid-way, earlier deletions are already committed. This leaves orphaned data with broken foreign key references.

**Fix:** Wrap in a transaction:
```javascript
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  // ... all 6 deletes using conn.query() ...
  await conn.commit();
} catch (err) {
  await conn.rollback();
  throw err;
} finally {
  conn.release();
}
```

---

### ISSUE-F07: Admin contest update has zero validation

**File:** `backend/src/routes/adminFantasy.js` — Lines 183–194

**Description:**  
The `PUT /admin/fantasy/contests/:id` route directly writes all request body fields to the database without any validation. Compare with the `POST` route (lines 150–180) which validates `fee > 0`, `spots >= 2`, `commission 0-100`, etc.

**Impact:** An admin could accidentally set `entry_fee = -1`, `total_spots = 0`, or `admin_commission_pct = 500`, breaking the entire contest flow.

**Fix:** Apply the same validation as the POST route before executing the UPDATE.

---

## 🟡 Medium Issues

---

### ISSUE-F08: Leaderboard "You" highlighting is broken

**Files:**
- `backend/src/routes/fantasy.js` — Lines 338–347
- `frontend/src/views/games/cricket/CricketGame.tsx` — Line 584

**Description:**  
The leaderboard SQL query:
```sql
SELECT ce.id, u.name, ut.total_points, ROW_NUMBER()..., ce.prize_won
```
Does **not** select `ce.user_id`. The frontend checks:
```tsx
e.user_id === user?.id ? 'cric-lb-mine' : ''
```
Since `e.user_id` is always `undefined`, the current user's row is never highlighted.

**Fix:** Add `ce.user_id` to the SELECT:
```sql
SELECT ce.id, ce.user_id, u.name, ut.total_points, ...
```

---

### ISSUE-F09: Global entries fetch for per-match "joined" check

**File:** `frontend/src/views/games/cricket/CricketGame.tsx` — Lines 72–81

**Description:**  
To determine which contests the user has already joined for the current match, the frontend fetches **every** contest entry the user has ever made across all matches:
```typescript
const entries = await fantasyAPI.getMyEntries(); // ALL entries, ALL matches
entries.forEach((e: any) => {
  if (e.contest_id) joined.add(e.contest_id);
});
```

**Impact:** For an active user with hundreds of entries, this is wasteful, slow, and transfers unnecessary data.

**Fix:** Add a query parameter to filter by match ID, or create a dedicated endpoint `GET /fantasy/match/:id/my-entries`.

---

### ISSUE-F10: Status badge CSS selectors don't match generated class names

**Files:**
- `frontend/src/views/games/cricket/CricketGame.css` — Lines 318–320
- `frontend/src/views/games/cricket/CricketGame.tsx` — Lines 320, 386

**CSS:**
```css
.cric-status-badge.upcoming { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
.cric-status-badge.live { ... }
.cric-status-badge.completed { ... }
```

**TSX generated class:**
```tsx
className={`cric-status-badge cric-status-${m.status}`}
// Produces: "cric-status-badge cric-status-upcoming"
```

**Description:**  
CSS expects `.cric-status-badge.upcoming` (which matches `class="cric-status-badge upcoming"`), but the TSX generates `cric-status-upcoming` (with the `cric-status-` prefix). These selectors **do not match**.

**Impact:** All status badges (Upcoming, Live, Completed) have no color styling — they appear unstyled.

**Fix:** Either change CSS selectors to match:
```css
.cric-status-badge.cric-status-upcoming { ... }
.cric-status-badge.cric-status-live { ... }
.cric-status-badge.cric-status-completed { ... }
```
Or change the TSX to not use the prefix:
```tsx
className={`cric-status-badge ${m.status}`}
```

---

### ISSUE-F11: Admin Fantasy contest dropdown is empty unless Matches tab visited first

**File:** `frontend/src/views/admin/AdminFantasy.tsx` — Lines 69–90

**Description:**  
The `fetchData()` function only loads `matches` when `activeTab === 'matches'`:
```typescript
if (activeTab === 'matches') {
  const data = await adminRequest('GET', '/admin/fantasy/matches');
  setMatches(data);
} else if (activeTab === 'contests') {
  // matches are NOT fetched here
}
```

The contest creation form uses `matches` for the match dropdown. If the admin navigates directly to the Contests tab, the dropdown is empty and contests can't be created.

**Fix:** Always fetch matches alongside contests:
```typescript
} else if (activeTab === 'contests') {
  const [contestData, matchData] = await Promise.all([
    adminRequest('GET', '/admin/fantasy/contests'),
    adminRequest('GET', '/admin/fantasy/matches')
  ]);
  setContests(contestData);
  setMatches(matchData);
}
```

---

### ISSUE-F12: Dead API methods in frontend (`settleMatch`, `cancelMatch`)

**File:** `frontend/src/api.ts` — Lines 208–213

```typescript
export const adminFantasyAPI = {
  settleMatch: (matchId: string) => adminRequest('POST', `/admin/fantasy/matches/${matchId}/settle`),
  cancelMatch: (matchId: string) => adminRequest('POST', `/admin/fantasy/matches/${matchId}/cancel`),
};
```

**Description:**  
These two backend endpoints do not exist. Any call to `settleMatch` or `cancelMatch` will return a 404 error. Additionally, the `AdminFantasy.tsx` component doesn't use `adminFantasyAPI` at all — it calls `adminRequest()` directly.

**Impact:** Dead code that could confuse developers. If someone wires these up in the UI, they'll silently fail.

**Fix:** Either remove the dead methods or implement the corresponding backend routes.

---

### ISSUE-F13: No live-score auto-refresh on the frontend

**File:** `frontend/src/views/games/cricket/CricketGame.tsx`

**Description:**  
When viewing a live match, scores and leaderboard positions are only updated when the user manually clicks the refresh button. There is no `setInterval`, polling, or WebSocket subscription to auto-update live data.

**Impact:** For a fantasy cricket game with live scoring, users must constantly click refresh to see updated scores and rankings — poor UX for a "live" experience.

**Fix:** Add a polling interval when viewing a live match:
```typescript
useEffect(() => {
  if (viewState === 'match_details' && selectedMatch?.status === 'live') {
    const interval = setInterval(refreshMatchDetails, 30000); // 30s
    return () => clearInterval(interval);
  }
}, [viewState, selectedMatch?.status]);
```

---

### ISSUE-F14: React useEffect has unstable `fetchMatches` dependency

**File:** `frontend/src/views/games/cricket/CricketGame.tsx` — Lines 39–41

```typescript
useEffect(() => {
  fetchMatches(); // fetchMatches is recreated every render
}, [matchFilter]);
```

**Description:**  
`fetchMatches` is not wrapped in `useCallback` but is called inside a `useEffect` that depends on `matchFilter`. While this works correctly in practice (because `matchFilter` is the trigger), it's a React anti-pattern. The ESLint `exhaustive-deps` rule would flag this.

**Fix:** Wrap `fetchMatches` with `useCallback`:
```typescript
const fetchMatches = useCallback(async () => {
  // ...
}, [matchFilter]);
```

---

## 🔵 Low Priority / Technical Debt

---

### DEBT-F01: Excessive use of `any` type throughout the frontend

**File:** `frontend/src/views/games/cricket/CricketGame.tsx`

Every state variable uses `any[]` or `any`:
```typescript
const [matches, setMatches] = useState<any[]>([]);
const [selectedMatch, setSelectedMatch] = useState<any>(null);
const [squad, setSquad] = useState<any[]>([]);
```

**Impact:** No compile-time type safety. Typos in property names (e.g., `m.statsu` instead of `m.status`) are not caught.

**Fix:** Define TypeScript interfaces for `FantasyMatch`, `FantasyPlayer`, `FantasyContest`, `FantasyTeam`, etc.

---

### DEBT-F02: Inline `<style>` tags conflict with external CSS file

**File:** `frontend/src/views/games/cricket/CricketGame.tsx` — Lines 694–727

The dialog overlay styles are defined both in `CricketGame.css` (lines 740–763) and inline in the TSX `<style>` block with **different values**:

| Property | CSS File | Inline Style |
|---|---|---|
| `.cric-dialog-overlay` align-items | `flex-end` | `center` |
| `.cric-dialog` border-radius | `20px 20px 0 0` | `12px` |

The inline styles override the external CSS, making the CSS file's rules dead code.

**Fix:** Remove the inline `<style>` block and use only the external CSS file (or vice versa).

---

### DEBT-F03: Mock data is exposed to real users when no API key is configured

**File:** `backend/src/services/fantasyApi.js` — Lines 250–340

When no CricAPI key is configured, the service returns mock matches with hardcoded IPL teams ("Mumbai Indians vs Chennai Super Kings") and fake player names. These appear as real matches to users.

**Fix:** Either disable the fantasy feature entirely when no API key is set, or clearly label mock data as demo content.

---

### DEBT-F04: Internal properties `_squads` and `_generatedAt` leak in mock scorecard responses

**File:** `backend/src/services/fantasyApi.js` — Lines 381–387

```javascript
const scorecard = {
  status: 'live',
  players,
  _squads: squads,         // ← internal data leaked
  _generatedAt: Date.now() // ← internal timestamp leaked
};
```

**Impact:** Wastes bandwidth and exposes implementation details in API responses.

**Fix:** Store `_squads` and `_generatedAt` separately from the returned response, or strip them before returning.

---

### DEBT-F05: Scratch/temp debug files committed to repository

**Files in `backend/` root:**
- `scratch_cleanup_schemes.js`
- `scratch_delete_scheme.js`
- `scratch_diagnose_transactions.js`
- `scratch_insert_scheme.js`
- `scratch_test_interest.js`
- `temp_update.js`
- `query_db.js`
- `update_date.js`

**Impact:** Clutters the repo. Some scripts contain raw SQL queries that could be accidentally executed.

**Fix:** Remove from the repository and add to `.gitignore`.

---

## 📋 Summary Table

| ID | Severity | Component | Title | Status |
|---|---|---|---|---|
| BUG-F01 | 🔴 Critical | DB/Cron | `prize_won DEFAULT 0.00` breaks all refund/prize IS NULL guards | Open |
| BUG-F02 | 🔴 Critical | Frontend | Edit team empties player list — C/VC edit is non-functional | Open |
| BUG-F03 | 🔴 Critical | Backend | Redundant duplicate-entry check blocks `max_entries_per_user > 1` | Open |
| BUG-F04 | 🔴 Critical | Backend | Type mismatch on captain/VC ID comparison (string vs number) | Open |
| BUG-F05 | 🔴 Critical | Cron | `distributePrizes` doesn't SELECT `fee_paid` — refunds are always ₹0 | Open |
| ISSUE-F01 | 🟠 Important | Cron | 11/18 scoring rules not implemented in live engine | Open |
| ISSUE-F02 | 🟠 Important | API | Scorecard parser doesn't extract enough stats for bonus rules | Open |
| ISSUE-F03 | 🟠 Important | Cron | Team rank stored per-team, not per-contest — wrong for multi-contest | Open |
| ISSUE-F04 | 🟠 Important | Cron | `_processingMatches` guard clears all on single error | Open |
| ISSUE-F05 | 🟠 Important | Security | No rate limiting on fantasy API endpoints | Open |
| ISSUE-F06 | 🟠 Important | Admin | Match deletion not transactional — partial deletes possible | Open |
| ISSUE-F07 | 🟠 Important | Admin | Contest update has zero validation | Open |
| ISSUE-F08 | 🟡 Medium | Frontend/API | Leaderboard "You" highlighting broken (missing `user_id`) | Open |
| ISSUE-F09 | 🟡 Medium | Frontend | Global entries fetch for per-match joined check | Open |
| ISSUE-F10 | 🟡 Medium | CSS | Status badge CSS selectors don't match generated class names | Open |
| ISSUE-F11 | 🟡 Medium | Admin | Contest dropdown empty when Matches tab not visited first | Open |
| ISSUE-F12 | 🟡 Medium | Frontend | Dead API methods (`settleMatch`, `cancelMatch`) | Open |
| ISSUE-F13 | 🟡 Medium | Frontend | No live-score auto-refresh for live matches | Open |
| ISSUE-F14 | 🟡 Medium | Frontend | React useEffect has unstable dependency | Open |
| DEBT-F01 | 🔵 Low | Frontend | Excessive `any` types — no TypeScript interfaces | Open |
| DEBT-F02 | 🔵 Low | Frontend | Duplicate/conflicting inline vs external CSS | Open |
| DEBT-F03 | 🔵 Low | Backend | Mock data visible in production if no API key set | Open |
| DEBT-F04 | 🔵 Low | Backend | Internal properties leaked in mock scorecard response | Open |
| DEBT-F05 | 🔵 Low | Repo | Scratch/temp debug scripts committed to repository | Open |

---

## 🔧 Recommended Fix Priority

1. **BUG-F01** — Fix `prize_won` default (data loss / financial bug)
2. **BUG-F05** — Add `fee_paid` to SELECT (financial bug)
3. **BUG-F03** — Remove duplicate entry check (feature-breaking)
4. **BUG-F04** — Type coercion for IDs (silent validation failure)
5. **BUG-F02** — Implement team player fetch for edit flow (UX-breaking)
6. **ISSUE-F10** — Fix CSS selectors (visual bug)
7. **ISSUE-F08** — Add `user_id` to leaderboard query (UX bug)
8. **ISSUE-F06** — Wrap match deletion in transaction (data integrity)
9. **ISSUE-F01** — Implement remaining scoring rules (feature completeness)
10. **ISSUE-F05** — Add rate limiting (security)
