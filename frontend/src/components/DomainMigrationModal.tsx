import React, { useState, useEffect } from 'react';
import { Globe, Copy, Check, ExternalLink, AlertTriangle, X } from 'lucide-react';

export const DomainMigrationModal: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const NEW_DOMAIN_URL = 'https://viserdigital.site';

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    const searchParams = new URLSearchParams(window.location.search);
    
    // Check if running on web.viserdigital.site (http or https) or testing via query parameter ?show_migration=true
    const isOldUrl = hostname === 'web.viserdigital.site' || 
                     hostname.includes('web.viserdigital.site') || 
                     searchParams.get('show_migration') === 'true';

    // Check session storage so if user clicks 'Continue for now', it doesn't pop up on every route change in the same session
    const dismissedThisSession = sessionStorage.getItem('migration_modal_dismissed');

    if (isOldUrl && !dismissedThisSession) {
      setShowModal(true);
    }
  }, []);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(NEW_DOMAIN_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      // Fallback for non-secure contexts if needed
      const textArea = document.createElement('textarea');
      textArea.value = NEW_DOMAIN_URL;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleRedirect = () => {
    window.location.href = NEW_DOMAIN_URL;
  };

  const handleDismiss = () => {
    sessionStorage.setItem('migration_modal_dismissed', 'true');
    setShowModal(false);
  };

  if (!showModal) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #1e293b, #0f172a)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.15)',
          borderRadius: '20px',
          maxWidth: '520px',
          width: '100%',
          padding: '32px 28px',
          position: 'relative',
          color: '#ffffff',
          textAlign: 'center'
        }}
      >
        <button
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            color: '#94a3b8',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          title="Dismiss for now"
        >
          <X size={18} />
        </button>

        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#f59e0b'
          }}
        >
          <Globe size={32} />
        </div>

        <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '12px', letterSpacing: '-0.5px' }}>
          Important Website Address Update
        </h3>

        <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
          You are currently accessing our platform via <span style={{ color: '#f87171', fontWeight: 600 }}>web.viserdigital.site</span>. 
          To ensure faster performance, enhanced security, and uninterrupted service, please start using our new official website address below.
        </p>

        {/* URL Display Box */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '28px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {NEW_DOMAIN_URL}
            </span>
          </div>

          <button
            onClick={handleCopyUrl}
            style={{
              background: copied ? 'rgba(16, 185, 129, 0.2)' : 'var(--primary, #6366f1)',
              color: copied ? '#10b981' : '#ffffff',
              border: copied ? '1px solid #10b981' : 'none',
              padding: '8px 14px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {copied ? (
              <>
                <Check size={16} /> Copied!
              </>
            ) : (
              <>
                <Copy size={16} /> Copy URL
              </>
            )}
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleRedirect}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#ffffff',
              border: 'none',
              padding: '14px 20px',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
              transition: 'transform 0.1s'
            }}
          >
            Visit New Website Now <ExternalLink size={18} />
          </button>

          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              color: '#64748b',
              border: 'none',
              padding: '10px',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Continue on current site for this session
          </button>
        </div>
      </div>
    </div>
  );
};
