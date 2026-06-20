// API wrapper for Digital_Viser platform

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function saveToken(token: string) {
  localStorage.setItem('dv_token', token);
}

export function getToken(): string | null {
  return localStorage.getItem('dv_token');
}

export function clearToken() {
  localStorage.removeItem('dv_token');
}

export function saveAdminToken(token: string) {
  localStorage.setItem('admin_dv_token', token);
}

export function getAdminToken(): string | null {
  return localStorage.getItem('admin_dv_token');
}

export function clearAdminToken() {
  localStorage.removeItem('admin_dv_token');
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

async function adminRequest(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: any) {
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
  resetPassword: (email: string, otp: string, new_password: string) => request('POST', '/auth/reset-password', { email, otp, new_password }),
};

export const walletAPI = {
  deposit: (amount: number, paymentMethod: string, customData?: any) => 
    request('POST', '/wallet/deposit', { amount, payment_method: paymentMethod, custom_data: customData }),
  withdraw: (amount: number, paymentMethod: string, sourceWallet: string = 'normal', customData?: any) => 
    request('POST', '/wallet/withdraw', { amount, payment_method: paymentMethod, source_wallet: sourceWallet, custom_data: customData }),
  getTransactions: () => request('GET', '/wallet/transactions'),
  getActiveMethods: () => request('GET', '/wallet/active-methods'),
  getConfig: () => request('GET', '/wallet/config'),
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
  getColourTradingBets: () => request('GET', '/games/simulations/colour-trading-bets'),
  colourTradingPlay: (amount: number, color: string) => request('POST', '/games/colourtrading/play', { amount, color }),
  fruitSlasherPlay: (amount: number, walletType: 'main' | 'gaming_bonus') => request('POST', '/games/fruitslasher/play', { amount, walletType }),
  fruitSlasherCashout: (betId: number, multiplier: number) => request('POST', '/games/fruitslasher/cashout', { betId, multiplier }),
  fruitSlasherCrash: (betId: number, multiplier: number) => request('POST', '/games/fruitslasher/crash', { betId, multiplier })
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

