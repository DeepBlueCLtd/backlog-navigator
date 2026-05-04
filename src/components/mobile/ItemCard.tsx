import { type ReactNode } from 'react';
import type { BacklogItem } from '../../types';
import { useEditorOverlay } from '../../editors/EditorOverlayContext';
import { useStore } from '../../state/store';

interface ItemCardProps {
  item: BacklogItem;
  /** True when there's at least one pending edit for this row. */
  dirty: boolean;
}

/**
 * Single card surface representing a `BacklogItem` (FR-003 / FR-004 / FR-008).
 *
 * Tap targets:
 *   - Status chip → opens bottom-sheet status editor (Phase 4 wires this up;
 *     today the chip dispatches `openBottomSheet` which the empty bottom-sheet
 *     in EditorOverlayProvider receives but does not yet render visually).
 *   - Category chip → opens bottom-sheet category editor.
 *   - Score chip → opens bottom-sheet score editor (unified V·M·A per
 *     Mockup 03 reviewer decision).
 *   - Epic tag → opens bottom-sheet epic editor.
 *   - Description region → opens full-screen Description editor.
 *
 * The card itself is not interactive (taps register on the chips); this
 * keeps the surface scannable and avoids spurious touches when scrolling.
 */
export function ItemCard({ item, dirty }: ItemCardProps): JSX.Element {
  const overlay = useEditorOverlay();
  const struck = item.status === 'complete';

  const openStatus = (): void => {
    overlay.openBottomSheet({
      itemId: item.id,
      editorKind: 'status',
      initialValue: item.status,
    });
  };
  const openCategory = (): void => {
    overlay.openBottomSheet({
      itemId: item.id,
      editorKind: 'category',
      initialValue: item.category,
    });
  };
  const openEpic = (): void => {
    overlay.openBottomSheet({
      itemId: item.id,
      editorKind: 'epic',
      initialValue: item.epic ?? '',
    });
  };
  const openScoreV = (): void => {
    overlay.openBottomSheet({
      itemId: item.id,
      editorKind: 'score-V',
      initialValue: item.value,
    });
  };
  const openDescription = (): void => {
    overlay.openDescriptionEditor({
      itemId: item.id,
      rawMarkdown: item.description,
    });
  };

  const totalText = item.total === '-' ? '-' : String(item.total);
  const valueText = item.value === '-' ? '-' : String(item.value);
  const mediaText = item.media === '-' ? '-' : String(item.media);
  const autonomyText = item.autonomy === '-' ? '-' : String(item.autonomy);

  return (
    <article
      className="item-card"
      data-testid={`item-card-${String(item.id)}`}
      data-strikethrough={struck ? 'true' : undefined}
      data-dirty={dirty ? 'true' : undefined}
    >
      <header className="item-card-header" style={{ gridArea: 'id' }}>
        <span className="item-card-id">
          {dirty ? <span aria-label="modified" className="item-card-dirty">◍ </span> : null}
          {struck ? <s>#{item.idLiteral}</s> : <>#{item.idLiteral}</>}
        </span>
        <button
          type="button"
          className="chip item-card-category"
          data-testid="category-chip"
          onClick={openCategory}
          aria-label={`Category: ${item.category} (tap to edit)`}
        >
          {item.category}
        </button>
      </header>

      <button
        type="button"
        className="chip item-card-score"
        data-testid="score-chip"
        onClick={openScoreV}
        aria-label={`Score: total ${totalText}, value ${valueText}, media ${mediaText}, autonomy ${autonomyText} (tap to edit)`}
        style={{ gridArea: 'score' }}
      >
        <span className="item-card-score-total">{totalText}</span>
        <span className="item-card-score-axes">
          {valueText}·{mediaText}·{autonomyText}
        </span>
      </button>

      <button
        type="button"
        className="item-card-description"
        data-testid="item-card-description"
        onClick={openDescription}
        aria-label="Edit description"
        style={{ gridArea: 'desc' }}
      >
        {struck ? (
          <s>{summariseDescription(item.description)}</s>
        ) : (
          summariseDescription(item.description)
        )}
      </button>

      <div className="item-card-meta" style={{ gridArea: 'meta' }}>
        <button
          type="button"
          className="chip item-card-status"
          data-testid="status-chip"
          onClick={openStatus}
          data-status={item.status}
          aria-label={`Status: ${item.status} (tap to edit)`}
        >
          ⚑ {item.status}
        </button>
        <button
          type="button"
          className="chip item-card-epic"
          data-testid="epic-chip"
          onClick={openEpic}
          aria-label={`Epic: ${item.epic ?? '(none)'} (tap to edit)`}
        >
          {item.epic ?? '—'}
        </button>
        <span className="item-card-updated">updated {item.updated}</span>
      </div>
    </article>
  );
}

/**
 * Truncate a Markdown description to ~200 chars for the card surface.
 * Phase 5's full-screen editor opens the unabridged source when tapped.
 */
function summariseDescription(raw: string): ReactNode {
  const trimmed = raw.trim();
  if (trimmed.length <= 200) return trimmed;
  return `${trimmed.slice(0, 200).trimEnd()}…`;
}

/**
 * Helper for tests / parents that need to know whether a row has pending
 * edits. Reads the same `edits` array as the existing `ItemRow` does.
 */
export function useDirtyRowIds(): Set<number> {
  const { edits } = useStore();
  const ids = new Set<number>();
  for (const e of edits) {
    if (e.kind === 'item-cell') ids.add(e.itemId as unknown as number);
    else if (e.kind === 'item-id-rename') ids.add(e.newId as unknown as number);
  }
  return ids;
}
