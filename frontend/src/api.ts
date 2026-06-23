// API wrapper for Digital_Viser platform

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Memory store fallback if localStorage is blocked (e.g. sandboxed WebView or private mode)
const memoryStore: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`localStorage.getItem failed for "${key}", using memory store fallback`, err);
    return memoryStore[key] || null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`localStorage.setItem failed for "${key}", using memory store fallback`, err);
    memoryStore[key] = value;
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`localStorage.removeItem failed for "${key}", using memory store fallback`, err);
    delete memoryStore[key];
  }
}

export function saveToken(token: string) {
  safeSetItem('dv_token', token);
}

export function getToken(): string | null {
  return safeGetItem('dv_token');
}

export function clearToken() {
  safeRemoveItem('dv_token');
}

export function saveAdminToken(token: string) {
  safeSetItem('admin_dv_token', token);
}

export function getAdminToken(): string | null {
  return safeGetItem('admin_dv_token');
}

export function clearAdminToken() {
  safeRemoveItem('admin_dv_token');
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

async function request(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: any) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

export async function adminRequest(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: any) {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

export const uploadFile = async (file: File, folder: 'admin' | 'deposits' | 'withdrawals' | 'profiles'): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const token = getAdminToken() || getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers,
    body: formData
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Upload failed');
  }

  return data.url;
}

export const globalConfigAPI = {
  getConfig: () => request('GET', '/config'),
};

export const authAPI = {
  register: (userData: any) => request('POST', '/auth/register', userData),
  login: (credentials: any) => request('POST', '/auth/login', credentials),
  getProfile: () => request('GET', '/auth/profile'),
  updateProfile: (data: any) => request('PUT', '/auth/profile', data),
  getReferralStats: () => request('GET', '/auth/referral-stats'),
  forgotPassword: (email: string) => request('POST', '/auth/forgot-password', { email }),
  verifyOtp: (email: string, otp: string) => request('POST', '/auth/verify-otp', { email, otp }),
  resetPassword: (email: string, otp: string, new_password: string) => request('POST', '/auth/reset-password', { email, otp, new_password }),
};

export const walletAPI = {
  deposit: (amount: number, paymentMethod: string, customData?: any) => 
    request('POST', '/wallet/deposit', { amount, payment_method: paymentMethod, custom_data: customData }),
  // ISSUE-020/030 FIX: Default to 'main' (consistent with backend validator) not 'normal'
  withdraw: (amount: number, paymentMethod: string, sourceWallet: string = 'main', customData?: any) => 
    request('POST', '/wallet/withdraw', { amount, payment_method: paymentMethod, source_wallet: sourceWallet, custom_data: customData }),
  getTransactions: (page: number = 1) => request('GET', `/wallet/transactions?page=${page}`),
  getActiveMethods: () => request('GET', '/wallet/active-methods'),
  getConfig: () => request('GET', '/wallet/config'),
  getMyDeposits: () => request('GET', '/wallet/deposits'),
  getMyWithdrawals: () => request('GET', '/wallet/withdrawals'),
  cancelDeposit: (id: number) => request('POST', `/wallet/deposits/${id}/cancel`),
  cancelWithdrawal: (id: number) => request('POST', `/wallet/withdrawals/${id}/cancel`),
};

export const fdrAPI = {
  create: (fdrData: { amount: number; plan_id: number; }) => 
    request('POST', '/fdr/create', fdrData),
  getMyFDRs: () => request('GET', '/fdr/my-fdrs'),
  getActivePlans: () => request('GET', '/fdr/active-plans'),
  getPnL: () => request('GET', '/fdr/pnl'),
  forceCloseFDR: (id: number) => request('POST', '/fdr/force-close', { id }),
  getActiveOffers: () => request('GET', '/fdr/offers'),
};

