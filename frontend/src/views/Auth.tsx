import React, { useState, useEffect } from 'react';
import { authAPI, saveToken } from '../api';
import { KeyRound, Mail, User, Phone, AlertCircle, Loader2, Gift } from 'lucide-react';
import { getAppName } from '../utils/appName';

interface AuthProps {
  onLogin: (token: string, user: any, isRegistration?: boolean) => void;
  onNavigateForgot?: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin, onNavigateForgot }) => {
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone_number, setPhoneNumber] = useState('');
  const [referralCode, setReferralCode] = useState('');
  
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Parse referral code from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralCode(ref);
      setIsLoginTab(false);
    }
  }, []);

  const validate = () => {
    const errors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!isLoginTab) {
      if (!name) {
        errors.name = 'Name is required';
      }
      if (!phone_number) {
        errors.phone_number = 'Mobile number is required';
      }
      if (password !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validate()) return;

    setIsLoading(true);
    try {
      if (isLoginTab) {
        const device_info = JSON.stringify({
          platform: navigator.platform,
          language: navigator.language,
          screen: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
        const response = await authAPI.login({ email, password, device_info });
        saveToken(response.token);
        onLogin(response.token, response.user, false);
      } else {
        const response = await authAPI.register({ name, email, password, phone_number, referral_code: referralCode || undefined });
        saveToken(response.token);
        onLogin(response.token, response.user, true);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-body-gradient)',
        position: 'relative',
        overflow: 'hidden',
        padding: '20px'
      }}
    >
      {/* Decorative Orbs Removed per "No Gradients" request */}

      <div className="glass-card glow-card animate-fade-in auth-card">
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '50px',
              height: '50px',
              borderRadius: '14px',
              background: 'var(--accent-primary)',
              marginBottom: '16px',
              boxShadow: '0 8px 20px var(--accent-primary-glow)'
            }}
          >
            <KeyRound size={24} color="var(--text-primary)" />
          </div>
          <h2 style={{ fontSize: '1.75rem', color: 'var(--text-primary)', marginBottom: '6px' }}>{getAppName()}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Secured Wealth & {getAppName()} Investment Platform
          </p>
        </div>

        {/* Auth Mode Toggle Tabs */}
        <div 
          style={{ 
            display: 'flex', 
            borderBottom: '1px solid var(--border-glass)', 
            marginBottom: '30px',
            position: 'relative'
          }}
        >
          <button
            onClick={() => {
              setIsLoginTab(true);
              setError('');
              setFieldErrors({});
            }}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              padding: '12px',
              color: isLoginTab ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-headings)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              borderBottom: isLoginTab ? '2px solid var(--accent-primary)' : '2px solid transparent',
              transition: 'var(--transition)',
              outline: 'none'
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setIsLoginTab(false);
              setError('');
              setFieldErrors({});
            }}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              padding: '12px',
              color: !isLoginTab ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-headings)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              borderBottom: !isLoginTab ? '2px solid var(--accent-primary)' : '2px solid transparent',
              transition: 'var(--transition)',
              outline: 'none'
            }}
          >
            Create Account
          </button>
        </div>

        {/* Global Error message */}
        {error && (
          <div 
            style={{
              background: 'rgba(255, 71, 87, 0.08)',
              border: '1px solid rgba(255, 71, 87, 0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 16px',
              color: 'var(--accent-danger)',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '24px'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Name Field (Signup only) */}
          {!isLoginTab && (
            <div>
              <label className="input-label">Full NameLabel</label>
              <div style={{ position: 'relative' }}>
                <User 
                  size={18} 
                  color="var(--text-muted)" 
                  style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} 
                />
                <input
                  type="text"
                  className="input-field"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ paddingLeft: '48px' }}
                  disabled={isLoading}
                />
              </div>
              {fieldErrors.name && (
                <span style={{ color: 'var(--accent-danger)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                  {fieldErrors.name}
                </span>
              )}
            </div>
          )}

          {/* Phone Number Field (Signup only) */}
          {!isLoginTab && (
            <div>
              <label className="input-label">Mobile Number</label>
              <div style={{ position: 'relative' }}>
                <Phone 
                  size={18} 
                  color="var(--text-muted)" 
                  style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} 
                />
                <input
                  type="text"
                  className="input-field"
                  placeholder="+91 9876543210"
                  value={phone_number}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  style={{ paddingLeft: '48px' }}
                  disabled={isLoading}
                />
              </div>
              {fieldErrors.phone_number && (
                <span style={{ color: 'var(--accent-danger)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                  {fieldErrors.phone_number}
                </span>
              )}
            </div>
          )}

          {/* Referral Code Field (Signup only) */}
          {!isLoginTab && (
            <div>
              <label className="input-label" style={{ color: 'var(--text-muted)' }}>
                Referral Code <span style={{ fontSize: '0.75rem' }}>(optional)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Gift
                  size={18}
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter referral code"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  style={{ paddingLeft: '48px' }}
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="input-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail 
                size={18} 
                color="var(--text-muted)" 
                style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} 
              />
              <input
                type="email"
                className="input-field"
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '48px' }}
                disabled={isLoading}
              />
            </div>
            {fieldErrors.email && (
              <span style={{ color: 'var(--accent-danger)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                {fieldErrors.email}
              </span>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="input-label">Password</label>
            <div style={{ position: 'relative' }}>
              <KeyRound 
                size={18} 
                color="var(--text-muted)" 
                style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} 
              />
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '48px' }}
                disabled={isLoading}
              />
            </div>
            {fieldErrors.password && (
              <span style={{ color: 'var(--accent-danger)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                {fieldErrors.password}
              </span>
            )}
          </div>

          {/* Confirm Password Field (Signup only) */}
          {!isLoginTab && (
            <div>
              <label className="input-label">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <KeyRound 
                  size={18} 
                  color="var(--text-muted)" 
                  style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} 
                />
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ paddingLeft: '48px' }}
                  disabled={isLoading}
                />
              </div>
              {fieldErrors.confirmPassword && (
                <span style={{ color: 'var(--accent-danger)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                  {fieldErrors.confirmPassword}
                </span>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '10px' }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Processing...</span>
              </>
            ) : (
              <span>{isLoginTab ? 'Sign In' : 'Create Account'}</span>
            )}
          </button>

          {isLoginTab && (
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => onNavigateForgot?.()}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', padding: 0 }}
              >
                Forgot Password?
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
