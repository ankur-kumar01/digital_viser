import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../api';
import { Save, CheckCircle2 } from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await adminAPI.getSettings();
      setUpiId(res.admin_upi_id || '');
      setTimezone(res.global_timezone || 'Asia/Kolkata');
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
    </div>
  );
};
