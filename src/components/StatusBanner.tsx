import React from 'react';

export interface StatusBannerProps {
  kind: 'warn' | 'error' | 'success' | 'info';
  children: React.ReactNode;
  onDismiss?: () => void;
}

export function StatusBanner({ kind, children, onDismiss }: StatusBannerProps): JSX.Element {
  return (
    <div className={`banner ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
      {onDismiss ? (
        <button onClick={onDismiss} style={{ float: 'right', border: 0, background: 'none', cursor: 'pointer' }}>
          ✕
        </button>
      ) : null}
    </div>
  );
}
