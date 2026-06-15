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

async function request(method: 'GET' | 'POST' | 'PUT', path: string, body?: any) {
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

async function adminRequest(method: 'GET' | 'POST' | 'PUT', path: string, body?: any) {
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

export const authAPI = {
  register: (userData: any) => request('POST', '/auth/register', userData),
  login: (credentials: any) => request('POST', '/auth/login', credentials),
  getProfile: () => request('GET', '/auth/profile'),
  updateProfile: (data: any) => request('PUT', '/auth/profile', data),
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
  aviatorBet: (amount: number) => request('POST', '/games/aviator/bet', { amount }),
  aviatorCashout: (winAmount: number) => request('POST', '/games/aviator/cashout', { winAmount }),
  colourTradingPlay: (amount: number, color: string) => request('POST', '/games/colourtrading/play', { amount, color })
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
  getUsers: () => adminRequest('GET', '/admin/users'),
  updateUser: (id: number, data: any) => adminRequest('PUT', `/admin/users/${id}`, data),
  adjustBalance: (id: number, action: 'add' | 'subtract', amount: number, description: string, wallet_type: 'main' | 'bonus' | 'referral' = 'main') => 
    adminRequest('POST', `/admin/users/${id}/balance`, { action, amount, description, wallet_type }),
  getSchemes: () => adminRequest('GET', '/admin/schemes'),
  createScheme: (data: any) => adminRequest('POST', '/admin/schemes', data),
  updateScheme: (id: number, data: any) => adminRequest('PUT', `/admin/schemes/${id}`, data),
  getUserDetails: (id: number) => adminRequest('GET', `/admin/users/${id}/details`),
  createUserFDR: (id: number, data: any) => adminRequest('POST', `/admin/users/${id}/fdr/create`, data),
  closeUserFDR: (id: number, fdrId: number) => adminRequest('POST', `/admin/users/${id}/fdr/${fdrId}/close`),
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
};
