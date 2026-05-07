import { Component, type ErrorInfo, type ReactNode } from 'react';
import './ChunkErrorBoundary.css';
import { strings } from '../../strings';

/**
 * Predicate distinguishing chunk-load errors (where `React.lazy` could not
 * fetch the requested module) from arbitrary render errors thrown deeper in
 * the tree. Covers Vite's runtime, webpack-style chunks, and Safari.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'ChunkLoadError') return true;
  return /Loading chunk \w+ failed|Failed to fetch dynamically imported module|Importing a module script failed/.test(
    error.message,
  );
}

interface ChunkErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallbackMessage?: string;
}

interface ChunkErrorBoundaryState {
  readonly hasChunkError: boolean;
  readonly error: Error | null;
}

/**
 * Catches errors thrown by `React.lazy` when the requested chunk cannot be
 * loaded (stale deploy URL, network failure, 404). Renders a recovery panel
 * with an explicit Reload action; non-chunk errors are re-thrown so they
 * propagate to any outer boundary unchanged.
 *
 * The boundary state is in-memory only — a successful Reload tears down the
 * boundary instance with the rest of the page.
 */
export class ChunkErrorBoundary extends Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  state: ChunkErrorBoundaryState = { hasChunkError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<ChunkErrorBoundaryState> | null {
    if (isChunkLoadError(error)) {
      return { hasChunkError: true, error };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (!isChunkLoadError(error)) {
      // Re-throw non-chunk errors so they bubble up to the global handler.
      // (No global boundary today — behaviour is unchanged for non-chunk
      // errors, matching pre-#247 navigator semantics.)
      throw error;
    }
    if (typeof console !== 'undefined') {
      console.error('[ChunkErrorBoundary] caught chunk-load error:', error, info.componentStack);
    }
  }

  private handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasChunkError) {
      return (
        <div
          className="chunk-error-boundary"
          data-testid="chunk-error"
          role="alert"
          aria-live="assertive"
        >
          <h2 className="chunk-error-boundary__title">{strings.lazy.chunkErrorTitle}</h2>
          <p className="chunk-error-boundary__message">
            {this.props.fallbackMessage ?? strings.lazy.chunkErrorMessage}
          </p>
          <button
            type="button"
            className="chunk-error-boundary__reload"
            data-testid="chunk-error-reload"
            onClick={this.handleReload}
          >
            {strings.lazy.chunkErrorReload}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
