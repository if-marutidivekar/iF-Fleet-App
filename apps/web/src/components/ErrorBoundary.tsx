import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary.
 * React 18 silently unmounts the entire tree on an uncaught render error —
 * this boundary catches it and renders a readable message instead of blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fef2f2',
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: 640,
              width: '100%',
              background: '#fff',
              borderRadius: 12,
              padding: '2rem',
              boxShadow: '0 4px 12px rgba(0,0,0,.08)',
              border: '1px solid #fecaca',
            }}
          >
            <h2 style={{ color: '#dc2626', marginBottom: '0.5rem' }}>Application Error</h2>
            <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: 14 }}>
              An unexpected error occurred. Check the browser console for details.
            </p>
            <pre
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                padding: '1rem',
                overflowX: 'auto',
                fontSize: 12,
                color: '#991b1b',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {import.meta.env.DEV
                ? (this.state.error.stack ?? this.state.error.message)
                : this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
