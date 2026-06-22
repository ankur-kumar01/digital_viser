# 🐛 Digital_Viser — Complete Bugs & Issues Report

> **Generated:** 2026-06-22 | **Codebase Version:** `c0501be` (post-commit)
> **Scope:** Full-stack audit — Backend (Node.js/Express/MySQL) + Frontend (React/TypeScript/Vite)

---

## Table of Contents

1. [🔴 Critical Bugs](#1--critical-bugs)
2. [🟠 High-Severity Issues](#2--high-severity-issues)
3. [🟡 Medium-Severity Issues](#3--medium-severity-issues)
4. [🔵 Low-Severity / Code Quality Issues](#4--low-severity--code-quality-issues)
5. [⚡ Performance Bottlenecks](#5--performance-bottlenecks)
6. [🔒 Security Vulnerabilities](#6--security-vulnerabilities)
7. [📦 Technical Debt](#7--technical-debt)

---

## 1. 🔴 Critical Bugs

---

### BUG-001 — Fantasy Contest Join: Undefined `balance` Variable

**File:** `backend/src/routes/fantasy.js` — Line 319
**Severity:** 🔴 Critical

**Description:**
In the `POST /contest/join` route, the success response references an undefined variable `balance` that was never declared in scope.

```js
// Line 319 — BUG: `balance` is undefined here
res.json({ success: true, message: 'Joined contest successfully!', newBalance: balance - fee });
```

The actual balance variable in scope is `mainBalance` or `gamingBonus`. This will throw a `ReferenceError` on every successful contest join, causing the entire request to fail even though the database transaction was already committed.

**Impact:** Users cannot join fantasy contests. The transaction is committed (money deducted, entry recorded) but the server crashes with a `500` before sending a response — leaving the user in a confused state with no confirmation.

**Fix:**
```js
// Replace:
res.json({ success: true, message: 'Joined contest successfully!', newBalance: balance - fee });
// With:
const newBalance = walletField === 'gaming_bonus_balance' ? (gamingBonus - fee) : (mainBalance - fee);
res.json({ success: true, message: 'Joined contest successfully!', newBalance });
```

---

### BUG-002 — Fantasy `GET /matches` Returns Wrong Format for Multi-Status Query

**File:** `backend/src/routes/fantasy.js` — Lines 10–18
**Severity:** 🔴 Critical

**Description:**
When `statusParam` contains commas (multi-status query), the code assigns the result of `pool.query()` directly to `matches` without destructuring:

```js
// Line 13 — BUG: pool.query returns [rows, fields], not rows directly
matches = await pool.query(`SELECT * FROM fantasy_matches WHERE status IN (${placeholders}) ORDER BY start_time ASC`, statuses);
```

This causes `matches` to be a `[rows, fields]` array instead of just the rows array.

**Fix:**
```js
const [rows] = await pool.query(`SELECT * FROM fantasy_matches WHERE status IN (${placeholders}) ORDER BY start_time ASC`, statuses);
matches = rows;
```

---

### BUG-003 — Ludo Cancel-Room Refund Always Returns to `balance`, Ignoring Bonus Wallet

**File:** `backend/src/services/ludoLogic.js` — Line 367
**Severity:** 🔴 Critical

**Description:**
When a room is cancelled, the refund always goes to the user's `balance` column, even if the entry fee was originally deducted from `gaming_bonus_balance`.

```js
// Line 367 — Always refunds to 'balance', regardless of which wallet was used
await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [room.entry_fee, hostId]);
```

**Impact:** Users who paid from bonus balance get their refund in the wrong (main) wallet. Gaming bonus funds are effectively inflated.

**Fix:** Add a `wallet_used` column to `ludo_rooms`, populate it on creation, and use it during refund.

---

### BUG-004 — `asyncHandler` Utility Defined but Never Used in Routes

**File:** `backend/src/utils.js` — Lines 35–38
**Severity:** 🔴 Critical (silent, systemic)

**Description:**
The `asyncHandler` wrapper was created specifically to pass Express async errors to the global error handler (because Express 4.x does not catch rejected promises automatically). However, **none of the route handlers use it** — they all use raw `async (req, res) =>` callbacks.

This means any uncaught promise rejection inside route handlers will NOT be caught by the global error handler. The global error handler investment is wasted.

**Fix:** Wrap all route handlers with `asyncHandler`, or upgrade to Express 5 which handles async errors natively.

---

### BUG-005 — FDR Interest Engine: Potential Double Principal Return on Maturity

**File:** `backend/src/services/interestEngine.js` — Lines 73–79
**Severity:** 🔴 Critical

**Description:**
When an FDR matures (`currentDate >= endDate`), if the transaction fails after balance update but before status is marked `completed`, the next cron run will re-process the principal return.

**Fix:** The FDR status should be updated to `'completed'` atomically *before* crediting the principal. Use a two-phase approach: mark as `matured_pending`, then payout.

---

### BUG-006 — Aviator Bet Wallet Tracking: `newBalance` Returns Incorrect Value When Bonus Used

**File:** `backend/src/services/aviatorLogic.js` — Lines 229, 253
**Severity:** 🔴 Critical

**Description:**
When a bet is placed using `gaming_bonus_balance`, the returned `newBalance` is still computed from `mainBalance - deductFromMain`:

```js
// Line 229 — When using bonus wallet, deductFromMain = 0, so newBalance = mainBalance (unchanged)
const newMain = mainBalance - deductFromMain;
return { success: true, newBalance: newMain, walletUsed };
```

This means the frontend receives the main balance as the "new balance" even though the deduction came from the bonus wallet.

**Fix:** Return both balances, or query the DB for the actual current balance before returning.

---

## 2. 🟠 High-Severity Issues

---

### ISSUE-007 — Spin Claim: Race Condition Between Cooldown Check and Transaction

**File:** `backend/src/routes/spin.js` — Lines 110–130, 140
**Severity:** 🟠 High

**Description:**
The 24-hour cooldown check is performed *outside* the database transaction (lines 110–130), then the actual spin happens inside a transaction (line 140). There is a TOCTOU race condition: if two requests arrive simultaneously, both may pass the cooldown check before either one writes to `user_spin_history`.

**Fix:** Move the cooldown check inside the transaction using `FOR UPDATE` on the streak row, or use a unique constraint on `(user_id, DATE(spun_at))`.

---

### ISSUE-008 — Ludo Disconnect Forfeit Doesn't Fully Guard Against Null `winnerId`

**File:** `backend/src/services/ludoLogic.js` — Lines 82–97
**Severity:** 🟠 High

**Description:**
The disconnect timer triggers forfeit using `resolveWin(roomId, winnerId, room.entry_fee)` where `winnerId` could be null if `challenger_id` is NULL. While there is a `if (winnerId)` guard, race conditions during the join flow could bypass this.

**Fix:** Add database-level NOT NULL constraints and explicit null validation before `resolveWin` call.

---

### ISSUE-009 — Fantasy Prize Distribution: Wrong Table — `wallets` Does Not Exist

**File:** `backend/src/cron/fantasyCricketCron.js` — Lines 259, 339, 356
**Severity:** 🟠 High

**Description:**
All prize distribution and refund operations update a non-existent `wallets` table:

```js
// Line 356 — BUG: 'wallets' table doesn't exist in this application!
await conn.query('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [prizeAmount, entry.user_id]);
```

The application uses `users.balance`. This means **all fantasy prize payouts and refunds silently fail** — players never receive winnings.

**Fix:** Replace `UPDATE wallets SET balance = balance + ?` with `UPDATE users SET balance = balance + ?` in `_refundMatchEntries` and `distributePrizes`.

---

### ISSUE-010 — Colour Trading: No Per-Round Bet Limit Per User

**File:** `backend/src/services/colourTradingLogic.js`
**Severity:** 🟠 High

**Description:**
Unlike Aviator which uses `activeBets.has(userId)`, a user can place unlimited bets per CT round across different colors. This allows hedging all outcomes, potentially creating a guaranteed win through multiplier arbitrage.

**Fix:** Track per-user bets per round in memory (like Aviator) or enforce a DB-level check.

---

### ISSUE-011 — Admin Route `GET /admin/users` Fetches ALL Users With No Pagination

**File:** `backend/src/routes/admin.js` — Line 474
**Severity:** 🟠 High

**Description:**
```js
const [users] = await pool.query('SELECT u.id, u.name, ... FROM users u LEFT JOIN users i ON u.invited_by = i.id ORDER BY u.created_at DESC');
```

No `LIMIT` or pagination. In production with thousands of users, this will timeout and exhaust Node.js memory. Same issue on `GET /admin/requests` (lines 266–281).

**Fix:** Add `LIMIT`/`OFFSET` pagination with a `?page=` query parameter.

---

### ISSUE-012 — Ludo Cleanup: Stale Waiting Rooms Cancelled WITHOUT Refund (Logic Order Bug)

**File:** `backend/src/cron/ludoCleanup.js` — Lines 36–52
**Severity:** 🟠 High

**Description:**
Two overlapping cleanup steps have incorrect ordering:
1. Step 1 (line 36–41): Cancels ALL waiting rooms older than **24 hours** — no refund.
2. Step 2 (line 43–53): Tries to refund rooms older than **12 hours**.

Step 1 runs first and bulk-cancels rooms. Step 2 tries to find and refund rooms still in `waiting` state between 12–24h old. Rooms exactly 24h+ old are cancelled without refund, silently losing host entry fees.

**Fix:** Reverse the order (refund first, then cancel) and use a single atomic transaction per room.

---

### ISSUE-013 — FDR Create Route: Balance Check Outside Transaction (TOCTOU Race Condition)

**File:** `backend/src/routes/fdr.js` — Lines 50–63
**Severity:** 🟠 High

**Description:**
The balance check happens before the transaction begins:
```js
const [userRows] = await conn.query('SELECT balance FROM users WHERE id = ?', [userId]); // No FOR UPDATE
if (currentBalance < fdrAmount) { return res.status(400)... }
await conn.beginTransaction(); // Transaction starts AFTER the check
```

A concurrent withdrawal can drain the balance between the check and the deduction.

**Fix:** Move balance check inside transaction with `FOR UPDATE`.

---

### ISSUE-014 — JWT Secret Missing Causes Silent Server Operation (No Hard Fail)

**File:** `backend/src/server.js` — Lines 35–38
**Severity:** 🟠 High

**Description:**
```js
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set...');
  // Server continues anyway!
}
```

Missing JWT_SECRET logs an error but the server starts. All authenticated endpoints will fail with 500 errors.

**Fix:** Call `process.exit(1)` in server.js if `JWT_SECRET` is missing at startup.

---

## 3. 🟡 Medium-Severity Issues

---

### ISSUE-015 — Referral Code Collision: Not Truly Unique

**File:** `backend/src/routes/auth.js` — Line 43
**Severity:** 🟡 Medium

```js
const newReferralCode = 'REF' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
```

Last 6 digits of timestamp can collide in concurrent registrations. No uniqueness retry logic.

**Fix:** Add a `UNIQUE` constraint on `users.referral_code` and retry with a new code on conflict.

---

### ISSUE-016 — Aviator `startWaitPhase` Creates Infinite Retry Loop on DB Failure

**File:** `backend/src/services/aviatorLogic.js` — Lines 68–76
**Severity:** 🟡 Medium

```js
if (!this.roundId) {
  setTimeout(() => this.startWaitPhase(), 5000); // Infinite retry with no backoff
}
```

**Fix:** Implement exponential backoff with a maximum retry limit (5 attempts).

---

### ISSUE-017 — Colour Trading: Race Window Between State Assignment and PROCESSING

**File:** `backend/src/services/colourTradingLogic.js` — Lines 83–100
**Severity:** 🟡 Medium

The state transition to `PROCESSING` happens after the timer fires, creating a brief window where bets could be accepted for a round that is ending.

**Fix:** Set `this.state = 'PROCESSING'` synchronously when timer hits 0.

---

### ISSUE-018 — Ludo Position Mapping Bug: Both Mapping Functions Are Identical

**File:** `backend/src/services/ludoLogic.js` — Lines 690–691
**Severity:** 🟡 Medium

```js
const hostToChallengerPos = (pos) => (pos + 26) % 52 || 52;
const challengerToHostPos = (pos) => (pos + 26) % 52 || 52;
```

Both are identical. Capture detection logic uses both functions but they produce the same result, meaning position mapping is symmetric, which is likely incorrect for proper Ludo rules.

---

### ISSUE-019 — `adminFantasyAPI` in `api.ts` Points to Wrong Path and Uses Wrong Token

**File:** `frontend/src/api.ts` — Line 207
**Severity:** 🟡 Medium

```ts
export const adminFantasyAPI = {
  getMatches: () => request('GET', '/admin-fantasy/matches'), // Uses user token, wrong path
```

Uses `request()` (user token) instead of `adminRequest()` (admin token). Path `/admin-fantasy/...` doesn't match any backend route. These calls always return 401 or 404.

**Fix:** Use `adminRequest()` with path `/admin/fantasy/matches`.

---

### ISSUE-020 — Wallet Type String Inconsistency: `'normal'` vs `'main'`

**File:** `frontend/src/api.ts` — Line 164 vs `backend/src/routes/wallet.js` — Line 78
**Severity:** 🟡 Medium

Frontend default is `'normal'` but backend validator allows `['main', 'bonus', 'referral', 'gaming_bonus']`. Works by coincidence via the utility fallback.

**Fix:** Standardize to `'main'` across both frontend and backend.

---

### ISSUE-021 — DB Pool: `queueLimit: 0` Means Unlimited Memory Queue Under Load

**File:** `backend/src/db.js` — Line 11
**Severity:** 🟡 Medium

`queueLimit: 0` means unlimited queued requests when pool is exhausted. Under heavy load, requests pile up in memory with no circuit breaker.

**Fix:** Set `queueLimit` to 50–100 so excess requests fail fast.

---

### ISSUE-022 — Interest Engine: Long Transaction Holding FDR Row Locks

**File:** `backend/src/services/interestEngine.js` — Line 19
**Severity:** 🟡 Medium

```js
const [activeFdrs] = await conn.query("SELECT * FROM fdrs WHERE status = 'active' FOR UPDATE SKIP LOCKED");
```

Fetches ALL active FDRs at once and holds locks for the entire cron duration. Blocks other writes to FDR rows for potentially minutes.

**Fix:** Process FDRs in batches (LIMIT + cursor) with short individual transactions.

---

### ISSUE-023 — No React Error Boundary — Any Component Crash = Blank Screen

**File:** `frontend/src/App.tsx`
**Severity:** 🟡 Medium

No Error Boundary wraps any views. A JavaScript error in any component unmounts the entire app showing a blank screen with no recovery.

**Fix:** Add Error Boundary components around major view sections.

---

### ISSUE-024 — Activity Tracking Uses Internal View Names as URL Paths

**File:** `frontend/src/App.tsx` — Lines 136–140
**Severity:** 🟡 Medium

`trackActivity` logs view names like `/game-aviator` instead of real URLs, making activity logs misleading in analytics.

---

### ISSUE-025 — Spin Wheel 7-Day Streak Bonus Only Fires for `gaming_bonus` Segment Type

**File:** `backend/src/routes/spin.js` — Lines 194–196
**Severity:** 🟡 Medium

```js
if (newStreak % 7 === 0 && chosen.prize_type === 'gaming_bonus') {
  finalAmount = finalAmount * 2; // Only fires if random pick is a bonus segment
}
```

If day 7's random pick is a non-bonus segment, the user gets no streak reward. Likely unintentional.

---

## 4. 🔵 Low-Severity / Code Quality Issues

---

### ISSUE-026 — Scratch/Temp Files Committed to Repository

**Severity:** 🔵 Low

Multiple development scripts committed to the backend root:
- `scratch_cleanup_schemes.js`, `scratch_delete_scheme.js`, `scratch_insert_scheme.js`
- `scratch_test_interest.js`, `temp_update.js`, `query_db.js`, `update_date.js`

**Fix:** Move to a `scripts/` folder and add to `.gitignore`.

---

### ISSUE-027 — `App.tsx` Uses `any` Type for User State

**File:** `frontend/src/App.tsx` — Line 65
**Severity:** 🔵 Low

```tsx
const [user, setUser] = useState<any>(null);
```

Bypasses TypeScript type safety. Propagated to all view components.

**Fix:** Define and use a proper `User` interface.

---

### ISSUE-028 — `addDays()` Function Duplicated in Two Files

**File:** `backend/src/routes/fdr.js` and `backend/src/services/interestEngine.js`
**Severity:** 🔵 Low

Identical utility function defined in two places. Bug fix must be applied twice.

**Fix:** Move to `utils.js` and import.

---

### ISSUE-029 — DB Connection Missing SSL Configuration for Production

**File:** `backend/src/db.js`
**Severity:** 🔵 Low

No SSL configuration for MySQL connection. Credentials sent in plaintext if DB is remote.

**Fix:** Add `ssl` option based on `DB_SSL` environment variable.

---

### ISSUE-030 — Frontend Default Wallet Type is `'normal'`, Backend Expects `'main'`

**File:** `frontend/src/api.ts` — Line 164
**Severity:** 🔵 Low

Mismatch in wallet type string defaults. Works by coincidence through implicit fallback logic.

---

### ISSUE-031 — Ludo Bot AI Also Uses Incorrect Position Mapping

**File:** `backend/src/services/ludoLogic.js` — Lines 989–990
**Severity:** 🔵 Low

Same issue as ISSUE-018 — bot AI uses identical mapping functions for both directions.

---

### ISSUE-032 — Global Error Handler Registered Before Some Routes in `server.js`

**File:** `backend/src/server.js` — Lines 211–218
**Severity:** 🔵 Low

`/api/config` route (line 218) is registered after the global error handler. Errors from it won't be caught by the handler.

**Fix:** Move all route registrations before the error handler.

---

## 5. ⚡ Performance Bottlenecks

---

### PERF-001 — Fantasy Live Score: N+1 Query Per Player Per Match

**File:** `backend/src/cron/fantasyCricketCron.js` — Lines 155–173

22 players × 5+ live matches = 110+ sequential DB queries every 2 minutes.

**Fix:** Batch player ID lookups with `WHERE api_player_id IN (?)` and batch updates.

---

### PERF-002 — Fantasy Team Points Recalculation: N+1 Per Team + N+1 Per Contest Entry

**File:** `backend/src/cron/fantasyCricketCron.js` — Lines 197–237

Individual UPDATE per team and per contest entry. For 100 teams, 200+ queries every 2 minutes.

**Fix:** Use MySQL window functions for ranking, batch balance updates.

---

### PERF-003 — `GET /admin/users` Uses Expensive Self-JOIN With No Index on `created_at`

**File:** `backend/src/routes/admin.js` — Line 474

Full table self-join with ORDER BY on potentially unindexed column.

**Fix:** Add index on `users.created_at`, implement pagination.

---

### PERF-004 — In-Memory Cache Not Shared Across Processes

**File:** `backend/src/cache.js`

In PM2 cluster mode, each worker has its own cache. Cache invalidation in one process doesn't propagate.

**Fix:** Use Redis for shared caching in multi-process deployments.

---

### PERF-005 — FDR Referral Commission: Same User Query Repeated Inside Loop

**File:** `backend/src/services/interestEngine.js` — Line 106

`SELECT invited_by FROM users WHERE id = ?` called inside a `while` loop — could run 30+ times for a late-processed FDR.

**Fix:** Move the query outside the while loop.

---

## 6. 🔒 Security Vulnerabilities

---

### SEC-001 — CORS Falls Back to Allow ALL Origins When Env Not Set

**File:** `backend/src/server.js` — Lines 161–164

```js
} else {
  callback(null, true); // Allows ALL origins if ALLOWED_ORIGINS not set
}
```

In production without `ALLOWED_ORIGINS`, any website can make authenticated requests.

**Fix:** In `NODE_ENV === 'production'`, deny all if `ALLOWED_ORIGINS` is not configured.

---

### SEC-002 — Admin and User Tokens Share Same `JWT_SECRET`

**File:** `backend/src/routes/admin.js` — Line 43

Both user and admin JWTs use the same secret. A compromised secret grants access to both. Best practice is separate secrets.

---

### SEC-003 — OTP Not Invalidated After `/verify-otp` Call

**File:** `backend/src/routes/auth.js` — Lines 160–170

The `/verify-otp` endpoint validates and returns success but does NOT delete the OTP. It remains valid until `/reset-password` is called. An intercepted OTP can be verified multiple times.

**Fix:** Delete or mark the OTP as used immediately after verification. Return a short-lived signed reset token.

---

### SEC-004 — Profile Photo URL Not Validated — Allows Arbitrary URL Storage

**File:** `backend/src/routes/auth.js` — Lines 260–280

Any URL can be stored as `profile_photo` (after HTML-escaping). If rendered without validation, enables stored XSS or SSRF attacks.

**Fix:** Validate `profile_photo` URL against the application's upload URL pattern.

---

### SEC-005 — Rate Limiters Use In-Memory Store — Bypassed by Server Restart or Cluster

**File:** `backend/src/server.js` — Lines 182–186

Default in-memory rate limit store is lost on restart and not shared across cluster workers.

**Fix:** Use a Redis-backed store (`rate-limit-redis`).

---

## 7. 📦 Technical Debt

---

### DEBT-001 — No Automated Tests

The `backend/tests/` directory exists but no tests are written. Payment flows, game logic, FDR calculations, and referral commissions have no test coverage.

---

### DEBT-002 — No Database Migration Version Tracking

The migration system runs `CREATE TABLE IF NOT EXISTS` on every startup. No versioned migration system means schema changes (ALTER TABLE) cannot be tracked or rolled back.

---

### DEBT-003 — Custom Hash Routing Instead of React Router

All views are conditionally rendered in a single `App.tsx` (396 lines). No code splitting, no lazy loading, no proper deep linking. Doesn't scale.

**Fix:** Migrate to React Router v6 with lazy-loaded routes.

---

### DEBT-004 — Structured `logger` Defined in `utils.js` but Never Used

```js
// utils.js — logger defined but unused everywhere
const logger = { info(msg, meta), warn(msg, meta), error(msg, meta) };
```

Entire codebase uses `console.log/error/warn` instead. Structured logging investment is wasted.

---

### DEBT-005 — `.env` File Tracked in Git Repository

**File:** `backend/.env`

Production secrets risk exposure if `.env` is ever updated with real credentials and committed.

**Fix:** Add `backend/.env` to `.gitignore`. Use only `.env.example` for documentation.

---

## Summary Table

| ID | Severity | Module | Issue |
|----|----------|--------|-------|
| BUG-001 | 🔴 Critical | Fantasy Routes | Undefined `balance` variable crashes contest join |
| BUG-002 | 🔴 Critical | Fantasy Routes | Multi-status query returns `[rows, fields]` not `rows` |
| BUG-003 | 🔴 Critical | Ludo Logic | Cancel room refunds to wrong wallet always |
| BUG-004 | 🔴 Critical | Backend Utils | `asyncHandler` defined but never used |
| BUG-005 | 🔴 Critical | Interest Engine | Potential double principal return on FDR maturity |
| BUG-006 | 🔴 Critical | Aviator Logic | Wrong balance returned when gaming bonus wallet used |
| ISSUE-007 | 🟠 High | Spin Routes | TOCTOU race condition in cooldown check |
| ISSUE-008 | 🟠 High | Ludo Logic | Null `winnerId` risk in disconnect forfeit |
| ISSUE-009 | 🟠 High | Fantasy Cron | Prize payout hits non-existent `wallets` table |
| ISSUE-010 | 🟠 High | Colour Trading | No per-round bet limit per user |
| ISSUE-011 | 🟠 High | Admin Routes | No pagination on all-user and all-requests endpoints |
| ISSUE-012 | 🟠 High | Ludo Cleanup | Stale room cancellation before refund loses host funds |
| ISSUE-013 | 🟠 High | FDR Routes | Balance check outside transaction (TOCTOU race) |
| ISSUE-014 | 🟠 High | Server | Missing JWT_SECRET allows server to keep running |
| ISSUE-015 | 🟡 Medium | Auth Routes | Referral code collision risk |
| ISSUE-016 | 🟡 Medium | Aviator Logic | Infinite retry loop on DB failure |
| ISSUE-017 | 🟡 Medium | Colour Trading | Race window between state change and processing |
| ISSUE-018 | 🟡 Medium | Ludo Logic | Both position mapping functions are identical |
| ISSUE-019 | 🟡 Medium | Frontend API | `adminFantasyAPI` uses user token and wrong path |
| ISSUE-020 | 🟡 Medium | Wallet Routes | Wallet type inconsistency: `normal` vs `main` |
| ISSUE-021 | 🟡 Medium | DB Config | Unlimited queue can exhaust memory under load |
| ISSUE-022 | 🟡 Medium | Interest Engine | Long transaction holds FDR row locks |
| ISSUE-023 | 🟡 Medium | Frontend | No Error Boundary — crash = blank screen |
| ISSUE-024 | 🟡 Medium | Frontend App | Activity tracking uses internal view names as URLs |
| ISSUE-025 | 🟡 Medium | Spin Routes | 7-day streak bonus only fires for bonus segments |
| ISSUE-026 | 🔵 Low | Backend | Scratch/temp files committed to repository |
| ISSUE-027 | 🔵 Low | Frontend | `any` type used for user state |
| ISSUE-028 | 🔵 Low | Backend | `addDays()` function duplicated in two files |
| ISSUE-029 | 🔵 Low | DB Config | No SSL for DB connections |
| ISSUE-030 | 🔵 Low | Frontend API | Default wallet type mismatch (`normal` vs `main`) |
| ISSUE-031 | 🔵 Low | Ludo Bot | Bot AI uses same incorrect position mapping |
| ISSUE-032 | 🔵 Low | Server | Global error handler registered before some routes |
| PERF-001 | ⚡ Performance | Fantasy Cron | N+1 queries in live score processing |
| PERF-002 | ⚡ Performance | Fantasy Cron | N+1 queries in team point recalculation |
| PERF-003 | ⚡ Performance | Admin Routes | Expensive self-JOIN with no pagination |
| PERF-004 | ⚡ Performance | Cache | In-memory cache not shared across processes |
| PERF-005 | ⚡ Performance | Interest Engine | Repeated user query inside referral commission loop |
| SEC-001 | 🔒 Security | CORS | Falls back to allow all origins when env not set |
| SEC-002 | 🔒 Security | Auth | Admin and user tokens share same JWT secret |
| SEC-003 | 🔒 Security | Auth | OTP not invalidated after use |
| SEC-004 | 🔒 Security | Auth | Profile photo URL not validated |
| SEC-005 | 🔒 Security | Rate Limiter | In-memory rate limit store bypassed on restart |
| DEBT-001 | 📦 Debt | Testing | No automated tests |
| DEBT-002 | 📦 Debt | DB | No versioned migration tracking |
| DEBT-003 | 📦 Debt | Frontend | Custom hash routing instead of React Router |
| DEBT-004 | 📦 Debt | Backend | Structured logger defined but never used |
| DEBT-005 | 📦 Debt | Config | `.env` file tracked in Git repository |

---

## Recommended Priority Order

### Immediate Fixes (This Sprint)
1. **BUG-001** — Fantasy contest join crashes on undefined `balance`
2. **BUG-002** — Fantasy multi-status query returns wrong format
3. **ISSUE-009** — Fantasy prizes hit `wallets` table that does not exist
4. **BUG-003** — Ludo cancel always refunds to wrong wallet
5. **BUG-006** — Aviator returns wrong balance when bonus used

### Short-Term (Next Sprint)
6. **ISSUE-011** — Paginate admin user/request endpoints
7. **ISSUE-013** — Fix TOCTOU in FDR creation
8. **ISSUE-012** — Fix stale room cleanup order
9. **ISSUE-007** — Fix spin cooldown race condition
10. **SEC-001** — Tighten CORS in production
11. **DEBT-005** — Remove `.env` from Git history

### Medium-Term
12. Add React Error Boundaries (ISSUE-023)
13. Implement `asyncHandler` across all routes (BUG-004)
14. Fix Fantasy N+1 queries (PERF-001, PERF-002)
15. Implement proper OTP invalidation (SEC-003)
16. Add input validation for profile photo URLs (SEC-004)

---

*Report generated by comprehensive static analysis of all backend and frontend source files.*
*Total issues found: 6 Critical, 8 High, 11 Medium, 7 Low, 5 Performance, 5 Security, 5 Technical Debt*