export const gamesAPI = {
  getGames: () => request('GET', '/games'),
  getBigWins: () => request('GET', '/games/big-wins'),
  getAviatorChats: () => request('GET', '/games/simulations/aviator-chats'),
  getAviatorBets: () => request('GET', '/games/simulations/aviator-bets'),
  getRealMyAviatorBets: () => request('GET', '/games/aviator/my-bets'),
  getRealTopAviatorBets: () => request('GET', '/games/aviator/top-bets'),
  getRealRecentAviatorBets: () => request('GET', '/games/aviator/recent-bets'),
  getColourTradingBets: () => request('GET', '/games/simulations/colour-trading-bets'),
  getRealMyColourTradingBets: () => request('GET', '/games/colourtrading/my-bets'),
  getRealTopColourTradingBets: () => request('GET', '/games/colourtrading/top-bets'),
  getRealRecentColourTradingBets: () => request('GET', '/games/colourtrading/recent-bets'),
  getRealMyLudoBets: () => request('GET', '/games/ludo/my-bets'),
  getRealTopLudoBets: () => request('GET', '/games/ludo/top-wins'),
  getRealRecentLudoBets: () => request('GET', '/games/ludo/recent-bets'),
  colourTradingPlay: (amount: number, color: string) => request('POST', '/games/colourtrading/play', { amount, color }),
  fruitSlasherPlay: (amount: number, walletType: 'main' | 'gaming_bonus') => request('POST', '/games/fruitslasher/play', { amount, walletType }),
  fruitSlasherCashout: (betId: number, multiplier: number) => request('POST', '/games/fruitslasher/cashout', { betId, multiplier }),
  fruitSlasherCrash: (betId: number, multiplier: number) => request('POST', '/games/fruitslasher/crash', { betId, multiplier })
};

// ISSUE-019 FIX: Use adminRequest() (admin token) and correct path prefix /admin/fantasy/
export const adminFantasyAPI = {
  getMatches: () => adminRequest('GET', '/admin/fantasy/matches'),
  updateMatchStatus: (matchId: string, status: string) => adminRequest('PUT', `/admin/fantasy/matches/${matchId}/status`, { status }),
  settleMatch: (matchId: string) => adminRequest('POST', `/admin/fantasy/matches/${matchId}/settle`),
  cancelMatch: (matchId: string) => adminRequest('POST', `/admin/fantasy/matches/${matchId}/cancel`),
};

// --- Support Tickets API ---
export const supportAPI = {
  getTickets: () => request('GET', '/support'),
  getTicket: (id: string | number) => request('GET', `/support/${id}`),
  createTicket: (subject: string, message: string, category?: string, priority?: string) => request('POST', '/support', { subject, message, category, priority }),
  replyTicket: (id: string | number, message: string) => request('POST', `/support/${id}/reply`, { message }),
  closeTicket: (id: string | number) => request('PUT', `/support/${id}/close`),
};

export const adminSupportAPI = {
  getTickets: (params?: any) => {
    let query = '';
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.append('status', params.status);
      if (params.search) searchParams.append('search', params.search);
      query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    }
    return adminRequest('GET', `/admin/support${query}`);
  },
  getTicket: (id: string | number) => adminRequest('GET', `/admin/support/${id}`),
  replyTicket: (id: string | number, message: string) => adminRequest('POST', `/admin/support/${id}/reply`, { message }),
  updateStatus: (id: string | number, status?: string, priority?: string) => adminRequest('PUT', `/admin/support/${id}/status`, { status, priority }),
};

export const fantasyAPI = {
  getMatches: (status: 'upcoming' | 'live' | 'completed' | string = 'upcoming') => request('GET', `/fantasy/matches?status=${status}`),
  getMatchSquad: (id: number) => request('GET', `/fantasy/match/${id}/squad`),
  getMatchContests: (id: number) => request('GET', `/fantasy/match/${id}/contests`),
  createTeam: (data: { matchId: number; playerIds: number[]; captainId: number; viceCaptainId: number }) => request('POST', '/fantasy/team', data),
  getMyTeams: (matchId: number) => request('GET', `/fantasy/match/${matchId}/my-teams`),
  updateTeam: (teamId: number, data: { captainId: number; viceCaptainId: number }) => request('PUT', `/fantasy/team/${teamId}`, data),
  deleteTeam: (teamId: number) => request('DELETE', `/fantasy/team/${teamId}`),
  joinContest: (data: { contestId: number; teamId: number }) => request('POST', '/fantasy/contest/join', data),
  getLeaderboard: (contestId: number) => request('GET', `/fantasy/contest/${contestId}/leaderboard`),
  getMyEntries: () => request('GET', '/fantasy/my-entries')
};

