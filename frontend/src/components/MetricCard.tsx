import React from 'react';

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  variant?: 'primary' | 'secondary' | 'info' | 'warning';
}

export const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, variant = 'primary' }) => {
  return (
    <div className="glass-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '42px', 
            height: '42px', 
            borderRadius: '50%', 
            background: `var(--accent-${variant}-glow)`, 
            color: `var(--accent-${variant})`,
            border: `1px solid var(--accent-${variant}-glow)`
          }}
        >
          {icon}
        </div>
      </div>
      <div className="metric-val">{value}</div>
    </div>
  );
};
