import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import {
  ChunkErrorBoundary,
  isChunkLoadError,
} from '../components/lazy/ChunkErrorBoundary';

describe('isChunkLoadError', () => {
  it('returns true for ChunkLoadError name', () => {
    const err = new Error('whatever');
    err.name = 'ChunkLoadError';
    expect(isChunkLoadError(err)).toBe(true);
  });

  it('returns true for "Loading chunk N failed" message', () => {
    expect(isChunkLoadError(new Error('Loading chunk 42 failed.'))).toBe(true);
  });

  it('returns true for Vite "Failed to fetch dynamically imported module"', () => {
    expect(
      isChunkLoadError(
        new Error('Failed to fetch dynamically imported module: /assets/mobile-abc.js'),
      ),
    ).toBe(true);
  });

  it('returns true for Safari "Importing a module script failed"', () => {
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
  });

  it('returns false for arbitrary render errors', () => {
    expect(isChunkLoadError(new Error('Cannot read property foo of undefined'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isChunkLoadError('not an error')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

/** Helper: a child that throws on render. */
function ThrowOnRender({ error }: { error: Error }): JSX.Element {
  throw error;
}

/**
 * Outer boundary used to swallow re-thrown non-chunk errors so the test
 * harness doesn't fail. We assert on its captured error to confirm the
 * propagation.
 */
class CatchAllBoundary extends Component<
  { children: ReactNode; onCatch?: (e: Error) => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(err: Error): void {
    this.props.onCatch?.(err);
  }
  render(): ReactNode {
    return this.state.hasError ? <div data-testid="catch-all">caught</div> : this.props.children;
  }
}

describe('ChunkErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when no error is thrown', () => {
    render(
      <ChunkErrorBoundary>
        <div data-testid="child">healthy</div>
      </ChunkErrorBoundary>,
    );
    expect(screen.getByTestId('child').textContent).toBe('healthy');
    expect(screen.queryByTestId('chunk-error')).toBeNull();
  });

  it('renders the recovery panel when a ChunkLoadError is thrown', () => {
    const err = new Error('Loading chunk 7 failed.');
    err.name = 'ChunkLoadError';
    render(
      <ChunkErrorBoundary>
        <ThrowOnRender error={err} />
      </ChunkErrorBoundary>,
    );
    expect(screen.getByTestId('chunk-error')).not.toBeNull();
    expect(screen.getByTestId('chunk-error-reload')).not.toBeNull();
  });

  it('catches Vite "Failed to fetch dynamically imported module"', () => {
    render(
      <ChunkErrorBoundary>
        <ThrowOnRender
          error={
            new Error('Failed to fetch dynamically imported module: /assets/mobile-xyz.js')
          }
        />
      </ChunkErrorBoundary>,
    );
    expect(screen.getByTestId('chunk-error')).not.toBeNull();
  });

  it('rethrows non-chunk errors so they reach an outer boundary', () => {
    let captured: Error | null = null;
    render(
      <CatchAllBoundary onCatch={(e) => (captured = e)}>
        <ChunkErrorBoundary>
          <ThrowOnRender error={new Error('Cannot read property foo of undefined')} />
        </ChunkErrorBoundary>
      </CatchAllBoundary>,
    );
    // Outer boundary caught (chunk boundary did NOT swallow it)
    expect(screen.getByTestId('catch-all')).not.toBeNull();
    expect(screen.queryByTestId('chunk-error')).toBeNull();
    expect(captured).not.toBeNull();
    expect((captured as unknown as Error).message).toMatch(/Cannot read property/);
  });

  it('Reload button calls window.location.reload()', () => {
    const reloadMock = vi.fn();
    const originalLocation = window.location;
    // jsdom's window.location is non-configurable; replacing the whole
    // object via delete + assignment is the documented workaround.
    // @ts-expect-error — jsdom permits this re-assignment in tests
    delete window.location;
    // @ts-expect-error — see above
    window.location = { ...originalLocation, reload: reloadMock };
    try {
      const err = new Error('Loading chunk 1 failed.');
      err.name = 'ChunkLoadError';
      render(
        <ChunkErrorBoundary>
          <ThrowOnRender error={err} />
        </ChunkErrorBoundary>,
      );
      screen.getByTestId('chunk-error-reload').click();
      expect(reloadMock).toHaveBeenCalledTimes(1);
    } finally {
      // @ts-expect-error — restore
      window.location = originalLocation;
    }
  });
});
