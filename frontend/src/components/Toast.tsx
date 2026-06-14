import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error';

interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div 
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 9999,
          pointerEvents: 'none'
        }}
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="animate-slide-left"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'var(--bg-card)',
              border: `1px solid ${toast.type === 'success' ? 'var(--accent-secondary)' : 'var(--accent-danger)'}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              minWidth: '280px',
              maxWidth: '400px',
              pointerEvents: 'auto'
            }}
          >
            {toast.type === 'success' ? (
              <CheckCircle size={20} color="var(--accent-secondary)" />
            ) : (
              <XCircle size={20} color="var(--accent-danger)" />
            )}
            <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
              {toast.message}
            </span>
            <button 
              onClick={() => removeToast(toast.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
