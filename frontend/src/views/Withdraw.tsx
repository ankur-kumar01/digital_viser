import React, { useState, useEffect } from 'react';
import { walletAPI, uploadFile } from '../api';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface WithdrawProps {
  user: {
    name: string;
    email: string;
    balance: number | string;
  } | null;
  refreshUser: () => Promise<void>;
}

export const Withdraw: React.FC<WithdrawProps> = ({ user, refreshUser }) => {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [sourceWallet, setSourceWallet] = useState('normal');
  const [paymentChannels, setPaymentChannels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [successData, setSuccessData] = useState<any>(null);
  const [error, setError] = useState('');

  // Dynamic Form State
  const [customData, setCustomData] = useState<Record<string, any>>({});

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
      } finally {
        setIsFetching(false);
      }
    };
    fetchMethods();
  }, []);

  const selectedMethod = paymentChannels.find(m => m.name === paymentMethod);
  const adminInstructions = selectedMethod?.admin_instructions ? (typeof selectedMethod.admin_instructions === 'string' ? JSON.parse(selectedMethod.admin_instructions) : selectedMethod.admin_instructions) : [];
  const userForm = selectedMethod?.user_form ? (typeof selectedMethod.user_form === 'string' ? JSON.parse(selectedMethod.user_form) : selectedMethod.user_form) : [];

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
      normal: user ? parseFloat((user as any).balance || '0') : 0,
      bonus: user ? parseFloat((user as any).bonus_balance || '0') : 0,
      referral: user ? parseFloat((user as any).referral_balance || '0') : 0
    };

    const maxAllowed = walletBalances[sourceWallet] || 0;

    if (numericAmount > maxAllowed) {
      setError(`Insufficient balance in selected wallet.`);
      return;
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
      const result = await walletAPI.withdraw(numericAmount, paymentMethod, sourceWallet, finalCustomData);
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

      {successData ? (
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
                ₹{user ? parseFloat(((user as any)[sourceWallet === 'normal' ? 'balance' : `${sourceWallet}_balance`] || '0')).toLocaleString() : '0.00'}
              </span>
            </div>

            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--accent-danger)', padding: '12px 16px', borderRadius: '4px', marginBottom: '24px', color: 'var(--accent-danger)' }}>
                {error}
              </div>
            )}

            {isFetching ? (
              <div>Loading payment channels...</div>
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
                    max={user ? parseFloat(((user as any)[sourceWallet === 'normal' ? 'balance' : `${sourceWallet}_balance`] || '0')) : undefined}
                  />
                </div>

                <div>
                  <label className="input-label">Wallet Source</label>
                  <select
                    className="input-field"
                    value={sourceWallet}
                    onChange={(e) => setSourceWallet(e.target.value)}
                    required
                  >
                    <option value="normal">Main Wallet</option>
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
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '16px', fontSize: '1.1rem', marginTop: '10px' }}
                  disabled={isLoading || !amount || parseFloat(amount) <= 0 || (user && parseFloat(amount) > parseFloat(((user as any)[sourceWallet === 'normal' ? 'balance' : `${sourceWallet}_balance`] || '0')))}
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
    </div>
  );
};
