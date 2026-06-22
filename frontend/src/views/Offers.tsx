import React, { useState, useEffect } from 'react';
import { yieldBoosterAPI } from '../api';
import { Gift, TrendingUp, Clock, CheckCircle2, AlertCircle, Percent } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';

const BoosterTimer: React.FC<{ endTime: string; onExpire?: () => void }> = ({ endTime, onExpire }) => {
  const calculateTimeLeft = () => {
    // Normalize date format for Safari/various environments
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
    return <span style={{ color: 'var(--accent-danger)', fontWeight: 700, fontSize: '0.85rem' }}>Expired</span>;
  }

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <Clock size={14} color="rgba(251, 191, 36, 0.9)" />
      <div style={{ display: 'flex', gap: '3px' }}>
        {parseInt(timeLeft.days) > 0 && (
          <span style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.35)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-secondary)', fontFamily: 'monospace' }}>
            {timeLeft.days}d
          </span>
        )}
        <span style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.35)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-secondary)', fontFamily: 'monospace' }}>
          {timeLeft.hours}h
        </span>
        <span style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.35)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-secondary)', fontFamily: 'monospace' }}>
          {timeLeft.minutes}m
        </span>
        <span style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.7rem', fontWeight: 800, color: '#f87171', fontFamily: 'monospace' }}>
          {timeLeft.seconds}s
        </span>
      </div>
    </div>
  );
};

