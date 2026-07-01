import React, { useState, useEffect, useMemo } from 'react';
import { walletAPI, uploadFile, globalConfigAPI } from '../api';
import { CheckCircle2, AlertCircle, Info, Clock, XCircle, Ban } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface WithdrawProps {
  user: {
    name: string;
    email: string;
    balance: number | string;
  } | null;
  refreshUser: () => Promise<void>;
}

const WithdrawalTimer: React.FC<{ createdAt: string }> = ({ createdAt }) => {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; isLate: boolean }>({ hours: 0, minutes: 0, seconds: 0, isLate: false });

  useEffect(() => {
    const calculateTime = () => {
      const createdTime = new Date(createdAt).getTime();
      const targetTime = createdTime + 24 * 60 * 60 * 1000;
      const diff = targetTime - Date.now();

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isLate: true });
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds, isLate: false });
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [createdAt]);

  if (timeLeft.isLate) {
    return (
      <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600, background: 'rgba(245, 158, 11, 0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
        <Clock size={12} />
        <span>Late (High Priority Processing)</span>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#10b981', fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
      <Clock size={12} />
      <span>
        Est. Approval: {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s
      </span>
    </div>
  );
};

export const Withdraw: React.FC<WithdrawProps> = ({ user, refreshUser }) => {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [sourceWallet, setSourceWallet] = useState('main');
  const [paymentChannels, setPaymentChannels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [successData, setSuccessData] = useState<any>(null);
  const [error, setError] = useState('');

  // Withdrawal Limits State
  const [activeLimits, setActiveLimits] = useState<any[]>([]);
  const [todayWithdrawals, setTodayWithdrawals] = useState(0);
  const [lockStatus, setLockStatus] = useState<{ is_locked: boolean; locked_until: string | null; message: string }>({ is_locked: false, locked_until: null, message: '' });

  // Dynamic Form State
  const [customData, setCustomData] = useState<Record<string, any>>({});

  // Recent withdrawals
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  // Global Config for Coin Charges
  const [allowCoinCharges, setAllowCoinCharges] = useState(false);
  const [coinChargeRate, setCoinChargeRate] = useState(1);
  const [useCoins, setUseCoins] = useState(false);

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const methods = await walletAPI.getActiveMethods();
        const withdrawMethods = methods.filter((m: any) => m.type === 'withdraw');
        setPaymentChannels(withdrawMethods);
        if (withdrawMethods.length > 0) {
          setPaymentMethod(withdrawMethods[0].name);
        }
      } catch (err) {
        console.error('Failed to fetch withdraw methods');
      }
    };
    
    const fetchLimits = async () => {
      try {
        const data = await walletAPI.getWithdrawalLimits();
        setActiveLimits(data.limits || []);
        setTodayWithdrawals(data.today_withdrawals || 0);
        if (data.lock_status) {
          setLockStatus(data.lock_status);
        }
      } catch (err) {
        console.error('Failed to fetch withdrawal limits');
      }
    };

    const fetchConfig = async () => {
      try {
        const config = await globalConfigAPI.getConfig();
        setAllowCoinCharges(config.allow_coin_withdrawal_charges);
        setCoinChargeRate(config.coin_to_inr_charge_rate || 1);
      } catch (err) {
        console.error('Failed to fetch global config');
      }
    };

    Promise.all([fetchMethods(), fetchWithdrawals(), fetchLimits(), fetchConfig()]).finally(() => {
      setIsFetching(false);
    });
  }, []);

  const fetchWithdrawals = async () => {
    setWithdrawalsLoading(true);
    try {
      const data = await walletAPI.getMyWithdrawals();
      setWithdrawals(data);
    } catch (err) {
      console.error('Failed to fetch withdrawals');
    } finally {
      setWithdrawalsLoading(false);
    }
  };

  const handleCancelWithdrawal = async (id: number) => {
    if (!window.confirm('Cancel this withdrawal request? Your funds will be refunded.')) return;
    setCancellingId(id);
    try {
      await walletAPI.cancelWithdrawal(id);
      fetchWithdrawals();
      await refreshUser();
    } catch (err: any) {
      alert(err?.error || 'Failed to cancel withdrawal');
    } finally {
      setCancellingId(null);
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'pending') return <Clock size={14} />;
    if (status === 'approved') return <CheckCircle2 size={14} />;
    return <XCircle size={14} />;
  };

  const statusStyle = (status: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px',
    fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
    background: status === 'pending' ? 'rgba(245,158,11,0.15)' : status === 'approved' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
    color: status === 'pending' ? '#f59e0b' : status === 'approved' ? '#10b981' : '#ef4444',
  });

  const selectedMethod = paymentChannels.find(m => m.name === paymentMethod);
  const adminInstructions = selectedMethod?.admin_instructions ? (typeof selectedMethod.admin_instructions === 'string' ? JSON.parse(selectedMethod.admin_instructions) : selectedMethod.admin_instructions) : [];
  const userForm = selectedMethod?.user_form ? (typeof selectedMethod.user_form === 'string' ? JSON.parse(selectedMethod.user_form) : selectedMethod.user_form) : [];
  const withdrawalCharges = selectedMethod?.withdrawal_charges ? (typeof selectedMethod.withdrawal_charges === 'string' ? JSON.parse(selectedMethod.withdrawal_charges) : selectedMethod.withdrawal_charges) : [];

  const numericAmount = parseFloat(amount) || 0;
  
  const chargeDetails: { name: string; amount: number }[] = [];
  let totalChargeAmount = 0;
  
  withdrawalCharges.forEach((charge: any) => {
    let amt = 0;
    if (charge.type === 'percent') {
      amt = (numericAmount * parseFloat(charge.value)) / 100;
    } else if (charge.type === 'fixed') {
      amt = parseFloat(charge.value);
    }
    if (amt > 0) {
      const roundedAmt = Math.round(amt * 100) / 100;
      totalChargeAmount += roundedAmt;
      chargeDetails.push({ name: charge.name, amount: roundedAmt });
    }
  });
  
  const earlyFee = Math.round(totalChargeAmount * 100) / 100;
  
  const coinsRequired = earlyFee * coinChargeRate;
  const netPayout = useCoins ? numericAmount : (numericAmount - earlyFee);

  const handleCustomDataChange = (label: string, value: any) => {
    setCustomData(prev => ({ ...prev, [label]: value }));
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessData(null);

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid withdrawal amount greater than 0.');
      return;
    }

    const walletBalances: Record<string, number> = {
      main: user ? parseFloat((user as any).balance || '0') : 0,
      bonus: user ? parseFloat((user as any).bonus_balance || '0') : 0,
      referral: user ? parseFloat((user as any).referral_balance || '0') : 0
    };

    let maxAllowed = walletBalances[sourceWallet] || 0;
    
    // Evaluate Intelligent Limits
    const applicableLimits = activeLimits.filter(l => l.wallet_type === sourceWallet || l.wallet_type === 'overall');
    let limitExceededError = '';
    
    for (const limit of applicableLimits) {
      let allowedByLimit = Infinity;
      if (limit.limit_type === 'percent_of_balance') {
        allowedByLimit = maxAllowed * (parseFloat(limit.limit_value) / 100);
      } else if (limit.limit_type === 'fixed') {
        if (limit.time_window === 'per_transaction') {
          allowedByLimit = parseFloat(limit.limit_value);
        } else if (limit.time_window === 'daily') {
          allowedByLimit = Math.max(0, parseFloat(limit.limit_value) - todayWithdrawals);
        }
      }
      
      if (numericAmount > allowedByLimit) {
        const reason = limit.limit_type === 'percent_of_balance' 
          ? `${limit.limit_value}% of balance` 
          : (limit.time_window === 'daily' ? `₹${limit.limit_value} daily` : `₹${limit.limit_value} per transaction`);
        limitExceededError = `Withdrawal limit exceeded. Maximum allowed is ₹${allowedByLimit.toFixed(2)} based on the ${reason} limit.`;
      }
      maxAllowed = Math.min(maxAllowed, allowedByLimit);
    }

    if (limitExceededError) {
      setError(limitExceededError);
      return;
    }

    if (numericAmount > (walletBalances[sourceWallet] || 0)) {
      setError(`Insufficient balance in selected wallet.`);
      return;
    }

    if (selectedMethod) {
      const minLimit = parseFloat(selectedMethod.min_amount || '0');
      const maxLimit = parseFloat(selectedMethod.max_amount || '10000000');
      if (numericAmount < minLimit) {
        setError(`Minimum withdrawal amount for this method is ₹${minLimit.toLocaleString()}.`);
        return;
      }
      if (numericAmount > maxLimit) {
        setError(`Maximum withdrawal amount for this method is ₹${maxLimit.toLocaleString()}.`);
        return;
      }
    }

    setIsLoading(true);
    try {
      // 1. Upload any files in customData first
      const finalCustomData = { ...customData };
      for (const field of userForm) {
        if (field.type === 'file' && finalCustomData[field.label]) {
          const file = finalCustomData[field.label];
          if (file instanceof File) {
            const url = await uploadFile(file, 'withdrawals');
            finalCustomData[field.label] = url;
          }
        }
      }

      // 2. Submit withdrawal
      const result = await walletAPI.withdraw(numericAmount, paymentMethod, sourceWallet, finalCustomData, useCoins);
      setSuccessData(result.withdrawal || { amount: numericAmount, payment_method: paymentMethod, transaction_id: 'pending-approval' });
      setAmount('');
      setCustomData({});
      // refresh user to reflect deducted balance immediately
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Withdrawal transaction failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '800px' }}>
      
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Withdraw Funds</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Request a withdrawal of your available wallet balance. (Requires Admin Approval)
        </p>
      </div>

      {/* 24/7 Withdrawal Facility Achievement Banner */}
      <div className="achievement-banner-card">
        <div className="achievement-banner-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="6"/>
            <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <div className="achievement-banner-title">
            <span>🎉 CONGRATULATIONS! ACCOUNT PRIVILEGE UNLOCKED</span>
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.5px' }}>
              ✨ ELIGIBLE
            </span>
          </div>
          <p style={{ color: 'var(--text-primary)', fontSize: '0.92rem', lineHeight: 1.5, margin: 0 }}>
            Your account is verified and eligible for our <strong style={{ color: '#f59e0b' }}>24/7 Express Daily Withdrawal Facility</strong>! Enjoy hassle-free payout requests anytime with high-priority processing.
          </p>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginTop: '4px', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#f59e0b' }}>⚡</span> Availability: 24 Hours / Daily
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#10b981' }}>🛡️</span> Processing Time: Within 24 - 48 Hours
            </span>
          </div>
        </div>
      </div>

      {lockStatus.is_locked ? (
        <div className="glass-card glow-card" style={{ textAlign: 'center', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', border: '1px solid rgba(239, 68, 68, 0.35)', boxShadow: '0 0 40px rgba(239, 68, 68, 0.15)' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <Ban size={36} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--accent-danger)', marginBottom: '8px' }}>Withdrawals Locked</h3>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 500, marginBottom: '8px' }}>
              {lockStatus.message}
            </p>
            {lockStatus.locked_until && new Date(lockStatus.locked_until).getFullYear() !== 2099 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Your functionality will be automatically restored on:<br/>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(lockStatus.locked_until).toLocaleString()}</span>
              </p>
            )}
          </div>
        </div>
      ) : successData ? (
        <div className="glass-card glow-card" style={{ textAlign: 'center', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', border: '1px solid rgba(0, 245, 160, 0.35)', boxShadow: '0 0 40px rgba(0, 245, 160, 0.15)' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(0, 245, 160, 0.1)', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0, 245, 160, 0.3)' }}>
            <CheckCircle2 size={36} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '8px' }}>Withdrawal Request Submitted!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              Your funds have been deducted from your wallet and are awaiting administrator processing.
            </p>
          </div>
          <button onClick={() => setSuccessData(null)} className="btn btn-primary" style={{ marginTop: '10px' }}>
            Make Another Request
          </button>
        </div>
      ) : (
        <div className="responsive-two-col" style={{ alignItems: 'flex-start' }}>
          {/* Main Withdraw Form */}
          <div className="glass-card" style={{ flex: '1.5' }}>
            <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', border: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(234, 179, 8, 0.1)', padding: '8px', borderRadius: '50%', color: 'var(--accent-primary)' }}>
                  <AlertCircle size={20} />
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Available Balance ({sourceWallet})</span>
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                ₹{user ? parseFloat(((user as any)[sourceWallet === 'main' ? 'balance' : `${sourceWallet}_balance`] || '0')).toLocaleString() : '0.00'}
              </span>
            </div>
            
            {/* Active Constraints Information */}
            {activeLimits.filter(l => l.wallet_type === sourceWallet || l.wallet_type === 'overall').length > 0 && (
              <div style={{ background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '24px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Active Withdrawal Constraints:</p>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {activeLimits.filter(l => l.wallet_type === sourceWallet || l.wallet_type === 'overall').map((limit, idx) => (
                    <li key={idx}>
                      Maximum {limit.limit_type === 'percent_of_balance' ? `${limit.limit_value}% of balance` : `₹${limit.limit_value}`} 
                      {limit.time_window === 'daily' ? ` (Daily Limit. Used today: ₹${todayWithdrawals.toFixed(2)})` : ' (Per Transaction)'}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Withdrawal Charges Summary */}
            {chargeDetails.length > 0 && numericAmount > 0 && (
              <div style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-glass)',
                borderRadius: '12px', padding: '16px',
                marginBottom: '20px',
                display: 'flex', flexDirection: 'column', gap: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Info size={16} color="var(--accent-primary)" />
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Withdrawal Charges</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {chargeDetails.map((charge, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>{charge.name}</span>
                      <span>-₹{charge.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border-light)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <span>Total Deduction</span>
                    <span>-₹{earlyFee.toFixed(2)}</span>
                  </div>

                  {allowCoinCharges && earlyFee > 0 && (
                    <div style={{ marginTop: '12px', background: 'rgba(234, 179, 8, 0.05)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        <input
                          type="checkbox"
                          checked={useCoins}
                          onChange={(e) => setUseCoins(e.target.checked)}
                          disabled={(parseFloat((user as any)?.coin_balance || '0') < coinsRequired)}
                        />
                        <span>Pay charges with Coins (Cost: <b>{coinsRequired} 🪙</b>)</span>
                      </label>
                      {parseFloat((user as any)?.coin_balance || '0') < coinsRequired && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-danger)', marginTop: '4px', marginLeft: '24px' }}>
                          Insufficient Coin Balance (You have {(user as any)?.coin_balance || '0'} 🪙)
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--accent-secondary)', marginTop: '8px', fontSize: '1rem' }}>
                    <span>You Receive</span>
                    <span>₹{netPayout.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--accent-danger)', padding: '12px 16px', borderRadius: '4px', marginBottom: '24px', color: 'var(--accent-danger)' }}>
                {error}
              </div>
            )}

            {isFetching ? (
              <LoadingSpinner message="Loading payment channels..." />
            ) : paymentChannels.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active withdrawal channels available. Please contact support.
              </div>
            ) : (
              <form onSubmit={handleWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label className="input-label">Withdrawal Amount (₹)</label>
                  <input
                    type="number"
                    className="input-field"
                    style={{ fontSize: '1.5rem', padding: '16px', fontWeight: 600, fontFamily: 'var(--font-headings)' }}
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    min="1"
                    max={user ? parseFloat(((user as any)[sourceWallet === 'main' ? 'balance' : `${sourceWallet}_balance`] || '0')) : undefined}
                  />
                  {selectedMethod && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
                      Allowed Limit: ₹{parseFloat(selectedMethod.min_amount || '0').toLocaleString()} - ₹{parseFloat(selectedMethod.max_amount || '10000000').toLocaleString()}
                    </span>
                  )}
                </div>

                <div>
                  <label className="input-label">Wallet Source</label>
                  <select
                    className="input-field"
                    value={sourceWallet}
                    onChange={(e) => setSourceWallet(e.target.value)}
                    required
                  >
                    <option value="main">Main Wallet</option>
                    <option value="bonus">Bonus Wallet</option>
                    <option value="referral">Referral Wallet</option>
                  </select>
                </div>

                <div>
                  <label className="input-label">Withdraw To Channel</label>
                  <select
                    className="input-field"
                    value={paymentMethod}
                    onChange={(e) => {
                      setPaymentMethod(e.target.value);
                      setCustomData({}); // Reset dynamic fields
                    }}
                    required
                  >
                    {paymentChannels.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Render Dynamic User Form Fields */}
                {userForm.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Provide Receiving Details</h4>
                    {userForm.map((field: any, idx: number) => (
                      <div key={idx}>
                        <label className="input-label">
                          {field.label} {field.required && <span style={{ color: 'var(--accent-danger)' }}>*</span>}
                        </label>
                        {field.type === 'file' ? (
                          <input 
                            type="file" 
                            className="input-field"
                            onChange={e => {
                              if (e.target.files && e.target.files[0]) {
                                handleCustomDataChange(field.label, e.target.files[0]);
                              }
                            }}
                            required={field.required}
                          />
                        ) : (
                          <input 
                            type={field.type === 'number' ? 'number' : 'text'}
                            className="input-field"
                            value={customData[field.label] || ''}
                            onChange={e => handleCustomDataChange(field.label, e.target.value)}
                            required={!!field.required}
                            placeholder={`Enter ${field.label}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn"
                  style={{ width: '100%', padding: '16px', fontSize: '1.1rem', marginTop: '10px', background: 'var(--accent-primary)', color: '#000', fontWeight: 700 }}
                  disabled={isLoading || !amount || parseFloat(amount) <= 0 || (user && parseFloat(amount) > parseFloat(((user as any)[sourceWallet === 'main' ? 'balance' : `${sourceWallet}_balance`] || '0'))) || netPayout <= 0}
                >
                  {isLoading ? 'Processing Request...' : `Withdraw ${amount ? `₹${parseFloat(amount).toLocaleString()}` : ''}`}
                </button>
              </form>
            )}
          </div>

          {/* Admin Instructions Sidebar (Rare for Withdrawals, but supported) */}
          {adminInstructions && adminInstructions.length > 0 && (
            <div className="glass-card" style={{ flex: 1, padding: '24px', background: 'var(--bg-tertiary)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
                Important Instructions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {adminInstructions.map((inst: any, idx: number) => (
                  <div key={idx}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{inst.label}</p>
                    {inst.type === 'file' && inst.value ? (
                      <img src={`/api${inst.value}`} alt={inst.label} style={{ maxWidth: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }} />
                    ) : (
                      <div style={{ background: 'var(--bg-primary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.95rem', fontWeight: 500, wordBreak: 'break-all' }}>
                        {inst.value}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Withdrawals History */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} /> Recent Withdrawals
        </h3>
        {withdrawalsLoading ? (
          <LoadingSpinner message="Loading history..." />
        ) : withdrawals.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px', fontSize: '0.9rem' }}>No recent withdrawals</p>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="withdrawal-desktop-table">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Amount</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Method</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Wallet</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Date</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w: any) => {
                    const wd = typeof w.custom_data === 'string' ? JSON.parse(w.custom_data) : (w.custom_data || {});
                    return (
                      <tr key={w.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px', fontWeight: 600 }}>₹{parseFloat(w.amount || '0').toFixed(2)}</td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{w.payment_method || '-'}</td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{wd.source_wallet || 'normal'}</td>
                        <td style={{ padding: '12px' }}>
                          <div><span style={statusStyle(w.status)}>{statusIcon(w.status)}{w.status}</span></div>
                          {w.status === 'pending' && <WithdrawalTimer createdAt={w.created_at} />}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{new Date(w.created_at).toLocaleString()}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          {w.status === 'pending' && (
                            <button
                              onClick={() => handleCancelWithdrawal(w.id)}
                              disabled={cancellingId === w.id}
                              style={{
                                background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)',
                                padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                              }}
                            >
                              <Ban size={12} /> {cancellingId === w.id ? '...' : 'Cancel'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="withdrawal-mobile-cards">
              {withdrawals.map((w: any) => {
                const wd = typeof w.custom_data === 'string' ? JSON.parse(w.custom_data) : (w.custom_data || {});
                return (
                  <div key={w.id} className="withdrawal-mobile-card-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ₹{parseFloat(w.amount || '0').toFixed(2)}
                      </span>
                      <span style={statusStyle(w.status)}>{statusIcon(w.status)}{w.status}</span>
                    </div>

                    {w.status === 'pending' && (
                      <div>
                        <WithdrawalTimer createdAt={w.created_at} />
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Method: </span> {w.payment_method || '-'}
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Wallet: </span> {wd.source_wallet || 'normal'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                      <span>{new Date(w.created_at).toLocaleString()}</span>
                      {w.status === 'pending' && (
                        <button
                          onClick={() => handleCancelWithdrawal(w.id)}
                          disabled={cancellingId === w.id}
                          style={{
                            background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)',
                            padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                          }}
                        >
                          <Ban size={12} /> {cancellingId === w.id ? '...' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
