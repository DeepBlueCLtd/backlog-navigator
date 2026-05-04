import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { BacklogDocument } from '../../types';
import { selectFilteredSortedItems, useStore } from '../../state/store';
import { ItemCard, useDirtyRowIds } from './ItemCard';

interface CardListProps {
  doc: BacklogDocument;
}

/**
 * Virtualised card list for mobile (FR-002, FR-003).
 *
 * Uses `@tanstack/react-virtual` so only the rows visible in the viewport
 * are mounted, regardless of total item count (target: 1,000+ rows
 * without scroll regressions).
 *
 * Filters/sorting reuse the existing desktop selector so the same view
 * state (`store.view`) drives both layouts (FR-014).
 */
export function CardList({ doc }: CardListProps): JSX.Element {
  const { view } = useStore();
  const dirtyIds = useDirtyRowIds();

  const items = useMemo(
    () => selectFilteredSortedItems(doc, view),
    [doc, view],
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualiser = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 168, // ~card height — overridden per-row by measureElement
    overscan: 4,
    // Bootstraps the virtualiser before the parent measures (SSR, jsdom).
    // Real browsers replace this with measured values immediately.
    initialRect: { width: 375, height: 2000 },
  });

  if (doc === null) return <></>;

  if (items.length === 0) {
    return (
      <div className="card-list-empty" data-testid="card-list-empty">
        <p>No items match your filter.</p>
        <ResetFilterLink />
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="card-list"
      data-testid="card-list"
      style={{ height: 'calc(100dvh - 220px)', overflow: 'auto' }}
    >
      <div
        style={{
          height: `${virtualiser.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualiser.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          if (!item) return null;
          return (
            <div
              key={String(item.id)}
              data-index={virtualRow.index}
              ref={virtualiser.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: 8,
              }}
            >
              <ItemCard
                item={item}
                dirty={dirtyIds.has(item.id as unknown as number)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Resets phase + status + free-text + epic + category + complexity filters
 * to their `defaultView()` values. Reuses the same view-state shape as
 * desktop so the reset behaviour is identical.
 */
function ResetFilterLink(): JSX.Element {
  const { setView } = useStore();
  const reset = (): void => {
    setView((v) => ({
      ...v,
      phase: 'any',
      includeCompleted: false,
      filters: { status: null, category: null, epic: null, complexity: null },
      freeText: '',
    }));
  };
  return (
    <button type="button" className="card-list-reset" onClick={reset}>
      Reset filter
    </button>
  );
}
