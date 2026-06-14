import React from 'react';

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  variant?: 'primary' | 'secondary' | 'info' | 'warning';
}

const variantColors: Record<string, string> = {
  primary: 'var(--accent-primary)',
  secondary: 'var(--accent-secondary)',
  info: 'var(--accent-info)',
  warning: 'var(--accent-warning)',
};

const variantBg: Record<string, string> = {
  primary: 'var(--accent-primary-light)',
  secondary: 'var(--accent-secondary-light)',
  info: 'var(--accent-info-glow)',
  warning: 'var(--accent-warning-glow)',
};

export const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, variant = 'primary' }) => {
  const color = variantColors[variant] || variantColors.primary;
  const bg = variantBg[variant] || variantBg.primary;

  return (
    <div 
      className="glass-card animate-fade-in" 
      style={{ 
        animationDelay: '0.1s',
        borderLeft: `4px solid ${color}`,
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase', lineHeight: '1.3' }}>
          {label}
        </span>
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            background: bg, 
            color: color,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
      <div className="metric-val">{value}</div>
    </div>
  );
};
