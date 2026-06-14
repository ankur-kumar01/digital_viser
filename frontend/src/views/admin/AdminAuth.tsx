import React, { useState } from 'react';
import { adminAPI, saveAdminToken } from '../../api';
import { ShieldCheck } from 'lucide-react';

interface AdminAuthProps {
  onLogin: (token: string, admin: any) => void;
}

export const AdminAuth: React.FC<AdminAuthProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const res = await adminAPI.login({ email, password });
      saveAdminToken(res.token);
      onLogin(res.token, res.admin);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-body-gradient)',
      padding: '20px'
    }}>
      <div className="glass-card glow-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            display: 'inline-flex', 
            padding: '16px', 
            borderRadius: '50%', 
            background: 'rgba(234, 179, 8, 0.1)', 
            marginBottom: '16px',
            boxShadow: '0 8px 20px rgba(234, 179, 8, 0.2)'
          }}>
            <ShieldCheck size={32} color="var(--accent-primary)" />
          </div>
          <h2 style={{ fontSize: '1.75rem', color: 'var(--text-primary)', marginBottom: '6px' }}>Admin Portal</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>Secure access to platform controls</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(255, 71, 87, 0.08)', border: '1px solid rgba(255, 71, 87, 0.25)', borderRadius: 'var(--radius-sm)', padding: '12px', color: 'var(--accent-danger)', fontSize: '0.85rem', marginBottom: '20px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label className="input-label">Admin Email</label>
            <input type="email" className="input-field" placeholder="admin@digitalviser.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
          </div>
          <div>
            <label className="input-label">Password</label>
            <input type="password" className="input-field" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={isLoading}>
            {isLoading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
      </div>
    </div>
  );
};
