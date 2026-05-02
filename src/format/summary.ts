/**
 * Walk PendingEdit[] and produce a structured EditSummary.
 */

import type { EditSummary, PendingEdit } from '../types';

export function summarise(edits: PendingEdit[]): EditSummary {
  const byKind = {
    statusChanges: 0,
    idRenames: 0,
    epicReassignments: 0,
    scoreAdjustments: 0,
    descriptionEdits: 0,
    other: 0,
  };
  const touchedRows = new Set<string>();

  for (const edit of edits) {
    if (edit.kind === 'item-cell') {
      touchedRows.add(`item:${edit.itemId}`);
      switch (edit.column) {
        case 'status':
          byKind.statusChanges++;
          break;
        case 'epic':
          byKind.epicReassignments++;
          break;
        case 'value':
        case 'media':
        case 'autonomy':
        case 'total':
          byKind.scoreAdjustments++;
          break;
        case 'description':
          byKind.descriptionEdits++;
          break;
        default:
          byKind.other++;
      }
    } else if (edit.kind === 'item-id-rename') {
      touchedRows.add(`item:${edit.oldId}`);
      byKind.idRenames++;
    } else if (edit.kind === 'epic-cell') {
      touchedRows.add(`epic:${edit.epicId}`);
      if (edit.column === 'status') byKind.statusChanges++;
      else byKind.other++;
    }
  }

  return { byKind, totalEditedRows: touchedRows.size };
}

export function summaryToText(summary: EditSummary): string {
  const parts: string[] = [];
  const k = summary.byKind;
  if (k.statusChanges) parts.push(`${k.statusChanges} status change${k.statusChanges === 1 ? '' : 's'}`);
  if (k.idRenames) parts.push(`${k.idRenames} ID rename${k.idRenames === 1 ? '' : 's'}`);
  if (k.epicReassignments) parts.push(`${k.epicReassignments} epic reassignment${k.epicReassignments === 1 ? '' : 's'}`);
  if (k.scoreAdjustments) parts.push(`${k.scoreAdjustments} score adjustment${k.scoreAdjustments === 1 ? '' : 's'}`);
  if (k.descriptionEdits) parts.push(`${k.descriptionEdits} description edit${k.descriptionEdits === 1 ? '' : 's'}`);
  if (k.other) parts.push(`${k.other} other`);
  if (parts.length === 0) return '0 edits';
  return parts.join(', ');
}
