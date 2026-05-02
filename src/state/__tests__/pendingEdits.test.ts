import { describe, expect, it } from 'vitest';
import {
  applyPendingEdits,
  detectCollisions,
  rewriteIdsAcrossEdits,
} from '../pendingEdits';
import { parseBacklog } from '../../parser/parseBacklog';
import { serializeBacklog } from '../../parser/serializeBacklog';
import type { PendingEdit, ItemId, IsoDate } from '../../types';

const FIXTURE = `# Backlog

## Epics

| ID | Title | Description | Status |
|----|-------|-------------|--------|
| E01 | First | First epic | approved |

## Items

| ID | Category | Description | V | M | A | Total | Complexity | Status | Epic | Created | Updated |
|----|----------|-------------|---|---|---|-------|------------|--------|------|---------|---------|
| 001 | Feature | One | 5 | 3 | 5 | 13 | Medium | proposed | E01 | 2025-01-01 | 2025-01-01 |
| 002 | Bug | Two | 4 | 4 | 4 | 12 | Low | proposed |  | 2025-01-02 | 2025-01-02 |
`;

const stagedAt = '2026-05-02' as IsoDate;
const itemId = (n: number): ItemId => n as unknown as ItemId;

describe('applyPendingEdits', () => {
  it('changes a status and bumps Updated', () => {
    const doc = parseBacklog(FIXTURE);
    const edits: PendingEdit[] = [
      { kind: 'item-cell', itemId: itemId(1), column: 'status', before: 'proposed', after: 'approved', stagedAt },
    ];
    const next = applyPendingEdits(doc, edits);
    expect(next.items[0]?.status).toBe('approved');
    expect(next.items[0]?.updated).toBe('2026-05-02');
    // Original is untouched
    expect(doc.items[0]?.status).toBe('proposed');
  });

  it('renames an ID and regenerates literal padding', () => {
    const doc = parseBacklog(FIXTURE);
    const edits: PendingEdit[] = [
      { kind: 'item-id-rename', oldId: itemId(1), newId: itemId(99), stagedAt },
    ];
    const next = applyPendingEdits(doc, edits);
    expect(next.items[0]?.id as unknown as number).toBe(99);
    expect(next.items[0]?.idLiteral).toBe('099');
  });

  it('serialises back to a stable string after edits', () => {
    const doc = parseBacklog(FIXTURE);
    const edits: PendingEdit[] = [
      { kind: 'item-cell', itemId: itemId(2), column: 'status', before: 'proposed', after: 'approved', stagedAt },
    ];
    const next = applyPendingEdits(doc, edits);
    const out = serializeBacklog(next);
    expect(out).toContain('| 002 | Bug | Two | 4 | 4 | 4 | 12 | Low | approved |  | 2025-01-02 | 2026-05-02 |');
  });
});

describe('detectCollisions', () => {
  it('flags duplicate IDs after a rename', () => {
    const doc = parseBacklog(FIXTURE);
    const edits: PendingEdit[] = [
      { kind: 'item-id-rename', oldId: itemId(1), newId: itemId(2), stagedAt },
    ];
    const next = applyPendingEdits(doc, edits);
    const c = detectCollisions(next);
    expect(c.hasCollision).toBe(true);
    expect(c.duplicateIds.map((i) => i as unknown as number)).toContain(2);
  });
});

describe('rewriteIdsAcrossEdits', () => {
  it('rewrites itemId for item-cell edits matching the renamed id', () => {
    const edits: PendingEdit[] = [
      { kind: 'item-cell', itemId: itemId(1), column: 'status', before: 'proposed', after: 'approved', stagedAt },
      { kind: 'item-cell', itemId: itemId(2), column: 'status', before: 'proposed', after: 'approved', stagedAt },
    ];
    const out = rewriteIdsAcrossEdits(edits, itemId(1), itemId(99));
    expect(out[0]?.kind === 'item-cell' && (out[0] as { itemId: ItemId }).itemId as unknown as number).toBe(99);
    expect(out[1]?.kind === 'item-cell' && (out[1] as { itemId: ItemId }).itemId as unknown as number).toBe(2);
  });
});