export const adminAPI = {
  login: (credentials: any) => adminRequest('POST', '/admin/auth/login', credentials),
  getStats: () => adminRequest('GET', '/admin/stats'),
  getMethods: () => adminRequest('GET', '/admin/methods'),
  createMethod: (data: any) => adminRequest('POST', '/admin/methods', data),
  updateMethod: (id: number, data: any) => adminRequest('PUT', `/admin/methods/${id}`, data),
  deleteMethod: (id: number) => adminRequest('DELETE', `/admin/methods/${id}`),
  getFdrPlans: () => adminRequest('GET', '/admin/fdr-plans'),
  getFdrOffers: () => adminRequest('GET', '/admin/fdr-offers'),
  createFdrOffer: (data: any) => adminRequest('POST', '/admin/fdr-offers', data),
  updateFdrOffer: (id: number, data: any) => adminRequest('PUT', `/admin/fdr-offers/${id}`, data),
  deleteFdrOffer: (id: number) => adminRequest('DELETE', `/admin/fdr-offers/${id}`),
  createFdrPlan: (data: any) => adminRequest('POST', '/admin/fdr-plans', data),
  updateFdrPlan: (id: number, data: any) => adminRequest('PUT', `/admin/fdr-plans/${id}`, data),
  deleteFdrPlan: (id: number) => adminRequest('DELETE', `/admin/fdr-plans/${id}`),
  getRequests: () => adminRequest('GET', '/admin/requests'),
  approveDeposit: (id: number) => adminRequest('POST', `/admin/deposits/${id}/approve`),
  rejectDeposit: (id: number) => adminRequest('POST', `/admin/deposits/${id}/reject`),
  approveWithdrawal: (id: number) => adminRequest('POST', `/admin/withdrawals/${id}/approve`),
  rejectWithdrawal: (id: number) => adminRequest('POST', `/admin/withdrawals/${id}/reject`),
  adminUserWithdraw: (userId: number, data: { amount: number; payment_method?: string; source_wallet?: string; description?: string }) =>
    adminRequest('POST', `/admin/users/${userId}/withdraw`, data),
  getUsers: () => adminRequest('GET', '/admin/users'),
  updateUser: (id: number, data: any) => adminRequest('PUT', `/admin/users/${id}`, data),
  updateUserReferrer: (id: number, invited_by: number | null) => adminRequest('PUT', `/admin/users/${id}/invited-by`, { invited_by }),
  adjustBalance: (id: number, action: 'add' | 'subtract', amount: number, description: string, wallet_type: 'main' | 'bonus' | 'referral' = 'main') => 
    adminRequest('POST', `/admin/users/${id}/balance`, { action, amount, description, wallet_type }),
  getSchemes: () => adminRequest('GET', '/admin/schemes'),
  createScheme: (data: any) => adminRequest('POST', '/admin/schemes', data),
  updateScheme: (id: number, data: any) => adminRequest('PUT', `/admin/schemes/${id}`, data),
  getUserDetails: (id: number) => adminRequest('GET', `/admin/users/${id}/details`),
  createUserFDR: (id: number, data: any) => adminRequest('POST', `/admin/users/${id}/fdr/create`, data),
  closeUserFDR: (id: number, fdrId: number) => adminRequest('POST', `/admin/users/${id}/fdr/${fdrId}/close`),
  changeUserPassword: (id: number, password: string) => adminRequest('PUT', `/admin/users/${id}/password`, { password }),
  lockUserFunds: (id: number, data: any) => adminRequest('POST', `/admin/users/${id}/lock-funds`, data),
  unlockUserFunds: (id: number, lockId: number) => adminRequest('POST', `/admin/users/${id}/unlock-funds/${lockId}`),
  updateUpiSettings: (upi_id: string) => adminRequest('POST', '/admin/settings/upi', { upi_id }),
  deleteScheme: (id: number) => adminRequest('DELETE', `/admin/schemes/${id}`),
  getProfile: () => adminRequest('GET', '/admin/profile'),
  updateProfile: (data: any) => adminRequest('PUT', '/admin/profile', data),
  deleteUser: (id: number) => adminRequest('DELETE', `/admin/users/${id}`),
  getGames: () => adminRequest('GET', '/admin/games'),
  getGameAnalytics: () => adminRequest('GET', '/admin/games/analytics'),
  getGamePlayersAnalytics: () => adminRequest('GET', '/admin/games/players'),
  updateGameStatus: (id: number, is_active: boolean) => adminRequest('PUT', `/admin/games/${id}`, { is_active }),
  updateGameLimits: (id: number, limits: { min_bet: number; max_bet: number }) => adminRequest('PUT', `/admin/games/${id}/limits`, limits),
  getSettings: () => adminRequest('GET', '/admin/settings'),
  updateSettings: (settings: any) => adminRequest('PUT', '/admin/settings', { settings }),
  getAdminFdrs: () => adminRequest('GET', '/admin/fdrs'),
  updateAdminFdr: (id: number, data: any) => adminRequest('PUT', `/admin/fdrs/${id}`, data),
  closeAdminFdr: (id: number) => adminRequest('POST', `/admin/fdrs/${id}/close`),
  getBigWins: () => adminRequest('GET', '/admin/big-wins'),
  createBigWin: (data: any) => adminRequest('POST', '/admin/big-wins', data),
  updateBigWin: (id: number, data: any) => adminRequest('PUT', `/admin/big-wins/${id}`, data),
  deleteBigWin: (id: number) => adminRequest('DELETE', `/admin/big-wins/${id}`),
  getSimulatedAviatorChats: () => adminRequest('GET', '/admin/simulations/aviator-chats'),
  createSimulatedAviatorChat: (data: any) => adminRequest('POST', '/admin/simulations/aviator-chats', data),
  updateSimulatedAviatorChat: (id: number, data: any) => adminRequest('PUT', `/admin/simulations/aviator-chats/${id}`, data),
  deleteSimulatedAviatorChat: (id: number) => adminRequest('DELETE', `/admin/simulations/aviator-chats/${id}`),
  getSimulatedAviatorBets: () => adminRequest('GET', '/admin/simulations/aviator-bets'),
  createSimulatedAviatorBet: (data: any) => adminRequest('POST', '/admin/simulations/aviator-bets', data),
  updateSimulatedAviatorBet: (id: number, data: any) => adminRequest('PUT', `/admin/simulations/aviator-bets/${id}`, data),
  deleteSimulatedAviatorBet: (id: number) => adminRequest('DELETE', `/admin/simulations/aviator-bets/${id}`),
  getSimulatedColourTradingBets: () => adminRequest('GET', '/admin/simulations/colour-trading-bets'),
  createSimulatedColourTradingBet: (data: any) => adminRequest('POST', '/admin/simulations/colour-trading-bets', data),
  updateSimulatedColourTradingBet: (id: number, data: any) => adminRequest('PUT', `/admin/simulations/colour-trading-bets/${id}`, data),
  deleteSimulatedColourTradingBet: (id: number) => adminRequest('DELETE', `/admin/simulations/colour-trading-bets/${id}`),
  // Spin Wheel Admin
  getSpinSegments: () => adminRequest('GET', '/admin/spin-segments'),
  createSpinSegment: (data: any) => adminRequest('POST', '/admin/spin-segments', data),
  updateSpinSegment: (id: number, data: any) => adminRequest('PUT', `/admin/spin-segments/${id}`, data),
  deleteSpinSegment: (id: number) => adminRequest('DELETE', `/admin/spin-segments/${id}`),
  getSpinHistory: () => adminRequest('GET', '/admin/spin-history'),
  deleteSpinHistory: (id: number) => adminRequest('DELETE', `/admin/spin-history/${id}`),
  getSpinStats: () => adminRequest('GET', '/admin/spin-stats'),
  getReferralStats: () => adminRequest('GET', '/admin/referrals/stats'),
  releaseLockedReferral: () => adminRequest('POST', '/admin/referrals/release-locked'),
  getTransactions: (page: number = 1, limit: number = 50) => adminRequest('GET', `/admin/transactions?page=${page}&limit=${limit}`),
  getBets: (page: number = 1, limit: number = 50) => adminRequest('GET', `/admin/bets?page=${page}&limit=${limit}`),
  getLoginHistory: (page: number = 1, limit: number = 50) => adminRequest('GET', `/admin/login-history?page=${page}&limit=${limit}`),
  getActivityLog: (page: number = 1, limit: number = 50) => adminRequest('GET', `/admin/activity-log?page=${page}&limit=${limit}`),
  getActiveUsers: (period: string = '24h', page: number = 1, limit: number = 50) => adminRequest('GET', `/admin/active-users?period=${period}&page=${page}&limit=${limit}`),
  getUserFdrPlanBlocks: (userId: number) => adminRequest('GET', `/admin/users/${userId}/fdr-plan-blocks`),
  blockUserFdrPlan: (userId: number, planId: number) => adminRequest('POST', `/admin/users/${userId}/fdr-plan-blocks`, { plan_id: planId }),
  unblockUserFdrPlan: (userId: number, planId: number) => adminRequest('DELETE', `/admin/users/${userId}/fdr-plan-blocks/${planId}`),
  // Ludo Admin
  getLudoSettings: () => adminRequest('GET', '/admin/ludo/settings'),
  updateLudoSettings: (data: any) => adminRequest('PUT', '/admin/ludo/settings', data),
  getLudoRooms: (page: number = 1, limit: number = 50) => adminRequest('GET', `/admin/ludo/rooms?page=${page}&limit=${limit}`),
  getLudoRoomDetail: (id: number) => adminRequest('GET', `/admin/ludo/rooms/${id}`),
  deleteLudoRoom: (id: number) => adminRequest('DELETE', `/admin/ludo/rooms/${id}`),
  getLudoStats: () => adminRequest('GET', '/admin/ludo/stats'),
  getLudoBots: () => adminRequest('GET', '/admin/bots'),
  createLudoBot: (data: any) => adminRequest('POST', '/admin/bots', data),
  updateLudoBot: (id: number, data: any) => adminRequest('PUT', `/admin/bots/${id}`, data),
  deleteLudoBot: (id: number) => adminRequest('DELETE', `/admin/bots/${id}`),
  getLudoTournaments: () => adminRequest('GET', '/admin/ludo/tournaments'),
  createLudoTournament: (data: any) => adminRequest('POST', '/admin/ludo/tournaments', data),
  updateLudoTournament: (id: number, data: any) => adminRequest('PUT', `/admin/ludo/tournaments/${id}`, data),
  deleteLudoTournament: (id: number) => adminRequest('DELETE', `/admin/ludo/tournaments/${id}`),
  getLudoTournamentStandings: (id: number) => adminRequest('GET', `/admin/ludo/tournaments/${id}/standings`),
  processLudoTournament: (id: number) => adminRequest('POST', `/admin/ludo/tournaments/${id}/process`),
};

