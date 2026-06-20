import React, { useState } from 'react';
import { authAPI } from '../api';
import { Mail, KeyRound, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';

interface Props {
  onBackToLogin: () => void;
}

export const ForgotPassword: React.FC<Props> = ({ onBackToLogin }) => {
  const [step, setStep] = useState<'email' | 'otp' | 'password' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Please enter your email.'); return; }
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otp || otp.length < 4) { setError('Please enter the OTP sent to your email.'); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword(email, otp, '0');
      setStep('password');
    } catch (err: any) {
      setError(err.message || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword(email, otp, newPassword);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--bg-primary)',
    }}>
      <div className="glass-card" style={{
        maxWidth: '420px',
        width: '100%',
        padding: '36px',
      }}>
        {step === 'email' && (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🔐</div>
              <h2 style={{ margin: '0 0 6px', fontWeight: 700 }}>Reset Password</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                Enter your email to receive a password reset OTP.
              </p>
            </div>

            {error && (
              <div style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.25)', borderRadius: '8px', padding: '12px 16px', color: 'var(--accent-danger)', fontSize: '0.88rem' }}>
                {error}
              </div>
            )}

            <div>
              <label className="input-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="email" className="input-field" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} style={{ paddingLeft: '48px' }} required disabled={loading} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px' }} disabled={loading}>
              {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</> : 'Send OTP'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button type="button" onClick={onBackToLogin} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ArrowLeft size={14} /> Back to Login
              </button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📩</div>
              <h2 style={{ margin: '0 0 6px', fontWeight: 700 }}>Enter OTP</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                A 6-digit code was sent to <strong>{email}</strong>
              </p>
            </div>

            {error && (
              <div style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.25)', borderRadius: '8px', padding: '12px 16px', color: 'var(--accent-danger)', fontSize: '0.88rem' }}>
                {error}
              </div>
            )}

            <div>
              <label className="input-label">OTP Code</label>
              <input type="text" className="input-field" placeholder="000000" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '8px', fontFamily: 'monospace' }} required disabled={loading} />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px' }} disabled={loading}>
              {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Verifying...</> : 'Verify OTP'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button type="button" onClick={() => setStep('email')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', padding: 0 }}>
                Change Email
              </button>
            </div>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🔑</div>
              <h2 style={{ margin: '0 0 6px', fontWeight: 700 }}>Set New Password</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                Choose a strong password for your account.
              </p>
            </div>

            {error && (
              <div style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.25)', borderRadius: '8px', padding: '12px 16px', color: 'var(--accent-danger)', fontSize: '0.88rem' }}>
                {error}
              </div>
            )}

            <div>
              <label className="input-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="password" className="input-field" placeholder="Min. 6 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ paddingLeft: '48px' }} required disabled={loading} />
              </div>
            </div>

            <div>
              <label className="input-label">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="password" className="input-field" placeholder="Repeat password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ paddingLeft: '48px' }} required disabled={loading} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px' }} disabled={loading}>
              {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Resetting...</> : 'Reset Password'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button type="button" onClick={() => setStep('otp')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ArrowLeft size={14} /> Back to OTP
              </button>
            </div>
          </form>
        )}

        {step === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(34,197,94,0.3)' }}>
              <CheckCircle2 size={36} color="var(--accent-secondary)" />
            </div>
            <div>
              <h2 style={{ margin: '0 0 8px', fontWeight: 700 }}>Password Reset Successful!</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                You can now log in with your new password.
              </p>
            </div>
            <button type="button" className="btn btn-primary" style={{ width: '100%', padding: '14px' }} onClick={onBackToLogin}>
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
