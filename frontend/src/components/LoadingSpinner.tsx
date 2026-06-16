import React from 'react';

interface LoaderProps {
  message?: string;
  fullPage?: boolean;
}

export const LoadingSpinner: React.FC<LoaderProps> = ({ 
  message = 'Loading Digital_Viser Secure Gateway...', 
  fullPage = false 
}) => {
  if (fullPage) {
    return (
      <div className="loader-screen-container">
        <div className="loader-glow-effect" />
        <div className="loader-spinner-wrap">
          <div className="loader-ring-outer" />
          <div className="loader-ring-inner" />
          <div className="loader-center-dot" />
        </div>
        <div className="loader-text-status">{message}</div>
      </div>
    );
  }

  return (
    <div className="section-loader-container">
      <div className="section-loader-spinner" />
      {message && <div className="section-loader-text">{message}</div>}
    </div>
  );
};

export default LoadingSpinner;
