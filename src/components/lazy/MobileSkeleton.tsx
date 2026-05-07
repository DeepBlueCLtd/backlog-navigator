import './MobileSkeleton.css';
import { strings } from '../../strings';

interface MobileSkeletonProps {
  readonly rows?: number;
}

/**
 * Skeleton card-list rendered while the lazy-loaded mobile chunk is in flight.
 *
 * Reuses the same shimmer technique shipped by `@debrief/components`'s
 * `LogPanel/SkeletonLoader` — a horizontal gradient sweep on a dim background
 * — but the geometry is card-shaped rather than text-row-shaped, because that
 * is what the eventual `CardList` renders. The animation is keyed off CSS
 * variables so theme tokens flow through unchanged when the navigator runs
 * inside a host that themes them (today: standalone; tomorrow: anywhere).
 *
 * No dependency on `@debrief/components` is added — the skeleton lives inside
 * the entry chunk so it can paint immediately, before any lazy module has
 * resolved.
 */
export function MobileSkeleton({ rows = 6 }: MobileSkeletonProps): JSX.Element {
  return (
    <div
      className="mobile-skeleton"
      data-testid="mobile-skeleton"
      role="status"
      aria-live="polite"
      aria-label={strings.lazy.skeletonAriaLabel}
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="mobile-skeleton__card" aria-hidden="true">
          <div className="mobile-skeleton__line mobile-skeleton__line--title" />
          <div className="mobile-skeleton__line mobile-skeleton__line--meta" />
          <div className="mobile-skeleton__line mobile-skeleton__line--body" />
        </div>
      ))}
    </div>
  );
}
