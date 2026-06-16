import React, { useState, useEffect } from 'react';
import { fdrAPI } from '../api';
import { Award, CheckCircle2, TrendingUp, Info } from 'lucide-react';

interface CreateFDRProps {
  user: {
    name: string;
    email: string;
    balance: number | string;
  } | null;
  refreshUser: () => Promise<void>;
}

const OfferTimer: React.FC<{ endTime: string; onExpire?: () => void }> = ({ endTime, onExpire }) => {
  const calculateTimeLeft = () => {
    const safeEndTime = endTime.includes('Z') ? endTime : endTime.replace(' ', 'T') + 'Z';
    const difference = +new Date(safeEndTime) - +new Date();
    let timeLeft = {
      days: '00',
      hours: '00',
      minutes: '00',
      seconds: '00',
      expired: true
    };

    if (difference > 0) {
      const d = Math.floor(difference / (1000 * 60 * 60 * 24));
      const h = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const m = Math.floor((difference / 1000 / 60) % 60);
      const s = Math.floor((difference / 1000) % 60);

      timeLeft = {
        days: d.toString().padStart(2, '0'),
        hours: h.toString().padStart(2, '0'),
        minutes: m.toString().padStart(2, '0'),
        seconds: s.toString().padStart(2, '0'),
        expired: false
      };
    }

    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      const updated = calculateTimeLeft();
      setTimeLeft(updated);
      if (updated.expired) {
        clearInterval(timer);
        if (onExpire) onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  if (timeLeft.expired) {
    return <span style={{ color: 'var(--accent-danger)', fontWeight: 700, fontSize: '0.85rem' }}>Offer Expired!</span>;
  }

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(251, 191, 36, 0.9)', fontWeight: 700, letterSpacing: '0.05em' }}>Ends In:</span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {parseInt(timeLeft.days) > 0 && (
          <span style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.35)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-secondary)', fontFamily: 'monospace' }}>
            {timeLeft.days}d
          </span>
        )}
        <span style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.35)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-secondary)', fontFamily: 'monospace' }}>
          {timeLeft.hours}h
        </span>
        <span style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.35)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-secondary)', fontFamily: 'monospace' }}>
          {timeLeft.minutes}m
        </span>
        <span style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 800, color: '#f87171', fontFamily: 'monospace' }}>
          {timeLeft.seconds}s
        </span>
      </div>
    </div>
  );
};

