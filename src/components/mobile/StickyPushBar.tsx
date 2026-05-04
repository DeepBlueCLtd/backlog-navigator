import { useStore } from '../../state/store';

interface StickyPushBarProps {
  /** Open the push dialog (same callback the desktop PendingFooter uses). */
  onPushChanges: () => void;
  /**
   * Optional state hint (currently unused — the bar reflects only
   * dirty-count for now). Phase 7 may extend this to render the
   * conflict / network-error state inline rather than via a dialog;
   * spec.md US4 AS2 is satisfied today via the existing PushDialog
   * conflict surface (same wording as desktop).
   */
  variant?: 'idle' | 'conflict' | 'success';
}

/**
 * Sticky bottom Push-Changes bar (FR-010). Hidden entirely (returns
 * `null`) when `dirtyRowIds.size === 0` so it never occupies viewport
 * space when there's nothing to push.
 *
 * The bar sits above the iPhone home bar via
 * `padding-bottom: env(safe-area-inset-bottom)` (R-8). Its z-index
 * (`90` in mobile.css) is below the bottom-sheet (`100`) and below the
 * description editor (`110`) so an open editor visually covers the bar.
 *
 * Push semantics — calls the same `onPushChanges` callback the desktop
 * `<PendingFooter>` calls, which routes through the unmodified
 * `<PushDialog>` and `state/push.ts` pipeline. Conflict detection,
 * commit message format, and error handling are byte-identical to
 * desktop (FR-016).
 */
export function StickyPushBar({ onPushChanges, variant = 'idle' }: StickyPushBarProps): JSX.Element | null {
  const { edits } = useStore();
  const n = edits.length;
  if (n === 0) return null;

  return (
    <div
      className="sticky-push-bar"
      data-testid="sticky-push-bar"
      data-state={variant}
      role="region"
      aria-label="Pending edits push bar"
    >
      <span className="sticky-push-bar-count" data-testid="sticky-push-bar-count">
        {n === 1 ? '1 unsynced edit' : `${n} unsynced edits`}
      </span>
      <button
        type="button"
        className="sticky-push-bar-button"
        data-testid="push-button"
        onClick={onPushChanges}
        aria-label={`Push ${n} change${n === 1 ? '' : 's'} to GitHub`}
      >
        Push
      </button>
    </div>
  );
}
