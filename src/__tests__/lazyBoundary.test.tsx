import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { lazy, Suspense } from 'react';
import { MobileSkeleton } from '../components/lazy/MobileSkeleton';

/**
 * Validates the lazy-boundary surface used by App.tsx and
 * EditorOverlayProvider.tsx:
 *
 *   - The Suspense fallback (MobileSkeleton) renders synchronously while a
 *     deferred dynamic import is in flight.
 *   - When the deferred component eventually resolves, the skeleton is
 *     replaced by the real children.
 *
 * We construct an artificial deferred lazy module rather than dynamically
 * importing one of the real `src/components/mobile/*` modules — we don't
 * want this unit test to depend on the (large) mobile component tree, and
 * we want full control over the resolve timing.
 */
describe('lazy boundary (Suspense + MobileSkeleton fallback)', () => {
  it('renders MobileSkeleton on first paint while import is pending, then swaps to children', async () => {
    let resolveModule: (m: { default: () => JSX.Element }) => void = () => undefined;
    const deferred = new Promise<{ default: () => JSX.Element }>((res) => {
      resolveModule = res;
    });
    const Deferred = lazy(() => deferred);

    render(
      <Suspense fallback={<MobileSkeleton />}>
        <Deferred />
      </Suspense>,
    );

    // First paint: skeleton is visible
    expect(screen.getByTestId('mobile-skeleton')).not.toBeNull();

    // Resolve the import
    resolveModule({
      default: () => <div data-testid="real-content">resolved</div>,
    });

    await waitFor(() => {
      expect(screen.getByTestId('real-content').textContent).toBe('resolved');
    });
    expect(screen.queryByTestId('mobile-skeleton')).toBeNull();
  });

  it('MobileSkeleton renders the requested number of skeleton cards', () => {
    render(<MobileSkeleton rows={3} />);
    const cards = document.querySelectorAll('.mobile-skeleton__card');
    expect(cards).toHaveLength(3);
  });

  it('MobileSkeleton has accessible role/label', () => {
    render(<MobileSkeleton />);
    const root = screen.getByTestId('mobile-skeleton');
    expect(root.getAttribute('role')).toBe('status');
    expect(root.getAttribute('aria-label')).toMatch(/loading.*card list/i);
  });
});
