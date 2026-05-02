import { describe, expect, it } from 'vitest';
import { summarise, summaryToText } from '../summary';
import type { PendingEdit, ItemId, IsoDate, EpicId } from '../../types';

const stagedAt = '2026-05-02' as IsoDate;
const itemId = (n: number): ItemId => n as unknown as ItemId;
const epicId = (s: string): EpicId => s as unknown as EpicId;

describe('summarise', () => {
  it('counts each edit-kind into its tally', () => {
    const edits: PendingEdit[] = [
      { kind: 'item-cell', itemId: itemId(1), column: 'status', before: 'proposed', after: 'approved', stagedAt },
      { kind: 'item-cell', itemId: itemId(1), column: 'description', before: 'a', after: 'b', stagedAt },
      { kind: 'item-cell', itemId: itemId(2), column: 'value', before: 3, after: 5, stagedAt },
      { kind: 'item-id-rename', oldId: itemId(3), newId: itemId(4), stagedAt },
      { kind: 'epic-cell', epicId: epicId('E01'), column: 'status', before: 'proposed', after: 'approved', stagedAt },
    ];
    const s = summarise(edits);
    expect(s.byKind.statusChanges).toBe(2); // item status + epic status
    expect(s.byKind.descriptionEdits).toBe(1);
    expect(s.byKind.scoreAdjustments).toBe(1);
    expect(s.byKind.idRenames).toBe(1);
    expect(s.totalEditedRows).toBe(4); // item 1, 2, 3, epic E01
  });

  it('summaryToText produces stable wording', () => {
    const text = summaryToText({
      byKind: {
        statusChanges: 3,
        idRenames: 1,
        epicReassignments: 0,
        scoreAdjustments: 0,
        descriptionEdits: 0,
        other: 0,
      },
      totalEditedRows: 4,
    });
    expect(text).toBe('3 status changes, 1 ID rename');
  });
});
