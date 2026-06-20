import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../api';
import { Save, CheckCircle2, Mail } from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [enableAviatorChat, setEnableAviatorChat] = useState(true);
  const [enableAviatorBet, setEnableAviatorBet] = useState(true);
  const [enableColourTradingBet, setEnableColourTradingBet] = useState(true);

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('Digital Viser');
  const [smtpConfigured, setSmtpConfigured] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await adminAPI.getSettings();
      setUpiId(res.admin_upi_id || '');
      setTimezone(res.global_timezone || 'Asia/Kolkata');
      setEnableAviatorChat(res.enable_aviator_chat_simulation !== 'false');
      setEnableAviatorBet(res.enable_aviator_bet_simulation !== 'false');
      setEnableColourTradingBet(res.enable_colour_trading_bet_simulation !== 'false');
      setSmtpHost(res.smtp_host || '');
      setSmtpPort(res.smtp_port || '587');
      setSmtpUser(res.smtp_user || '');
      setSmtpFromEmail(res.smtp_from_email || '');
      setSmtpFromName(res.smtp_from_name || 'Digital Viser');
      if (res.smtp_pass) {
        setSmtpConfigured(true);
        setSmtpPass('••••••••');
      }
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await adminAPI.updateUpiSettings(upiId);
      setSuccess('UPI ID updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTimezoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await adminAPI.updateSettings({ global_timezone: timezone });
      setSuccess('Timezone updated successfully! Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSimulationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await adminAPI.updateSettings({
        enable_aviator_chat_simulation: String(enableAviatorChat),
        enable_aviator_bet_simulation: String(enableAviatorBet),
        enable_colour_trading_bet_simulation: String(enableColourTradingBet)
      });
      setSuccess('Simulation settings updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSmtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload: any = {
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_from_email: smtpFromEmail,
        smtp_from_name: smtpFromName,
      };
      if (smtpPass !== '••••••••') {
        payload.smtp_pass = smtpPass;
      }
      await adminAPI.updateSettings(payload);
      setSmtpConfigured(true);
      setSmtpPass('••••••••');
      setSuccess('SMTP settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update SMTP settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '32px' }}>Loading settings...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '600px' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>System Settings</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Configure global platform settings including payment integrations.
        </p>
      </div>

      {success && (
        <div style={{ background: 'rgba(0, 245, 160, 0.1)', border: '1px solid var(--accent-secondary)', padding: '16px', borderRadius: 'var(--radius-sm)', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={20} />
          {success}
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--accent-danger)', padding: '12px 16px', borderRadius: '4px', color: 'var(--accent-danger)' }}>
          {error}
        </div>
      )}

      <div className="glass-card">
        <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>Payment Gateway Configuration</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label className="input-label">Admin UPI ID</label>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              This UPI ID will be used to automatically generate dynamic QR codes for users making deposits via the modern UPI Gateway.
            </p>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. yourbusiness@upi" 
              value={upiId} 
              onChange={e => setUpiId(e.target.value)} 
              required 
            />
          </div>
          
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      <div className="glass-card">
        <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>Localization Settings</h3>
        <form onSubmit={handleTimezoneSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label className="input-label">Global Timezone</label>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Enforces a unified timezone for all UI dates, transaction logs, and daily cron resets across the entire platform, overriding user local time.
            </p>
            <select 
              className="input-field" 
              value={timezone} 
              onChange={e => setTimezone(e.target.value)} 
              required
            >
              <option value="UTC">UTC (GMT)</option>
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="America/New_York">America/New_York (EST/EDT)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
            </select>
          </div>
          
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
      <div className="glass-card">
        <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>Simulation Settings</h3>
        <form onSubmit={handleSimulationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label className="input-label">Aviator Chat Simulation</label>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Enable simulated live bot messages on user dashboard overview chat widget and in-game Aviator chat.
            </p>
            <select 
              className="input-field" 
              value={enableAviatorChat ? 'true' : 'false'} 
              onChange={e => setEnableAviatorChat(e.target.value === 'true')}
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>

          <div>
            <label className="input-label">Aviator Game Bet Simulation</label>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Enable simulated live players placing bets and cashing out in the Aviator game.
            </p>
            <select 
              className="input-field" 
              value={enableAviatorBet ? 'true' : 'false'} 
              onChange={e => setEnableAviatorBet(e.target.value === 'true')}
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>

          <div>
            <label className="input-label">Colour Trading Bet Simulation</label>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Enable simulated live players placing bets in the Colour Trading game.
            </p>
            <select 
              className="input-field" 
              value={enableColourTradingBet ? 'true' : 'false'} 
              onChange={e => setEnableColourTradingBet(e.target.value === 'true')}
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      <div className="glass-card">
        <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Mail size={18} /> Email / SMTP Configuration
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Configure SMTP credentials for sending password reset OTP emails and other system notifications to users.
        </p>
        <form onSubmit={handleSmtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '2 1 200px' }}>
              <label className="input-label">SMTP Host</label>
              <input type="text" className="input-field" placeholder="smtp.gmail.com" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <label className="input-label">Port</label>
              <input type="number" className="input-field" placeholder="587" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="input-label">SMTP Username</label>
            <input type="text" className="input-field" placeholder="your@email.com" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} />
          </div>
          <div>
            <label className="input-label">SMTP Password</label>
            <input type="password" className="input-field" placeholder={smtpConfigured ? 'Leave blank to keep current' : 'Enter password'} value={smtpPass} onChange={e => setSmtpPass(e.target.value)} />
            {smtpConfigured && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Leave as dots to keep existing password.</p>}
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label className="input-label">From Email</label>
              <input type="email" className="input-field" placeholder="noreply@domain.com" value={smtpFromEmail} onChange={e => setSmtpFromEmail(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label className="input-label">From Name</label>
              <input type="text" className="input-field" placeholder="Digital Viser" value={smtpFromName} onChange={e => setSmtpFromName(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={18} />
            {saving ? 'Saving...' : 'Save SMTP Settings'}
          </button>
        </form>
      </div>
    </div>
  );
};
