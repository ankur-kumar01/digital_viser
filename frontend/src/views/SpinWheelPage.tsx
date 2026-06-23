import React, { useState, useEffect } from 'react';
import { SpinWheel } from '../components/SpinWheel';
import { globalConfigAPI } from '../api';

interface Props {
  user: any;
  refreshUser: () => void;
}

export const SpinWheelPage: React.FC<Props> = ({ user, refreshUser }) => {
  const [enableSpinWheel, setEnableSpinWheel] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const cfg = await globalConfigAPI.getConfig();
        if (cfg.enable_spin_wheel !== undefined) {
          setEnableSpinWheel(cfg.enable_spin_wheel);
        }
      } catch (err) {
        console.error('Failed to load spin wheel config', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  if (isLoading) {
    return <div style={{ padding: '32px', textAlign: 'center' }}>Loading Spin Wheel...</div>;
  }

  if (!enableSpinWheel) {
    return (
      <div className="animate-fade-in" style={{ padding: '40px 16px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '12px' }}>🎡 Daily Spin Wheel</h2>
        <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '24px', borderRadius: '16px', display: 'inline-block' }}>
          <p style={{ color: 'var(--accent-danger)', margin: 0, fontWeight: 600 }}>The Spin Wheel is currently disabled by the administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '16px', width: '100%', maxWidth: '100%' }}>
      <SpinWheel onBonusAwarded={() => refreshUser()} isFullPage={true} />
    </div>
  );
};
