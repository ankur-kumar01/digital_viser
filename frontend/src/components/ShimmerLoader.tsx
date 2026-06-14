import React from 'react';

interface ShimmerProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}

export const ShimmerLoader: React.FC<ShimmerProps> = ({ 
  width = '100%', 
  height = '20px', 
  borderRadius = 'var(--radius-sm)',
  style = {}
}) => {
  return (
    <div 
      className="shimmer" 
      style={{
        width,
        height,
        borderRadius,
        ...style
      }} 
    />
  );
};
