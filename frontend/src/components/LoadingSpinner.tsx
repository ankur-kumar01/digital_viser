import React from 'react';
import { getAppName } from '../utils/appName';

interface LoaderProps {
  message?: string;
  fullPage?: boolean;
}

export const LoadingSpinner: React.FC<LoaderProps> = ({ 
  message, 
  fullPage = false 
}) => {
  const displayMessage = message || `Loading ${getAppName()} Secure Gateway...`;
  if (fullPage) {
    return (
      <div className="loader-screen-container">
        <div className="loader-glow-effect" />
        <div className="loader-spinner-wrap">
          <div className="loader-ring-outer" />
          <div className="loader-ring-inner" />
          <div className="loader-center-dot" />
        </div>
        <div className="loader-text-status">{displayMessage}</div>
      </div>
    );
  }

  return (
    <div className="section-loader-container">
      <div className="section-loader-spinner" />
      {displayMessage && <div className="section-loader-text">{displayMessage}</div>}
    </div>
  );
};

export default LoadingSpinner;
