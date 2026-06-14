import React, { useState } from 'react';
import { Users, Copy, CheckCircle2 } from 'lucide-react';

interface ReferralsProps {
  user: any;
}

export const Referrals: React.FC<ReferralsProps> = ({ user }) => {
  const [copied, setCopied] = useState(false);

  const referralLink = `${window.location.origin}/register?ref=${user?.referral_code}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '800px' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Referral Program</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Invite your friends and earn bonuses. Share your unique referral link to get started.
        </p>
      </div>

      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'var(--accent-primary)', color: 'var(--bg-primary)', padding: '16px', borderRadius: '50%' }}>
            <Users size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Your Referral Link</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Share this link to invite others</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <input 
            type="text" 
            readOnly 
            value={referralLink} 
            className="input-field" 
            style={{ flex: 1, cursor: 'text' }}
          />
          <button 
            className={`btn ${copied ? 'btn-success' : 'btn-primary'}`} 
            onClick={copyToClipboard}
            style={{ minWidth: '120px' }}
          >
            {copied ? <><CheckCircle2 size={18} /> Copied!</> : <><Copy size={18} /> Copy Link</>}
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ textAlign: 'center', padding: '32px' }}>
        <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Available Referral Balance</h4>
        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
          ₹{parseFloat(user?.referral_balance || '0').toFixed(2)}
        </div>
      </div>
    </div>
  );
};
