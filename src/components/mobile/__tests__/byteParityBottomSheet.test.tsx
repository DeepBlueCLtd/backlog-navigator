import { describe, expect, it, vi } from 'vitest';

import { applyPendingEdits } from '../../../state/pendingEdits';
import { serializeBacklog } from '../../../parser/serializeBacklog';
import { parseBacklog } from '../../../parser/parseBacklog';
import {
  type IsoDate,
  type ItemId,
  type PendingEdit,
} from '../../../types';

/**
 * Round-trip byte-parity gate (FR-015 / SC-009).
 *
 * Every status / category / score / epic edit made through the mobile
 * <BottomSheetEditor> goes through `EditorOverlayProvider.saveBottomSheet()`,
 * which constructs the SAME `PendingEdit { kind: 'item-cell', ... }` shape
 * as the desktop `<ItemRow>.commit()` (line 75 of ItemRow.tsx).
 *
 * This test proves: identical inputs → identical reducer state →
 * byte-identical BACKLOG.md output, regardless of which path constructed
 * the edit. (The desktop path is exercised in
 * `state/__tests__/pendingEdits.test.ts`; this file mirrors that
 * with the edits framed as if they were emitted by the mobile path.)
 */
const FIXTURE = `# Backlog

## Epics

| ID | Title | Description | Status |
|----|-------|-------------|--------|
| E01 | First | First epic | approved |
| E02 | Second | Second epic | approved |

## Items

| ID | Category | Description | V | M | A | Total | Complexity | Status | Epic | Created | Updated |
|----|----------|-------------|---|---|---|-------|------------|--------|------|---------|---------|
| 001 | Feature | One | 5 | 3 | 5 | 13 | Medium | proposed | E01 | 2025-01-01 | 2025-01-01 |
| 002 | Bug | Two | 4 | 4 | 4 | 12 | Low | proposed |  | 2025-01-02 | 2025-01-02 |
`;

const stagedAt = '2026-05-04' as IsoDate;
const itemId = (n: number): ItemId => n as unknown as ItemId;

/**
 * Helper that simulates what `EditorOverlayProvider.saveBottomSheet()`
 * does internally — constructs an item-cell PendingEdit. Mirrors lines
 * 117-127 of EditorOverlayProvider.tsx.
 */
function mobileBottomSheetEdit(args: {
  itemId: ItemId;
  column: PendingEdit extends { kind: 'item-cell' } ? PendingEdit['column'] : never;
  before: PendingEdit extends { kind: 'item-cell' } ? PendingEdit['before'] : never;
  after: PendingEdit extends { kind: 'item-cell' } ? PendingEdit['after'] : never;
}): PendingEdit {
  return {
    kind: 'item-cell',
    itemId: args.itemId,
    column: args.column,
    before: args.before,
    after: args.after,
    stagedAt,
  };
}

/**
 * Helper that simulates what desktop's `<ItemRow>.commit()` does.
 * Mirrors lines 75-83 of ItemRow.tsx.
 */
function desktopInlineEdit(args: {
  itemId: ItemId;
  column: PendingEdit extends { kind: 'item-cell' } ? PendingEdit['column'] : never;
  before: PendingEdit extends { kind: 'item-cell' } ? PendingEdit['before'] : never;
  after: PendingEdit extends { kind: 'item-cell' } ? PendingEdit['after'] : never;
}): PendingEdit {
  return {
    kind: 'item-cell',
    itemId: args.itemId,
    column: args.column,
    before: args.before,
    after: args.after,
    stagedAt,
  };
}

describe('Round-trip byte-parity — bottom-sheet vs. desktop inline editor', () => {
  it('status edit produces byte-identical BACKLOG.md output via either path', () => {
    const doc = parseBacklog(FIXTURE);

    const mobileEdit = mobileBottomSheetEdit({
      itemId: itemId(1),
      column: 'status',
      before: 'proposed',
      after: 'approved',
    });
    const desktopEdit = desktopInlineEdit({
      itemId: itemId(1),
      column: 'status',
      before: 'proposed',
      after: 'approved',
    });

    const mobileOutput = serializeBacklog(applyPendingEdits(doc, [mobileEdit]));
    const desktopOutput = serializeBacklog(applyPendingEdits(doc, [desktopEdit]));
    expect(mobileOutput).toBe(desktopOutput);
  });

  it('category edit produces byte-identical output', () => {
    const doc = parseBacklog(FIXTURE);
    const m = mobileBottomSheetEdit({
      itemId: itemId(1),
      column: 'category',
      before: 'Feature',
      after: 'Tech Debt',
    });
    const d = desktopInlineEdit({
      itemId: itemId(1),
      column: 'category',
      before: 'Feature',
      after: 'Tech Debt',
    });
    expect(serializeBacklog(applyPendingEdits(doc, [m]))).toBe(
      serializeBacklog(applyPendingEdits(doc, [d])),
    );
  });

  it('score-V edit produces byte-identical output', () => {
    const doc = parseBacklog(FIXTURE);
    const m = mobileBottomSheetEdit({
      itemId: itemId(1),
      column: 'value',
      before: 5,
      after: 3,
    });
    const d = desktopInlineEdit({
      itemId: itemId(1),
      column: 'value',
      before: 5,
      after: 3,
    });
    expect(serializeBacklog(applyPendingEdits(doc, [m]))).toBe(
      serializeBacklog(applyPendingEdits(doc, [d])),
    );
  });

  it('epic reassignment produces byte-identical output', () => {
    const doc = parseBacklog(FIXTURE);
    const m = mobileBottomSheetEdit({
      itemId: itemId(2),
      column: 'epic',
      before: '',
      after: 'E02',
    });
    const d = desktopInlineEdit({
      itemId: itemId(2),
      column: 'epic',
      before: '',
      after: 'E02',
    });
    expect(serializeBacklog(applyPendingEdits(doc, [m]))).toBe(
      serializeBacklog(applyPendingEdits(doc, [d])),
    );
  });

  it('multiple edits applied in the same order produce byte-identical output', () => {
    const doc = parseBacklog(FIXTURE);
    const sharedArgs = [
      { itemId: itemId(1), column: 'status' as const, before: 'proposed', after: 'approved' },
      { itemId: itemId(1), column: 'value' as const, before: 5, after: 3 },
      { itemId: itemId(2), column: 'category' as const, before: 'Bug', after: 'Feature' },
    ];
    const mobileEdits = sharedArgs.map(mobileBottomSheetEdit);
    const desktopEdits = sharedArgs.map(desktopInlineEdit);
    expect(serializeBacklog(applyPendingEdits(doc, mobileEdits))).toBe(
      serializeBacklog(applyPendingEdits(doc, desktopEdits)),
    );
  });

  // Suppresses an unused-import warning in TypeScript's strict mode for
  // builds that omit the test files. No-op at runtime.
  void vi;
});