export const CreateFDR: React.FC<CreateFDRProps> = ({ user, refreshUser }) => {
  const [amount, setAmount] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  
  const [activePlans, setActivePlans] = useState<any[]>([]);
  const [activeOffers, setActiveOffers] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPlansAndOffers = async () => {
      try {
        const plans = await fdrAPI.getActivePlans();
        setActivePlans(plans);
        if (plans.length > 0) {
          setSelectedPlanId(plans[0].id);
          setAmount(plans[0].min_amount.toString());
        }
        
        const offers = await fdrAPI.getActiveOffers();
        setActiveOffers(offers);
      } catch (err) {
        console.error('Failed to fetch FDR plans/offers');
      } finally {
        setIsFetching(false);
      }
    };
    fetchPlansAndOffers();
  }, []);

  const selectedPlan = activePlans.find(p => p.id === selectedPlanId);

  // Perform reactive mathematical projections
  const getProjections = () => {
    const pAmt = parseFloat(amount) || 0;
    const activeOffer = activeOffers.length > 0 ? activeOffers[0] : null;
    const bonusPercent = activeOffer ? parseFloat(activeOffer.bonus_percent) : 0;
    const bonusAmount = pAmt * (bonusPercent / 100);

    if (!selectedPlan || pAmt <= 0) {
      return { totalDays: 0, installments: 0, interestPerInst: 0, totalInterest: 0, maturityVal: 0, roi: 0, bonusAmount: 0 };
    }

    const pDays = parseInt(selectedPlan.period_days) || 1;
    const pPct = parseFloat(selectedPlan.interest_percent) || 0;
    const totalDays = parseInt(selectedPlan.duration_days) || 0;

    const installments = Math.floor(totalDays / pDays);
    const interestPerInst = pAmt * (pPct / 100);
    const totalInterest = interestPerInst * installments;
    const maturityVal = pAmt + totalInterest;
    const roi = pAmt > 0 ? (totalInterest / pAmt) * 100 : 0;

    return { totalDays, installments, interestPerInst, totalInterest, maturityVal, roi, bonusAmount };
  };

  const projections = getProjections();

  const handleCreateFDR = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessData(null);

    const numericAmount = parseFloat(amount);
    const userBal = user ? parseFloat(user.balance as string) : 0;

    if (!selectedPlanId) {
      setError('Please select an active FDR plan.');
      return;
    }
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid investment amount.');
      return;
    }
    if (selectedPlan && (numericAmount < selectedPlan.min_amount || numericAmount > selectedPlan.max_amount)) {
      setError(`Investment must be between ₹${selectedPlan.min_amount} and ₹${selectedPlan.max_amount} for this plan.`);
      return;
    }
    if (numericAmount > userBal) {
      setError(`Insufficient wallet balance. You have ₹${userBal.toLocaleString('en-IN')}. Please deposit funds first.`);
      return;
    }

    setIsLoading(true);
    try {
      const result = await fdrAPI.create({
        amount: numericAmount,
        plan_id: selectedPlanId
      });
      setSuccessData(result);
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize FDR.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Lock FDR Investment</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Invest in standard Fixed Deposit plans managed by the platform administrators.
        </p>
      </div>

      {/* Active Promo Offer Banner */}
      {activeOffers.length > 0 && (
        <div className="glass-card promo-offer-banner">
          <div className="emoji" style={{ fontSize: '1.8rem', flexShrink: 0 }}>🎁</div>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
              Special Promo Active: {activeOffers[0].name}
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              Create any Fixed Deposit now and get an extra <strong style={{ color: 'var(--accent-secondary)' }}>{parseFloat(activeOffers[0].bonus_percent)}% bonus amount</strong> credited to your bonus wallet. Funds will remain locked until maturity and are destroyed if closed early.
            </p>
            <OfferTimer endTime={activeOffers[0].end_time} onExpire={() => setActiveOffers([])} />
          </div>
        </div>
      )}

      {successData ? (
        /* SUCCESS PAGE */
        <div 
          className="glass-card glow-card" 
          style={{ 
            textAlign: 'center', 
            padding: '40px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '20px',
            border: '1px solid rgba(0, 245, 160, 0.35)',
            boxShadow: '0 0 40px rgba(0, 245, 160, 0.15)'
          }}
        >
          <div 
            style={{ 
              width: '60px', 
              height: '60px', 
              borderRadius: '50%', 
              background: 'rgba(0, 245, 160, 0.1)', 
              color: 'var(--accent-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(0, 245, 160, 0.3)'
            }}
          >
            <CheckCircle2 size={36} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '8px' }}>FDR Created Successfully!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              Your principal of ₹{parseFloat(successData.amount).toFixed(2)} has been locked in the contract.
            </p>
          </div>

          <div 
            style={{ 
              background: 'var(--bg-glass)', 
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-sm)',
              padding: '20px',
              width: '100%',
              maxWidth: '500px',
              textAlign: 'left',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              fontSize: '0.9rem'
            }}
          >
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Plan Duration:</span>
              <div style={{ fontWeight: 600 }}>{projections.totalDays} Days</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Maturity Date:</span>
              <div style={{ fontWeight: 600 }}>{successData.end_date.split('T')[0]}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Installment Payout:</span>
              <div style={{ fontWeight: 600 }}>{successData.interest_percent}% every {successData.period_days} Days</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Scheduled Installments:</span>
              <div style={{ fontWeight: 600 }}>{projections.installments} times</div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={() => setSuccessData(null)}>
            <span>Create Another FDR</span>
          </button>
        </div>
      ) : (
        /* CREATION LAYOUT */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Plan Selection Cards */}
          <div>
            <h4 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Select Active Plan
            </h4>
            {isFetching ? (
              <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Loading FDR plans...</div>
            ) : activePlans.length === 0 ? (
              <div style={{ padding: '20px', color: 'var(--text-muted)', border: '1px dashed var(--border-glass)', borderRadius: 'var(--radius-md)' }}>
                No active FDR plans are currently configured by the administrator. Check back later.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                {activePlans.map((plan) => (
                  <div 
                    key={plan.id}
                    className={`glass-card ${selectedPlanId === plan.id ? 'glow-card' : ''}`}
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '12px', 
                      cursor: 'pointer',
                      border: selectedPlanId === plan.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                      transform: selectedPlanId === plan.id ? 'translateY(-2px)' : 'none'
                    }}
                    onClick={() => {
                      setSelectedPlanId(plan.id);
                      setAmount(plan.min_amount.toString());
                      setError('');
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: selectedPlanId === plan.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{plan.name}</span>
                      <Award size={18} color={selectedPlanId === plan.id ? "var(--accent-primary)" : "var(--text-muted)"} />
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border-glass)', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Range:</span>
                        <strong style={{ color: 'var(--accent-secondary)' }}>₹{plan.min_amount} - ₹{plan.max_amount}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Installment:</span>
                        <strong>{plan.interest_percent}% / {plan.period_days}d</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Matures In:</span>
                        <strong>{plan.duration_days} Days</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Builder & Projection layout */}
          {activePlans.length > 0 && (
            <div className="responsive-two-col" style={{ alignItems: 'start' }}>
              
              {/* FDR INVESTMENT FORM */}
              <form onSubmit={handleCreateFDR} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '14px' }}>
                  <Award size={20} color="var(--accent-primary)" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Lock Funds</h3>
                </div>

                {error && (
                  <div 
                    style={{
                      background: 'rgba(255, 71, 87, 0.08)',
                      border: '1px solid rgba(255, 71, 87, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 16px',
                      color: 'var(--accent-danger)',
                      fontSize: '0.88rem'
                    }}
                  >
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <span>Investment Amount</span>
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        Wallet Balance: ₹{user ? parseFloat(user.balance as string).toLocaleString('en-IN') : '0'}
                      </span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>₹</span>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field"
                        placeholder="10000"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        style={{ paddingLeft: '32px' }}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '14px', marginTop: '8px' }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Processing...' : 'Invest Now'}
                </button>
              </form>

              {/* LIVE PROJECTIONS PANEL */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--bg-tertiary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '14px' }}>
                  <TrendingUp size={20} color="var(--accent-secondary)" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Yield Projections</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--border-glass)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Plan Duration</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{projections.totalDays} Days</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--border-glass)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Interest payout per installment</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>₹{projections.interestPerInst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--border-glass)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Estimated Interest</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>₹{projections.totalInterest.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  {activeOffers.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--border-glass)' }}>
                      <span style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>🎁 Promo Locked Bonus ({parseFloat(activeOffers[0].bonus_percent)}%)</span>
                      <span style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>₹{projections.bonusAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--border-glass)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Payout at Maturity</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{projections.maturityVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Effective Net ROI</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-info)' }}>{projections.roi.toFixed(2)}%</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: 'var(--bg-glass)', padding: '12px', borderRadius: 'var(--radius-sm)', marginTop: '8px' }}>
                  <Info size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    Projections are estimates based on the selected plan's rules. Payouts are made iteratively based on the plan's installment interval.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
