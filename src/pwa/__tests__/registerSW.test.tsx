import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import {
  PWAUpdateProvider,
  UpdatePrompt,
  usePWAUpdateState,
} from '../UpdatePrompt';
import type { ServiceWorkerUpdateState } from '../../types';

function renderWithState(state: ServiceWorkerUpdateState): void {
  render(
    <PWAUpdateProvider state={state}>
      <UpdatePrompt />
    </PWAUpdateProvider>,
  );
}

describe('UpdatePrompt + PWAUpdateProvider', () => {
  it('renders nothing when state is up-to-date', () => {
    renderWithState({ kind: 'up-to-date' });
    expect(screen.queryByTestId('pwa-update-banner')).toBeNull();
  });

  it('renders the update-available banner with Reload + Dismiss', () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    renderWithState({ kind: 'update-available', reload });
    const banner = screen.getByTestId('pwa-update-banner');
    expect(banner.getAttribute('data-state')).toBe('update-available');
    expect(screen.getByTestId('pwa-update-reload')).toBeTruthy();
    expect(screen.getByTestId('pwa-update-dismiss')).toBeTruthy();
  });

  it('Reload click invokes the reload callback', () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    renderWithState({ kind: 'update-available', reload });
    fireEvent.click(screen.getByTestId('pwa-update-reload'));
    expect(reload).toHaveBeenCalled();
  });

  it('Dismiss hides the banner for the session', () => {
    renderWithState({ kind: 'update-available', reload: vi.fn().mockResolvedValue(undefined) });
    expect(screen.getByTestId('pwa-update-banner')).toBeTruthy();
    fireEvent.click(screen.getByTestId('pwa-update-dismiss'));
    expect(screen.queryByTestId('pwa-update-banner')).toBeNull();
  });

  it('renders the updating banner with spinner when state is updating', () => {
    renderWithState({ kind: 'updating' });
    expect(screen.getByTestId('pwa-update-banner').getAttribute('data-state')).toBe('updating');
  });

  it('usePWAUpdateState reads the current state from context', () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    function Probe(): JSX.Element {
      const s = usePWAUpdateState();
      return <output data-testid="probe">{s.kind}</output>;
    }
    render(
      <PWAUpdateProvider state={{ kind: 'update-available', reload }}>
        <Probe />
      </PWAUpdateProvider>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('update-available');
  });
});
