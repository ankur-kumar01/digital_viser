import React, { useState, useEffect, useCallback } from 'react';
import { globalConfigAPI } from '../api';
import { getAppName } from '../utils/appName';


interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

function getTimeLeft(endTime: string | null): TimeLeft {
  if (!endTime) return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
  const end = new Date(endTime).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((end - now) / 1000));
  return {
    hours: Math.floor(diff / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: diff % 60,
    totalSeconds: diff,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export const MaintenancePage: React.FC = () => {
  const [endTime, setEndTime] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });
  const [checking, setChecking] = useState(false);
  const [tick, setTick] = useState(0);

  const fetchConfig = useCallback(async () => {
    try {
      const config = await globalConfigAPI.getConfig();
      if (config && config.maintenance_mode === false) {
        // Maintenance ended — reload to restore normal app
        window.location.reload();
        return;
      }
      setEndTime(config?.maintenance_end_time || null);
    } catch {
      // Silently fail — backend may be restarting
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    // Poll every 30 seconds to auto-detect when maintenance ends
    const interval = setInterval(fetchConfig, 30000);
    return () => clearInterval(interval);
  }, [fetchConfig]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setTimeLeft(getTimeLeft(endTime));
  }, [endTime, tick]);

  const handleCheck = async () => {
    setChecking(true);
    await fetchConfig();
    setTimeout(() => setChecking(false), 1000);
  };

  const hasCountdown = endTime && timeLeft.totalSeconds > 0;
  const countdownExpired = endTime && timeLeft.totalSeconds === 0;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 20% 50%, rgba(220,38,38,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(251,146,60,0.10) 0%, transparent 50%), #0a0b0f',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Ambient glow blobs */}
      <div style={{
        position: 'absolute', top: '10%', left: '-5%', width: '400px', height: '400px',
        background: 'rgba(220,38,38,0.06)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '5%', right: '-5%', width: '350px', height: '350px',
        background: 'rgba(251,146,60,0.07)', borderRadius: '50%', filter: 'blur(70px)', pointerEvents: 'none',
      }} />

      <div style={{
        maxWidth: '540px', width: '100%', position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px',
        animation: 'fadeIn 0.6s ease-out forwards',
      }}>

        {/* Logo + Brand */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(220,38,38,0.25) 0%, rgba(251,146,60,0.2) 100%)',
            border: '1px solid rgba(220,38,38,0.35)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.2rem', marginBottom: '16px',
            boxShadow: '0 8px 32px rgba(220,38,38,0.20)',
            animation: 'maintenancePulse 3s ease-in-out infinite',
          }}>
            🔧
          </div>
          <h1 style={{
            fontFamily: "'Outfit', sans-serif", fontSize: '2rem', fontWeight: 800,
            color: '#f1f3f5', margin: '0 0 6px 0', letterSpacing: '-0.03em',
          }}>
            Scheduled Maintenance
          </h1>
          <p style={{ color: 'rgba(156,163,175,0.9)', fontSize: '0.95rem', margin: 0, lineHeight: 1.6 }}>
            {getAppName()} is currently undergoing planned system upgrades.<br />
            We apologise for the temporary inconvenience.
          </p>
        </div>

        {/* Countdown or status */}
        {hasCountdown ? (
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '20px', padding: '32px 40px', backdropFilter: 'blur(20px)',
            textAlign: 'center', width: '100%',
            boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}>
            <p style={{ color: 'rgba(156,163,175,0.8)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px', fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>
              Estimated Return In
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { value: pad(timeLeft.hours), label: 'Hours' },
                { value: pad(timeLeft.minutes), label: 'Minutes' },
                { value: pad(timeLeft.seconds), label: 'Seconds' },
              ].map(({ value, label }, i) => (
                <React.Fragment key={label}>
                  {i > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '24px', color: 'rgba(220,38,38,0.6)', fontSize: '2rem', fontWeight: 700 }}>:</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)',
                      borderRadius: '14px', padding: '18px 22px', minWidth: '80px',
                      fontFamily: "'Outfit', sans-serif", fontSize: '2.8rem', fontWeight: 800,
                      color: '#f1f3f5', letterSpacing: '-0.02em', lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                      boxShadow: '0 2px 16px rgba(220,38,38,0.12)',
                    }}>
                      {value}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'rgba(156,163,175,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                      {label}
                    </span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : countdownExpired ? (
          <div style={{
            background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)',
            borderRadius: '16px', padding: '24px 32px', textAlign: 'center', width: '100%',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
            <p style={{ color: 'rgba(251,146,60,0.95)', fontWeight: 600, fontSize: '1rem', margin: 0 }}>
              Upgrades are almost complete!<br />
              <span style={{ fontWeight: 400, fontSize: '0.88rem', color: 'rgba(156,163,175,0.8)' }}>
                We will be back online shortly. Please check again in a moment.
              </span>
            </p>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '24px 32px', textAlign: 'center', width: '100%',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔄</div>
            <p style={{ color: 'rgba(156,163,175,0.85)', fontSize: '0.9rem', margin: 0, lineHeight: 1.6 }}>
              Our team is working to restore the platform.<br />
              No estimated downtime has been provided yet — please check back soon.
            </p>
          </div>
        )}

        {/* Status timeline */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px', padding: '20px 24px', width: '100%',
          backdropFilter: 'blur(10px)',
        }}>
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(156,163,175,0.7)', fontWeight: 600, marginBottom: '16px' }}>
            System Status
          </p>
          {[
            { icon: '🔴', label: 'User-Facing Platform', status: 'Maintenance', color: 'rgba(220,38,38,0.9)' },
            { icon: '🟡', label: 'Core Services', status: 'Running', color: 'rgba(251,191,36,0.9)' },
            { icon: '🟢', label: 'Security Infrastructure', status: 'Operational', color: 'rgba(16,185,129,0.9)' },
            { icon: '🟢', label: 'Data & Database', status: 'Operational', color: 'rgba(16,185,129,0.9)' },
          ].map(({ icon, label, status, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBlock: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem' }}>{icon}</span>
                <span style={{ fontSize: '0.88rem', color: 'rgba(209,213,219,0.85)' }}>{label}</span>
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color, fontFamily: "'Outfit', sans-serif" }}>{status}</span>
            </div>
          ))}
        </div>

        {/* Refresh Button */}
        <button
          onClick={handleCheck}
          disabled={checking}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px', padding: '12px 28px',
            color: 'rgba(209,213,219,0.9)', cursor: 'pointer',
            fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: '0.9rem',
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(10px)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.22)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)';
          }}
        >
          <span style={{ animation: checking ? 'spin 1s linear infinite' : 'none', display: 'inline-block' }}>
            {checking ? '⟳' : '↻'}
          </span>
          {checking ? 'Checking Status…' : 'Check Status Now'}
        </button>

        {/* Footer */}
        <p style={{ color: 'rgba(107,114,128,0.7)', fontSize: '0.78rem', textAlign: 'center', margin: 0 }}>
          {getAppName()} © {new Date().getFullYear()} &nbsp;·&nbsp; Status auto-refreshes every 30 seconds
        </p>
      </div>

      <style>{`
        @keyframes maintenancePulse {
          0%, 100% { box-shadow: 0 8px 32px rgba(220,38,38,0.20); transform: scale(1); }
          50% { box-shadow: 0 12px 48px rgba(220,38,38,0.35); transform: scale(1.04); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