export const Offers: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'history'>('available');
  const [activeBoosters, setActiveBoosters] = useState<any[]>([]);
  const [completedBoosters, setCompletedBoosters] = useState<any[]>([]);
  const [claimableOffers, setClaimableOffers] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchBoosters = async () => {
    try {
      setIsFetching(true);
      const res = await yieldBoosterAPI.getUserBoosters();
      setActiveBoosters(res.active || []);
      setCompletedBoosters(res.completed || []);
      setClaimableOffers(res.claimable || []);
    } catch (err: any) {
      console.error('Failed to fetch yield boosters:', err);
      setMessage({ text: err.message || 'Failed to load offers.', type: 'error' });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchBoosters();
  }, []);

  const handleClaimBooster = async (id: number) => {
    setClaimingId(id);
    setMessage(null);
    try {
      const res = await yieldBoosterAPI.claimBooster(id);
      setMessage({ text: res.message || 'Yield booster claimed successfully!', type: 'success' });
      await fetchBoosters();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to claim yield booster.', type: 'error' });
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Yield Booster Offers</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Supercharge your FDR interest rates. Claim exclusive yield boost codes below. Active boosts automatically stack together and apply to all your active deposits.
        </p>
      </div>

      {/* Message Banner */}
      {message && (
        <div 
          className="glass-card" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            borderLeft: message.type === 'success' ? '4px solid var(--accent-secondary)' : '4px solid var(--accent-danger)',
            background: message.type === 'success' ? 'rgba(0, 245, 160, 0.05)' : 'rgba(255, 71, 87, 0.05)',
            padding: '12px 16px',
            fontSize: '0.9rem'
          }}
        >
          {message.type === 'success' ? (
            <CheckCircle2 size={18} color="var(--accent-secondary)" />
          ) : (
            <AlertCircle size={18} color="var(--accent-danger)" />
          )}
          <span style={{ color: 'var(--text-primary)' }}>{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div 
        style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-glass)',
          gap: '24px'
        }}
      >
        {[
          { id: 'available', label: 'Available Offers', count: claimableOffers.length },
          { id: 'active', label: 'Active Boosters', count: activeBoosters.length },
          { id: 'history', label: 'Booster History', count: completedBoosters.length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              setMessage(null);
            }}
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.92rem',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span 
                style={{ 
                  background: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--bg-glass)',
                  color: activeTab === tab.id ? '#000000' : 'var(--text-secondary)',
                  borderRadius: '10px',
                  padding: '2px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {isFetching ? (
        <LoadingSpinner message="Fetching booster calculations..." />
      ) : (
        <div>
          {/* AVAILABLE OFFERS TAB */}
          {activeTab === 'available' && (
            <div>
              {claimableOffers.length === 0 ? (
                <div 
                  className="glass-card" 
                  style={{ 
                    textAlign: 'center', 
                    padding: '48px 24px', 
                    color: 'var(--text-secondary)',
                    border: '1px dashed var(--border-glass)'
                  }}
                >
                  <Gift size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.5 }} />
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    No New Offers Available
                  </h4>
                  <p style={{ fontSize: '0.88rem', margin: 0 }}>
                    You have claimed all eligible boosters or there are no new offers configured. Check back soon!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                  {claimableOffers.map((offer) => (
                    <div 
                      key={offer.id} 
                      className="glass-card glow-card"
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '16px',
                        border: '1px solid var(--border-glass)',
                        background: 'linear-gradient(135deg, var(--bg-glass) 0%, rgba(255, 255, 255, 0.02) 100%)',
                        transition: 'transform 0.2s ease, border-color 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div 
                          style={{ 
                            background: 'rgba(0, 245, 160, 0.1)', 
                            borderRadius: '10px', 
                            padding: '10px', 
                            color: 'var(--accent-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Percent size={24} />
                        </div>
                        <span 
                          style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: 700, 
                            color: 'var(--accent-info)',
                            background: 'rgba(0, 184, 212, 0.1)',
                            borderRadius: '10px',
                            padding: '4px 10px',
                            textTransform: 'uppercase'
                          }}
                        >
                          {offer.duration_days} Days duration
                        </span>
                      </div>

                      <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                          {offer.name}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.4, minHeight: '40px', margin: 0 }}>
                          {offer.description}
                        </p>
                      </div>

                      <div 
                        style={{ 
                          marginTop: 'auto', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          borderTop: '1px solid var(--border-glass)',
                          paddingTop: '14px'
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Yield Boost</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                            +{parseFloat(offer.yield_boost_percent).toFixed(2)}%
                          </div>
                        </div>

                        <button 
                          onClick={() => handleClaimBooster(offer.id)}
                          className="btn btn-primary"
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          disabled={claimingId === offer.id}
                        >
                          <span>{claimingId === offer.id ? 'Activating...' : 'Claim Boost'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ACTIVE BOOSTERS TAB */}
          {activeTab === 'active' && (
            <div>
              {activeBoosters.length === 0 ? (
                <div 
                  className="glass-card" 
                  style={{ 
                    textAlign: 'center', 
                    padding: '48px 24px', 
                    color: 'var(--text-secondary)',
                    border: '1px dashed var(--border-glass)'
                  }}
                >
                  <TrendingUp size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.5 }} />
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    No Active Yield Boosters
                  </h4>
                  <p style={{ fontSize: '0.88rem', margin: 0 }}>
                    You don't have any yield boosters running. Claim available offers to supercharge your interest!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                  {activeBoosters.map((booster) => (
                    <div 
                      key={booster.user_booster_id} 
                      className="glass-card"
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '16px',
                        border: '1px solid rgba(0, 245, 160, 0.3)',
                        background: 'linear-gradient(135deg, rgba(0, 245, 160, 0.03) 0%, var(--bg-glass) 100%)',
                        boxShadow: '0 4px 20px rgba(0, 245, 160, 0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div 
                          style={{ 
                            background: 'rgba(0, 245, 160, 0.15)', 
                            borderRadius: '50%', 
                            width: '32px',
                            height: '32px',
                            color: 'var(--accent-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <TrendingUp size={16} />
                        </div>
                        <span 
                          style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: 700, 
                            color: 'var(--accent-secondary)',
                            background: 'rgba(0, 245, 160, 0.1)',
                            borderRadius: '10px',
                            padding: '4px 10px',
                            textTransform: 'uppercase'
                          }}
                        >
                          Active
                        </span>
                      </div>

                      <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                          {booster.name}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.4, margin: 0 }}>
                          {booster.description}
                        </p>
                      </div>

                      <div 
                        style={{ 
                          marginTop: 'auto', 
                          display: 'flex', 
                          flexDirection: 'column',
                          gap: '12px',
                          borderTop: '1px solid var(--border-glass)',
                          paddingTop: '14px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Boost Rate</span>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                              +{parseFloat(booster.yield_boost_percent).toFixed(2)}%
                            </div>
                          </div>
                          <BoosterTimer endTime={booster.expires_at} onExpire={fetchBoosters} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <span>Claimed: {booster.activated_at.split(' ')[0] || new Date(booster.activated_at).toISOString().split('T')[0]}</span>
                          <span>Expires: {booster.expires_at.split(' ')[0] || new Date(booster.expires_at).toISOString().split('T')[0]}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* BOOSTER HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="glass-card">
              {completedBoosters.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                  No historical booster data found.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                        <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Booster Name</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Boost %</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Target Audience</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Activated Date</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Expired Date</th>
                        <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedBoosters.map((booster) => (
                        <tr key={booster.user_booster_id} style={{ borderBottom: '1px solid var(--border-glass)', fontSize: '0.9rem' }}>
                          <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{booster.name}</td>
                          <td style={{ padding: '16px', color: 'var(--accent-secondary)', fontWeight: 700 }}>+{parseFloat(booster.yield_boost_percent).toFixed(2)}%</td>
                          <td style={{ padding: '16px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{booster.target_type.replace('_', ' ')}</td>
                          <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{booster.activated_at.split(' ')[0] || new Date(booster.activated_at).toISOString().split('T')[0]}</td>
                          <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{booster.expires_at.split(' ')[0] || new Date(booster.expires_at).toISOString().split('T')[0]}</td>
                          <td style={{ padding: '16px' }}>
                            <span 
                              style={{ 
                                fontSize: '0.75rem', 
                                fontWeight: 700, 
                                color: 'var(--text-muted)',
                                background: 'var(--bg-glass)',
                                borderRadius: '10px',
                                padding: '2px 8px'
                              }}
                            >
                              Expired
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Offers;