export const ludoAPI = {
  getTournaments: () => request('GET', '/ludo/tournaments'),
  getTournamentDetail: (id: number) => request('GET', `/ludo/tournaments/${id}`),
  joinTournament: (id: number) => request('POST', `/ludo/tournaments/${id}/join`),
  getTournamentStandings: (id: number) => request('GET', `/ludo/tournaments/${id}/standings`),
  getMyTournaments: () => request('GET', '/ludo/tournaments/joined'),
  getMyTournamentStats: (id: number) => request('GET', `/ludo/tournaments/${id}/my-stats`),
};

// Activity tracking
let lastTrackedUrl = '';
let lastTrackedTime = 0;

export const trackActivity = async (page_url: string = '/') => {
  const token = getToken();
  if (!token) return;
  const now = Date.now();
  if (page_url === lastTrackedUrl && now - lastTrackedTime < 30000) return;
  lastTrackedUrl = page_url;
  lastTrackedTime = now;
  try {
    await request('POST', '/activity/track', { page_url });
  } catch {
    // silently fail
  }
};

export const spinAPI = {
  getStatus: () => request('GET', '/spin/status'),
  claim: () => request('POST', '/spin/claim'),
  getSegments: () => request('GET', '/spin/segments'),
  getHistory: () => request('GET', '/spin/history'),
};

