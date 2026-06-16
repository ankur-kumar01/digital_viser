import React, { useState, useEffect } from 'react';
import { walletAPI, uploadFile } from '../api';
import { CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface DepositProps {
  user: {
    name: string;
    email: string;
    balance: number | string;
  } | null;
  refreshUser: () => Promise<void>;
}

export const Deposit: React.FC<DepositProps> = () => {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentChannels, setPaymentChannels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [successData, setSuccessData] = useState<any>(null);
  const [error, setError] = useState('');
  const [adminUpiId, setAdminUpiId] = useState('admin@upi');

  // Dynamic Form State
  const [customData, setCustomData] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const methods = await walletAPI.getActiveMethods();
        const depositMethods = methods.filter((m: any) => m.type === 'deposit');
        setPaymentChannels(depositMethods);
        if (depositMethods.length > 0) {
          setPaymentMethod(depositMethods[0].name);
        }
        
        try {
          const config = await walletAPI.getConfig();
          if (config.admin_upi_id) setAdminUpiId(config.admin_upi_id);
        } catch (configErr) {
          // fallback to default
        }
      } catch (err) {
        console.error('Failed to fetch deposit methods');
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

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessData(null);

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid deposit amount greater than 0.');
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
            const url = await uploadFile(file, 'deposits');
            finalCustomData[field.label] = url;
          }
        }
      }

      // 2. Submit deposit
      const result = await walletAPI.deposit(numericAmount, paymentMethod, finalCustomData);
      setSuccessData(result.deposit || { amount: numericAmount, payment_method: paymentMethod, transaction_id: 'pending-approval' });
      setAmount('');
      setCustomData({});
    } catch (err: any) {
      setError(err.message || 'Deposit transaction failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '800px' }}>
      
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Deposit Virtual Funds</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Credit sandbox balance to your wallet profile to facilitate high-yield fixed deposits. (Requires Admin Approval)
        </p>
      </div>

      {successData ? (
        <div className="glass-card glow-card" style={{ textAlign: 'center', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', border: '1px solid rgba(0, 245, 160, 0.35)', boxShadow: '0 0 40px rgba(0, 245, 160, 0.15)' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(0, 245, 160, 0.1)', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0, 245, 160, 0.3)' }}>
            <CheckCircle2 size={36} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '8px' }}>Deposit Pending Approval!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              Your deposit request has been submitted and is awaiting administrator approval.
            </p>
          </div>
          <button onClick={() => setSuccessData(null)} className="btn btn-primary" style={{ marginTop: '10px' }}>
            Make Another Request
          </button>
        </div>
      ) : (
        <div className="responsive-two-col" style={{ alignItems: 'flex-start' }}>
          {/* Main Deposit Form */}
          <div className="glass-card" style={{ flex: '1.5' }}>
            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--accent-danger)', padding: '12px 16px', borderRadius: '4px', marginBottom: '24px', color: 'var(--accent-danger)' }}>
                {error}
              </div>
            )}

            {isFetching ? (
              <LoadingSpinner message="Loading deposit methods..." />
            ) : paymentChannels.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active deposit channels available. Please contact support.
              </div>
            ) : (
              <form onSubmit={handleDeposit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label className="input-label">Deposit Amount (₹)</label>
                  <input
                    type="number"
                    className="input-field"
                    style={{ fontSize: '1.5rem', padding: '16px', fontWeight: 600, fontFamily: 'var(--font-headings)' }}
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    min="1"
                  />
                </div>

                <div>
                  <label className="input-label">Payment Channel</label>
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

                {/* UPI QR Code Generation */}
                {selectedMethod?.name.toLowerCase().includes('upi') && parseFloat(amount || '0') > 0 && adminUpiId && (
                  <div style={{ background: 'var(--bg-tertiary)', padding: '24px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', border: '1px solid var(--accent-primary-glow)' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Scan to Pay</h4>
                    <div style={{ background: '#fff', padding: '16px', borderRadius: '8px' }}>
                      <QRCodeSVG value={`upi://pay?pa=${adminUpiId}&pn=Digital_Viser&am=${parseFloat(amount)}&cu=INR`} size={200} level="H" />
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
                      Scan this QR code using any UPI app (GPay, PhonePe, Paytm, etc.) to pay exactly <strong style={{ color: 'var(--accent-primary)' }}>₹{parseFloat(amount).toLocaleString()}</strong>.
                    </p>
                    <a href={`upi://pay?pa=${adminUpiId}&pn=Digital_Viser&am=${parseFloat(amount)}&cu=INR`} className="btn" style={{ width: '100%', textAlign: 'center', display: 'block', padding: '12px', background: 'var(--accent-primary)', color: 'var(--bg-primary)', fontWeight: 600, textDecoration: 'none', borderRadius: 'var(--radius-sm)' }}>
                      Pay via UPI App (Mobile)
                    </a>
                  </div>
                )}

                {/* Render Dynamic User Form Fields */}
                {userForm.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Provide Details</h4>
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
                            required={field.required}
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
                  disabled={isLoading}
                >
                  {isLoading ? 'Processing Request...' : `Deposit ${amount ? `₹${parseFloat(amount).toLocaleString()}` : ''}`}
                </button>
              </form>
            )}
          </div>

          {/* Admin Instructions Sidebar */}
          {adminInstructions && adminInstructions.length > 0 && (
            <div className="glass-card" style={{ flex: 1, padding: '24px', background: 'var(--bg-tertiary)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
                Payment Instructions
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
