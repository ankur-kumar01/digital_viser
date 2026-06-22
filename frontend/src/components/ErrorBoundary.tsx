import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ISSUE-023 FIX: React Error Boundary to prevent a single component crash from
 * blanking the entire application. Shows a recovery UI instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
          padding: '2rem',
          textAlign: 'center',
          background: 'var(--bg-secondary, #1a1a2e)',
          borderRadius: '12px',
          margin: '1rem',
          border: '1px solid rgba(255,100,100,0.3)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: '#ff6b6b', marginBottom: '0.5rem', fontSize: '1.2rem' }}>
            {this.props.fallbackMessage || 'Something went wrong'}
          </h2>
          <p style={{ color: 'var(--text-secondary, #aaa)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {this.state.error?.message || 'An unexpected error occurred in this section.'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '0.6rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
