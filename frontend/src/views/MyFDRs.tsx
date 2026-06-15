import React, { useState, useEffect } from 'react';
import { fdrAPI } from '../api';
import { Calendar, RefreshCw, BarChart2, CheckCircle2, Coins, Banknote } from 'lucide-react';
import { ShimmerLoader } from '../components/ShimmerLoader';
import '../fdr-animations.css';

interface MyFDRsProps {
  onNavigate: (view: string) => void;
}

export const MyFDRs: React.FC<MyFDRsProps> = ({ onNavigate }) => {
  const [fdrs, setFdrs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Live yield simulator for active FDRs
  const LiveYieldDisplay: React.FC<{
    baseAccrued: number;
    principal: number;
    interestPercent: number;
    periodDays: number;
    isCompleted: boolean;
    lastInstDate: string;
  }> = ({ baseAccrued, principal, interestPercent, periodDays, isCompleted, lastInstDate }) => {
    const [liveYield, setLiveYield] = useState(baseAccrued);

    useEffect(() => {
      if (isCompleted) {
        setLiveYield(baseAccrued);
        return;
      }

      const yieldPerPeriod = principal * (interestPercent / 100);
      const yieldPerMs = yieldPerPeriod / (periodDays * 24 * 60 * 60 * 1000);

      let initialUnaccrued = 0;
      if (lastInstDate) {
        const lastInstMs = new Date(lastInstDate + 'T00:00:00').getTime();
        const nowMs = Date.now();
        if (nowMs > lastInstMs) {
          initialUnaccrued = (nowMs - lastInstMs) * yieldPerMs;
        }
      }

      setLiveYield(baseAccrued + initialUnaccrued);

      const interval = setInterval(() => {
        setLiveYield(prev => prev + (yieldPerMs * 100));
      }, 100);

      return () => clearInterval(interval);
    }, [baseAccrued, principal, interestPercent, periodDays, isCompleted, lastInstDate]);

    return (
      <strong className={!isCompleted ? "money-generating" : ""} style={{ color: isCompleted ? 'var(--accent-secondary)' : undefined, fontVariantNumeric: 'tabular-nums' }}>
        ₹{isCompleted ? baseAccrued.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : liveYield.toLocaleString('en-IN', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
      </strong>
    );
  };

  const fetchFDRs = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fdrAPI.getMyFDRs();
      setFdrs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch FDR portfolio.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFDRs();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return dateStr.split('T')[0];
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>My FDR Portfolio</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Monitor your locked deposits, accrued interest schedules, and progress status.
          </p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={fetchFDRs} 
          disabled={isLoading}
          style={{ display: 'flex', gap: '6px', padding: '10px 18px', fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          <span>Refresh</span>
        </button>
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

      {isLoading ? (
        /* LOADING */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card glow-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <ShimmerLoader width="40%" height="24px" />
                <ShimmerLoader width="20%" height="24px" />
              </div>
              <ShimmerLoader width="60%" height="32px" />
              <ShimmerLoader width="100%" height="8px" borderRadius="4px" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                <ShimmerLoader height="40px" />
                <ShimmerLoader height="40px" />
                <ShimmerLoader height="40px" />
                <ShimmerLoader height="40px" />
              </div>
            </div>
          ))}
        </div>
      ) : fdrs.length === 0 ? (
        /* EMPTY STATE */
        <div 
          className="glass-card" 
          style={{ 
            textAlign: 'center', 
            padding: '60px 40px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '16px' 
          }}
        >
          <BarChart2 size={40} color="var(--text-muted)" />
          <div>
            <h4 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '6px' }}>No Active FDR Contracts</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto', lineHeight: '1.5' }}>
              You don't have any fixed-term deposits active. Build a custom plan or apply standard presets to start earning interest.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => onNavigate('create-fdr')} style={{ marginTop: '10px' }}>
            <span>Open First FDR Plan</span>
          </button>
        </div>
      ) : (
        /* FDR LIST */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {fdrs.map((fdr) => {
            const isCompleted = fdr.status === 'completed';
            const progress = isCompleted ? 100 : Math.min(100, Math.max(0, parseFloat(fdr.progress_percent) || 0));
            const principal = parseFloat(fdr.amount) || 0;
            const accrued = parseFloat(fdr.accrued_interest) || 0;

            return (
              <div 
                key={fdr.id} 
                className={`glass-card glow-card animate-fade-in ${!isCompleted ? 'mining-card' : ''}`}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '16px',
                  border: isCompleted ? '1px solid var(--accent-info-glow)' : '1px solid var(--accent-secondary)',
                  boxShadow: !isCompleted ? '0 0 15px var(--accent-secondary-light)' : 'none',
                  position: 'relative'
                }}
              >
                {!isCompleted && (
                  <>
                    <div className="scan-line" />
                    <div className="money-particle particle-1">+₹</div>
                    <div className="money-particle particle-2"><Coins size={14} /></div>
                    <div className="money-particle particle-3"><Banknote size={16} /></div>
                    <div className="money-particle particle-4">$</div>
                    <div className="money-particle particle-5"><Coins size={14} /></div>
                    <div className="money-particle particle-6">+₹</div>
                  </>
                )}
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Contract FDR #{fdr.id}
                    </span>
                    <strong style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-headings)' }}>
                      ₹{principal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <span className={`badge ${isCompleted ? 'badge-completed' : 'badge-active'}`}>
                    {fdr.status}
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <span>Duration Progress</span>
                    <strong>{progress.toFixed(0)}%</strong>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '50px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${progress}%`, 
                        background: isCompleted 
                          ? 'linear-gradient(90deg, var(--accent-info) 0%, #0099ff 100%)' 
                          : 'linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                        borderRadius: '50px',
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>
                </div>

                {/* Grid Details */}
                <div 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '12px', 
                    background: 'var(--bg-tertiary)', 
                    border: '1px solid var(--border-card)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                    fontSize: '0.85rem'
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Interest:</span>
                    <strong>{parseFloat(fdr.interest_percent)}% / {fdr.period_days} Days</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Yield Accrued:</span>
                    <LiveYieldDisplay 
                      baseAccrued={accrued} 
                      principal={principal} 
                      interestPercent={parseFloat(fdr.interest_percent)} 
                      periodDays={parseInt(fdr.period_days, 10)} 
                      isCompleted={isCompleted} 
                      lastInstDate={fdr.last_installment_date ? fdr.last_installment_date.split('T')[0] : fdr.start_date.split('T')[0]}
                    />
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Start Date:</span>
                    <span>{formatDate(fdr.start_date)}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Maturity Date:</span>
                    <span>{formatDate(fdr.end_date)}</span>
                  </div>
                </div>

                {/* Footer status text */}
                {!isCompleted && fdr.next_installment_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-card)', paddingTop: '10px' }}>
                    <Calendar size={13} color="var(--accent-primary)" />
                    <span>Next Interest Payout: <strong>{formatDate(fdr.next_installment_date)}</strong></span>
                  </div>
                )}

                {isCompleted && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--accent-info)', borderTop: '1px solid var(--border-card)', paddingTop: '10px' }}>
                    <CheckCircle2 size={13} />
                    <span>Principal and total yields returned to wallet.</span>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