export const yieldBoosterAPI = {
  getUserBoosters: () => request('GET', '/yield-boosters'),
  claimBooster: (id: number) => request('POST', `/yield-boosters/${id}/claim`),
  getAdminBoosters: () => adminRequest('GET', '/admin/yield-boosters'),
  createAdminBooster: (data: any) => adminRequest('POST', '/admin/yield-boosters', data),
  updateAdminBooster: (id: number, data: any) => adminRequest('PUT', `/admin/yield-boosters/${id}`, data),
  deleteAdminBooster: (id: number) => adminRequest('DELETE', `/admin/yield-boosters/${id}`),
};

export const dailyTasksAPI = {
  getTasks: () => request('GET', '/daily-tasks'),
  checkIn: () => request('POST', '/daily-tasks/check-in'),
  claimTask: (id: number) => request('POST', `/daily-tasks/${id}/claim`),
  claimAllDone: () => request('POST', '/daily-tasks/claim-all-done'),
  getAdminTasks: () => adminRequest('GET', '/admin/daily-tasks'),
  createAdminTask: (data: any) => adminRequest('POST', '/admin/daily-tasks', data),
  updateAdminTask: (id: number, data: any) => adminRequest('PUT', `/admin/daily-tasks/${id}`, data),
  deleteAdminTask: (id: number) => adminRequest('DELETE', `/admin/daily-tasks/${id}`),
  saveAdminSettings: (data: { reward_amount: number; wallet_type: 'main' | 'bonus' }) => adminRequest('POST', '/admin/daily-tasks/settings', data)
};

export const adminCronAPI = {
  getJobs: () => adminRequest('GET', '/admin/cron/jobs'),
  getHistory: (limit?: number) => adminRequest('GET', `/admin/cron/history${limit ? `?limit=${limit}` : ''}`),
  triggerJob: (jobKey: string) => adminRequest('POST', `/admin/cron/trigger/${jobKey}`),
};

