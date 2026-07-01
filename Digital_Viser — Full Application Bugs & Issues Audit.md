# 🐛 Digital_Viser — Full Application Bugs & Issues Audit Report

> **Audit Date:** June 30, 2026  
> **Scope:** Complete codebase (Backend + Frontend)  
> **Auditor:** Automated Code Review  
> **Severity Legend:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | ⚪ Info

---

## Table of Contents

1. [🔴 Critical Security Vulnerabilities](#1--critical-security-vulnerabilities)
2. [🔴 Critical Financial / Data Integrity Bugs](#2--critical-financial--data-integrity-bugs)
3. [🟠 High Severity — Authentication & Authorization](#3--high-severity--authentication--authorization)
4. [🟠 High Severity — Game Logic Bugs](#4--high-severity--game-logic-bugs)
5. [🟡 Medium Severity — Backend Logic Issues](#5--medium-severity--backend-logic-issues)
6. [🟡 Medium Severity — Frontend Bugs](#6--medium-severity--frontend-bugs)
7. [🟢 Low Severity — Code Quality & Maintenance](#7--low-severity--code-quality--maintenance)
8. [⚪ Informational — Best Practices & Improvements](#8--informational--best-practices--improvements)

---

## 1. 🔴 Critical Security Vulnerabilities

### BUG-SEC-001: LiveChat Socket Uses Wrong Token Key (Authentication Bypass)

**File:** `frontend/src/views/LiveChat.tsx` — Line 23  
**File:** `frontend/src/views/admin/AdminLiveChat.tsx` — Line 23

**Description:**  
The LiveChat component reads the token from `localStorage.getItem('token')` but the app stores user tokens under the key `'dv_token'` (via `safeSetItem('dv_token', token)` in `api.ts`). Similarly, `AdminLiveChat.tsx` reads from `'adminToken'` instead of `'admin_dv_token'`.

**Impact:**  
- **User LiveChat socket will NEVER connect** — the token is always `null`, which means the socket authentication middleware rejects the connection.
- **Admin LiveChat socket will NEVER connect** — same issue, admin can't use live chat.
- Both LiveChat features are completely non-functional.

**Fix:**
```javascript
// LiveChat.tsx — Line 23
const token = localStorage.getItem('dv_token');

// AdminLiveChat.tsx — Line 23
const token = localStorage.getItem('admin_dv_token');
```

---

### BUG-SEC-002: Socket.io Auth Does Not Distinguish Admin vs User Tokens

**File:** `backend/src/server.js` — Lines 76-85

**Description:**  
The Socket.io authentication middleware uses `process.env.JWT_SECRET` (user secret) to verify ALL socket connections. However, admin tokens are signed with `JWT_ADMIN_SECRET`. This means:
- Admin sockets connecting with admin tokens will **fail authentication**.
- The `socket.user.role` check in live chat handlers (line 152, 166, 186) will never work because `role` is never set in the decoded user JWT payload.

**Impact:**  
- Admin live chat features over sockets are completely broken.
- The `socket.user.role === 'admin'` check always evaluates to `false` because user JWTs don't contain a `role` field.

**Fix:**  
The socket auth middleware should try `JWT_ADMIN_SECRET` as a fallback, and the admin JWT should include `role: 'admin'` in its payload.

---

### BUG-SEC-003: Upload Endpoint Has No Authentication

**File:** `backend/src/routes/upload.js` — Line 48

**Description:**  
The `/api/upload` endpoint has **no authentication middleware**. Anyone can upload files to the server without being logged in. The route is mounted at `app.use('/api/upload', uploadRoutes)` without `authMiddleware`.

**Impact:**  
- Unauthenticated attackers can upload arbitrary files (images, PDFs) to the server.
- Could fill up disk space.
- Potential for uploading malicious content.

**Fix:**
```javascript
// upload.js
const authMiddleware = require('../middleware/auth');
router.post('/', authMiddleware, (req, res) => { ... });
```

---

### BUG-SEC-004: OTP Can Be Reused for Password Reset

**File:** `backend/src/routes/auth.js` — Lines 192-221

**Description:**  
In `/verify-otp`, the OTP is marked as used (`is_used = 1`). However, in `/reset-password`, the query does NOT check `is_used` status:
```sql
SELECT * FROM password_resets WHERE email = ? AND otp_code = ? AND expires_at > NOW()
```
This means after an OTP is verified (and marked used), it can STILL be used in `/reset-password` to change the password repeatedly until it expires.

**Impact:**  
- An attacker who captures a used OTP can reset the password multiple times within the 10-minute window.

**Fix:**  
Add `AND (is_used IS NULL OR is_used = 0)` to the `/reset-password` query.

---

### BUG-SEC-005: Deposit Status Returns "success" for Pending Deposits

**File:** `backend/src/routes/wallet.js` — Lines 74-82

**Description:**  
The deposit route inserts a deposit with `status = "pending"` but responds to the client with `status: 'success'` in the JSON response body. This misleads the frontend into thinking the deposit was immediately approved.

**Impact:**  
- Users see a "success" status when the deposit is actually still pending admin approval.
- Confusing UX and potentially creates trust issues.

**Fix:**
```javascript
status: 'pending',  // not 'success'
```

---

### BUG-SEC-006: No CSRF Protection on State-Changing Endpoints

**File:** `backend/src/server.js`

**Description:**  
The application relies solely on JWT Bearer tokens for authentication, with no CSRF tokens. Since `credentials: true` is enabled in CORS, any website could potentially make cross-origin requests if the token is stored accessibly (e.g., in localStorage which is XSS-accessible).

**Impact:**  
- Combined with any XSS vulnerability, an attacker could make authenticated requests on behalf of users.
- Since JWTs are stored in localStorage, any XSS can steal them.

---

## 2. 🔴 Critical Financial / Data Integrity Bugs

### BUG-FIN-001: Ludo Abandoned Room Cleanup Doesn't Refund Winner Correctly

**File:** `backend/src/cron/ludoCleanup.js` — Lines 77-83

**Description:**  
When a playing game is abandoned for >4 hours, the cleanup simply sets `status = 'completed'` and `winner_id = host_id`. However:
1. **No payout is given to the host** — the entry fee pool is never distributed.
2. **Challenger's entry fee is lost** — they already paid but receive no refund.
3. The `resolveWin()` function (which handles payouts) is NOT called.

**Impact:**  
- Both players lose their entry fees on abandoned games.
- Financial loss for users.

**Fix:**  
Call `resolveWin()` or manually distribute the prize pool in the cleanup logic.

---

### BUG-FIN-002: Ludo Win Payout Uses Hardcoded 0.95x in Frontend But Dynamic Backend

**File:** `backend/src/routes/games/index.js` — Lines 175, 209, 252  
**File:** `backend/src/services/ludoLogic.js` — Line 794

**Description:**  
The frontend game routes hardcode win payout as `betAmt * 2 * 0.95` (5% house edge), but the actual `resolveWin()` method in `ludoLogic.js` uses the dynamic `this._houseEdge` setting (which could be any value configured in `system_settings`).

**Impact:**  
- If admin changes the Ludo house edge (e.g., to 10%), the "My Bets" history page will show incorrect win amounts.
- Users see wrong payout numbers vs what they actually received.

---

### BUG-FIN-003: Force-Close FDR Response Reports Gross Principal, Not Net

**File:** `backend/src/routes/fdr.js` — Line 403

**Description:**  
After force-closing an FDR with charges applied, the response says:
```javascript
res.json({ principal_returned: principal })
```
But `principal` is the GROSS amount — the actual returned amount is `netPrincipal = principal - totalCharges`. The user is told they received more than they actually did.

**Impact:**  
- Misleading financial information to users.
- Trust issue — user expects one amount but gets less.

**Fix:**
```javascript
res.json({ principal_returned: netPrincipal, charges_applied: totalCharges })
```

---

### BUG-FIN-004: Deposit Cancel Doesn't Use Transaction for Select + Update

**File:** `backend/src/routes/wallet.js` — Lines 467-496

**Description:**  
The deposit cancel handler calls `conn.beginTransaction()` on line 480 but the initial `SELECT ... FOR UPDATE` on line 473-474 happens **before** the transaction begins. This means:
1. The `FOR UPDATE` lock doesn't work because there's no active transaction.
2. Another request could modify the deposit between the SELECT and the UPDATE.

**Impact:**  
- Race condition: a deposit could be cancelled while simultaneously being approved by admin.

**Fix:**  
Move `await conn.beginTransaction()` before the SELECT query.

---

### BUG-FIN-005: Withdrawal Cancel — Same Transaction Ordering Bug

**File:** `backend/src/routes/wallet.js` — Lines 499-537

**Description:**  
Identical issue to BUG-FIN-004. The `SELECT ... FOR UPDATE` at line 505 runs outside the transaction (which starts at line 517).

**Impact:**  
- Race condition: withdrawal could be cancelled while admin is simultaneously approving it, leading to double-refund.

---

### BUG-FIN-006: Coin Balance Deduction for Withdrawal Charges — No Negative Balance Guard

**File:** `backend/src/routes/wallet.js` — Line 251

**Description:**  
The query `UPDATE users SET coin_balance = coin_balance - ? WHERE id = ?` uses arithmetic subtraction. If a race condition occurs (two concurrent withdrawals), `coin_balance` could go negative because MySQL doesn't enforce unsigned constraints at the arithmetic level by default.

**Impact:**  
- Coin balance could theoretically go negative under concurrent requests.

---

## 3. 🟠 High Severity — Authentication & Authorization

### BUG-AUTH-001: Auth Middleware Doesn't Include Role in User Object

**File:** `backend/src/middleware/auth.js` — Line 14

**Description:**  
The auth middleware extracts `userId` from the JWT but does NOT extract or include `role`:
```javascript
req.user = { userId: decoded.userId };
```
The user JWT payload only contains `{ userId }` (see `auth.js` line 70, 106). This means any route checking `req.user.role` will always get `undefined`.

**Impact:**  
- Socket.io live chat role-based routing is broken (checks `socket.user.role === 'admin'` but this is never set).

---

### BUG-AUTH-002: Admin Token Fallback Creates Security Risk

**File:** All admin route files (admin.js, adminAnalytics.js, etc.)

**Description:**  
Each admin route file has:
```javascript
const JWT_SECRET = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET;
```
If `JWT_ADMIN_SECRET` is not set in `.env`, admin routes fall back to the user JWT secret. This means **any regular user's JWT token would be accepted as a valid admin token**, granting full admin access.

**Impact:**  
- If `JWT_ADMIN_SECRET` is missing from production `.env`, all users effectively become admins.
- The fallback `|| process.env.JWT_SECRET` should be removed — admin auth should hard-fail if the admin secret is missing.

---

### BUG-AUTH-003: JWT Tokens Have No Token Revocation Mechanism

**File:** `backend/src/middleware/auth.js`, `backend/src/routes/auth.js`

**Description:**  
JWTs expire after 7 days (`expiresIn: '7d'`), but there is no blacklist/revocation mechanism. If a user's account is compromised or an admin disables a user, the old token remains valid for up to 7 days.

**Impact:**  
- Compromised accounts cannot be immediately locked out.
- Deleted users can continue operating for up to 7 days with their existing token.

---

## 4. 🟠 High Severity — Game Logic Bugs

### BUG-GAME-001: Aviator — No Minimum Balance Guard for Split Wallet Logic

**File:** `backend/src/services/aviatorLogic.js` — Lines 203-212

**Description:**  
The wallet selection logic is:
```javascript
if (gamingBonus >= amount) {
  deductFromBonus = amount;
} else {
  deductFromMain = amount;
  if (mainBalance < amount) throw new Error('Insufficient balance');
}
```
The problem: if `gamingBonus` is 5 and `amount` is 10, it skips gaming bonus entirely and tries main balance. There's no "split" deduction (partially from bonus, rest from main). This is the documented design, but users may expect their gaming bonus to partially cover a bet.

**Impact:**  
- Users with partial gaming bonus and partial main balance may be told "Insufficient balance" when they technically have enough combined.

---

### BUG-GAME-002: Colour Trading — Same Wallet Split Issue

**File:** `backend/src/services/colourTradingLogic.js` — Lines 318-325

**Description:**  
Identical to BUG-GAME-001. The colour trading game does not split bets across wallets.

---

### BUG-GAME-003: Ludo Balance Check Uses `Math.max` Instead of Sum

**File:** `backend/src/services/ludoLogic.js` — Lines 315, 412, 528

**Description:**  
```javascript
const totalBal = Math.max(mainBal, bonusBal);
```
This takes the **maximum** of the two balances, not the sum. If a user has ₹30 in main and ₹40 in bonus, `totalBal = 40`, not 70. A ₹50 bet would fail even though combined balance is ₹70.

Additionally, the naming `totalBal` is misleading as it's not a total.

**Impact:**  
- Users with split balances are blocked from joining rooms they can afford.

---

### BUG-GAME-004: Ludo Bot — `bots[0].email` Could Be Undefined

**File:** `backend/src/services/ludoLogic.js` — Line 54

**Description:**  
```javascript
'INSERT IGNORE INTO users (id, name, email, password_hash) VALUES (?, ?, ?, "disabled")',
[botUserId, bots[0].name, bots[0].email]
```
The `game_bots` table query on line 35 selects `id, name` but NOT `email`. So `bots[0].email` is always `undefined`, which would insert `NULL` as the email for the bot user.

**Impact:**  
- Bot user rows could have NULL emails, which may cause issues if email uniqueness is enforced.
- Silent data corruption.

---

### BUG-GAME-005: Ludo Dice Roll Has No Row Lock — Race Condition

**File:** `backend/src/services/ludoLogic.js` — Line 582

**Description:**  
The `rollDice` method reads the room state with a plain `SELECT` (no `FOR UPDATE`), modifies `boardState`, and writes it back. If two rapid requests arrive, both could read the same state, leading to:
1. Double dice rolls on the same turn.
2. Lost board state updates.

The `movePiece` method has the same issue (line 672).

**Impact:**  
- Game state corruption under rapid inputs.
- A fast clicker could potentially roll dice twice.

---

### BUG-GAME-006: Colour Trading — `0` and `5` Color Labeling Inconsistency

**File:** `backend/src/services/colourTradingLogic.js` — Lines 171-175

**Description:**  
Numbers 0 and 5 are labeled as `'violet'` but in reality they are BOTH red/green AND violet. The game pays out 1.5x for red bets on 0, and 1.5x for green bets on 5. But `finalColor` is set to `'violet'` exclusively. The color history shown to users will always show "violet" for 0 and 5, masking the fact that red/green bets also win on these numbers.

**Impact:**  
- Players who bet red and won on 0 will see the result as "violet" in history, causing confusion.

---

## 5. 🟡 Medium Severity — Backend Logic Issues

### BUG-MED-001: FDR Referral Commission Not Granted on Registration

**File:** `backend/src/routes/auth.js` — Lines 53-59

**Description:**  
During registration, when a referral code is used, only `invited_by` is set. There is **no referral commission or bonus** granted to the referrer on signup. The referral commission only comes from FDR interest (daily recurring), which means:
- If the referred user never creates an FDR, the referrer gets nothing.
- There's no immediate registration referral bonus.

**Impact:**  
- Referral system may not feel rewarding enough to users who refer others.
- Documented behavior but worth noting.

---

### BUG-MED-002: Maintenance Mode — API Still Serves Static Files

**File:** `backend/src/server.js` — Lines 258-303, 410-417

**Description:**  
The maintenance mode middleware blocks API requests, but the frontend static files (Express static serving at line 412) are mounted AFTER the API routes. Since the catch-all `app.get('*')` at line 415 is also after maintenance middleware, users will still see the frontend during maintenance — but ALL API calls will fail with 503, causing a broken UI experience (spinners forever, error messages).

**Impact:**  
- Users see a half-working app during maintenance instead of a clean maintenance page.

---

### BUG-MED-003: Cache Not Invalidated After Admin Updates Payment Methods

**File:** `backend/src/routes/wallet.js` — Lines 358-368, `backend/src/cache.js`

**Description:**  
Active payment methods are cached for 30 seconds (`cache.set(cacheKey, rows, 30000)`). When an admin creates, updates, or deletes a payment method, the cache `'payment:active-methods'` is NOT invalidated. The same issue exists for `'config:public'` and `'games:active'`.

**Impact:**  
- Users see stale payment methods for up to 30 seconds after admin changes.
- Not a critical bug but can cause confusion during active admin configuration.

---

### BUG-MED-004: Missing `MaintenanceGuard` Component Import (Dead Import)

**File:** `frontend/src/App.tsx` — Line 69

**Description:**  
`MaintenanceGuard` is imported but never used in the component. It's a dead import that increases bundle size.

---

### BUG-MED-005: Withdrawal Source Wallet "normal" Mapping Issue

**File:** `backend/src/utils.js` — Lines 5-16  
**File:** `backend/src/routes/wallet.js` — Line 514

**Description:**  
In `resolveWalletColumn`, the valid mappings are `bonus`, `referral`, `gaming_bonus`, and anything else defaults to `'balance'`. However, in the withdrawal cancel handler, `sourceWallet` is retrieved from `customData.source_wallet` which could be `'normal'` (an old legacy value). The `resolveWalletColumn` function correctly maps this to `'balance'`, but the inconsistency between 'main' and 'normal' naming could cause bugs if new wallet types are added.

---

### BUG-MED-006: FDR `my-fdrs` Route — N+1 Query Problem (Performance)

**File:** `backend/src/routes/fdr.js` — Lines 138-228

**Description:**  
For each FDR in the list, the code executes:
1. A query for active yield boosters (line 177-186)
2. For each booster, a `getGameplayCount` query (line 196)

If a user has 20 FDRs, each with 5 boosters, this results in 20 × (1 + 5) = **120 SQL queries** per request.

**Impact:**  
- Severe performance degradation for users with many FDRs.
- Potential request timeouts.

---

### BUG-MED-007: Email OTP Template Has Direct Variable Interpolation (XSS Risk)

**File:** `backend/src/services/emailService.js` — Line 57

**Description:**  
```javascript
${otp}
```
The OTP is directly interpolated into the HTML email template. While OTP is server-generated and numeric, this pattern could be exploited if the template is ever reused with user-controlled data.

---

### BUG-MED-008: Live Chat Messages Not Persisted via Socket

**File:** `backend/src/server.js` — Lines 162-183

**Description:**  
When a user sends a message via `socket.emit('live_chat_message')`, the server broadcasts it but does NOT save it to the database. Only the HTTP POST `/live-chat/message` endpoint saves messages. The frontend sends both (socket + HTTP), but:
1. If the HTTP request fails silently, the message appears on screen but is never saved.
2. Admin messages sent only via socket are never persisted.

**Impact:**  
- Message loss risk — messages that fail HTTP but succeed socket appear in real-time but disappear on page reload.
- Admin messages via socket are completely ephemeral.

---

## 6. 🟡 Medium Severity — Frontend Bugs

### BUG-FE-001: LiveChat Back Button Calls `window.history.back()` Instead of App Navigation

**File:** `frontend/src/views/LiveChat.tsx` — Line 190

**Description:**  
```javascript
onClick={() => window.history.back()}
```
The app uses hash-based routing (`window.location.hash`), so `window.history.back()` might navigate to an unexpected page (e.g., an external site if the user entered the app directly via this view). Should use the app's `onNavigate` mechanism.

**Impact:**  
- Users could accidentally leave the application entirely.

---

### BUG-FE-002: Multiple Game Views Use `localStorage` Directly Instead of Safe Wrapper

**Files:**
- `frontend/src/views/games/aviator/AviatorGame.tsx` — Line 418
- `frontend/src/views/games/colourtrading/ColourTradingGame.tsx` — Line 133
- `frontend/src/views/games/ludo/LudoGame.tsx` — Line 101
- `frontend/src/views/games/fruitslasher/FruitSlasherGame.tsx` — Line 217

**Description:**  
These files directly call `localStorage.getItem()` / `localStorage.setItem()` instead of using the `safeGetItem` / `safeSetItem` wrappers from `api.ts` that handle sandboxed WebView or private browsing mode gracefully.

**Impact:**  
- In environments where localStorage is blocked (sandboxed WebViews, some PWA contexts), these calls will throw exceptions, potentially crashing the game views.

---

### BUG-FE-003: Error Boundary Only Wraps Main Content, Not Navbar/Sidebar

**File:** `frontend/src/App.tsx` — Line 299

**Description:**  
The `<ErrorBoundary>` only wraps the inner view content. If the `<Sidebar>` or `<Navbar>` components throw an error, it will crash the entire app with no recovery.

**Impact:**  
- If sidebar or navbar encounter a render error, the entire app becomes unusable.

---

### BUG-FE-004: Admin User Details — Lost `selectedUserId` on Hash Navigation

**File:** `frontend/src/App.tsx` — Lines 394-402

**Description:**  
When the admin navigates to user details (`admin-user-details`), the `selectedUserId` is stored in React state. If the admin refreshes the page or uses the browser back button, `selectedUserId` is lost (reset to `null`), and the view renders nothing.

**Impact:**  
- Page refresh while viewing a user's profile shows a blank page.
- Browser back/forward navigation breaks this view.

---

### BUG-FE-005: Hash-based Navigation Doesn't Support Deep Links

**File:** `frontend/src/App.tsx` — Lines 171-195

**Description:**  
The app uses `window.location.hash` for routing. While this works for simple views, complex views like `support/123` (support ticket detail) work in-session but break on page refresh because the hash `#support/123` is correctly parsed but the ticket data isn't pre-fetched from the hash.

This actually works for support tickets (the `ticketId` is parsed from `currentView.split('/')[1]`), but admin support (`admin/support/123`) uses `currentView.split('/')[2]`, which is inconsistent naming.

---

## 7. 🟢 Low Severity — Code Quality & Maintenance

### BUG-LOW-001: Unused Imports in `App.tsx`

**File:** `frontend/src/App.tsx` — Line 4

**Description:**  
`ArrowUpRight` from lucide-react is imported but never used.

---

### BUG-LOW-002: Duplicated Request Function (API Client)

**File:** `frontend/src/api.ts` — Lines 63-91, 93-121

**Description:**  
`request()` and `adminRequest()` are nearly identical functions — the only difference is which token function they call (`getToken()` vs `getAdminToken()`). This could be a single function with a parameter.

---

### BUG-LOW-003: Console Logging in Production (Live Chat)

**File:** `backend/src/routes/liveChat.js` — Line 46

**Description:**  
```javascript
console.log('Incoming live chat message:', req.body);
```
User messages are logged to the console, which may expose private messages in server logs.

**Impact:**  
- Privacy concern — user messages appear in server logs.

---

### BUG-LOW-004: Hardcoded Bot ID `9999` is a Magic Number

**File:** `backend/src/services/ludoLogic.js` — Lines 48, 797, 826, 956  
**File:** `backend/src/routes/games/index.js` — Line 202

**Description:**  
The bot user ID `9999` is hardcoded in multiple files. If the default bot user is ever changed, all these locations must be updated.

**Fix:**  
Extract to a constant like `const BOT_DEFAULT_USER_ID = 9999;`.

---

### BUG-LOW-005: `express-validator` Not Used Consistently

**Files:** `auth.js`, `wallet.js` use express-validator, but `fdr.js`, `spin.js`, `support.js`, `dailyTasks.js`, `liveChat.js` do manual validation.

**Description:**  
Inconsistent input validation strategy across routes. Some routes use proper express-validator with sanitization, while others do basic `if (!field)` checks that don't sanitize input.

---

### BUG-LOW-006: Games Cache TTL (30s) May Cause Inconsistency After Toggle

**File:** `backend/src/routes/games/index.js` — Line 19

**Description:**  
When an admin toggles a game's active status, the games list is cached for 30 seconds. Users may see a game that was just disabled for up to 30 seconds.

---

## 8. ⚪ Informational — Best Practices & Improvements

### INFO-001: No Database Connection Pool Health Monitoring

**Description:**  
The MySQL pool has `connectionLimit: 10` and `queueLimit: 100`. There's no monitoring of pool saturation, connection leaks, or queue depth. The `/api/health` endpoint only checks if one `SELECT 1` succeeds.

**Recommendation:**  
Add pool event listeners for `'enqueue'` events and log when queue depth exceeds thresholds.

---

### INFO-002: No Request Logging / Access Logs

**Description:**  
There's no HTTP request logging middleware (like `morgan`). Server errors are logged but normal request flow is invisible.

**Recommendation:**  
Add `morgan` or a custom access log middleware for debugging and monitoring.

---

### INFO-003: No Rate Limiting on Game Endpoints

**Description:**  
Rate limiters exist for auth endpoints, spin, and fantasy, but the Aviator, Colour Trading, and Ludo game socket endpoints have no rate limiting. A malicious user could spam bet/cashout events.

**Recommendation:**  
Add per-user rate limiting on socket events (e.g., max 5 bets per second per user).

---

### INFO-004: Frontend Bundle Size Warning

**Description:**  
The Vite build output shows chunk size warnings. The entire app is a single-page app with no code splitting beyond dynamic imports. All 38+ admin views and all game views are loaded upfront.

**Recommendation:**  
Use `React.lazy()` and `Suspense` for admin and game views to split the bundle.

---

### INFO-005: No Password Strength Enforcement Beyond Length

**Description:**  
Passwords only require a minimum of 6 characters. No complexity requirements (uppercase, numbers, symbols).

**Recommendation:**  
Add password complexity validation (at least 1 number, 1 uppercase, minimum 8 characters).

---

### INFO-006: No Account Lockout After Failed Login Attempts

**Description:**  
There's a rate limiter (5 attempts per 15 minutes per IP), but no per-account lockout. An attacker using rotating IPs could brute-force passwords indefinitely.

**Recommendation:**  
Add per-account lockout after N failed attempts.

---

### INFO-007: Database Backup File Committed to Repository

**File:** `database_backup.sql` (17KB)

**Description:**  
A database backup SQL file is committed to the repository. This could contain sensitive table schemas and data.

**Recommendation:**  
Add `*.sql` to `.gitignore` and remove it from version history.

---

### INFO-008: No Helmet.js Security Headers

**Description:**  
The Express server does not use `helmet` middleware to set security headers (X-Content-Type-Options, X-Frame-Options, CSP, etc.).

**Recommendation:**  
Install and use `helmet`:
```javascript
const helmet = require('helmet');
app.use(helmet());
```

---

### INFO-009: `process.env.ALLOWED_ORIGINS` Not Set — Open CORS in Production

**File:** `backend/src/server.js` — Lines 203-216

**Description:**  
If `ALLOWED_ORIGINS` is not set in `.env`, the server allows ALL origins with a console warning. In the current `.env`, `ALLOWED_ORIGINS` is not set.

**Impact:**  
- Any website can make authenticated cross-origin requests to this API.

**Recommendation:**  
Set `ALLOWED_ORIGINS` in production `.env` to restrict CORS.

---

### INFO-010: No Graceful Shutdown Handler

**Description:**  
The server has `uncaughtException` and `unhandledRejection` handlers but no graceful shutdown handler for `SIGTERM`/`SIGINT`. Active database connections, timers, and game states are not cleaned up on shutdown.

**Recommendation:**  
Add a `process.on('SIGTERM')` handler that:
1. Stops accepting new connections
2. Clears game engine timers
3. Drains the DB connection pool
4. Exits cleanly

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 6 |
| 🟠 High | 9 |
| 🟡 Medium | 12 |
| 🟢 Low | 6 |
| ⚪ Info | 10 |
| **Total** | **43** |

### Top Priority Fixes

1. **BUG-SEC-001** — Fix LiveChat token keys (`'token'` → `'dv_token'`, `'adminToken'` → `'admin_dv_token'`)
2. **BUG-SEC-002** — Fix Socket.io admin auth to support admin JWT secret
3. **BUG-SEC-003** — Add authentication to upload endpoint
4. **BUG-SEC-004** — Fix OTP reuse in password reset
5. **BUG-FIN-001** — Fix Ludo abandoned room cleanup to refund players properly
6. **BUG-AUTH-002** — Remove admin token fallback to user JWT secret
7. **BUG-FIN-004/005** — Fix transaction ordering in deposit/withdrawal cancel handlers
