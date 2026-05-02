/**
 * Pending-edit operations: apply edits to a baseline document, validate
 * collisions, undo, and rewrite IDs across edits when a rename lands.
 */

import type {
  BacklogDocument,
  BacklogItem,
  CellValue,
  Column,
  ItemId,
  PendingEdit,
} from '../types';

export function applyPendingEdits(
  baseline: BacklogDocument,
  edits: PendingEdit[],
): BacklogDocument {
  // Build a map keyed by current id (after preceding renames) so we can mutate
  // without losing ordering.
  const items = baseline.items.map((it) => ({ ...it }));
  const epics = baseline.epics.map((e) => ({ ...e }));

  for (const edit of edits) {
    if (edit.kind === 'item-cell') {
      const idx = items.findIndex((it) => it.id === edit.itemId);
      if (idx === -1) continue;
      items[idx] = applyCellEdit(items[idx] as BacklogItem, edit.column, edit.after);
      items[idx] = { ...(items[idx] as BacklogItem), updated: edit.stagedAt };
    } else if (edit.kind === 'item-id-rename') {
      const idx = items.findIndex((it) => it.id === edit.oldId);
      if (idx === -1) continue;
      const newLiteral = String(edit.newId as unknown as number).padStart(3, '0');
      items[idx] = {
        ...(items[idx] as BacklogItem),
        id: edit.newId,
        idLiteral: newLiteral,
        updated: edit.stagedAt,
      };
    } else if (edit.kind === 'epic-cell') {
      const idx = epics.findIndex((e) => e.id === edit.epicId);
      if (idx === -1) continue;
      const epic = epics[idx];
      if (!epic) continue;
      if (edit.column === 'title') epics[idx] = { ...epic, title: edit.after };
      else if (edit.column === 'description') epics[idx] = { ...epic, description: edit.after };
      else if (edit.column === 'status') {
        // Status is constrained; the editor will only emit valid values.
        epics[idx] = { ...epic, status: edit.after as typeof epic.status };
      }
    }
  }

  return { ...baseline, items, epics };
}

function applyCellEdit(
  item: BacklogItem,
  column: Exclude<Column, 'id'>,
  value: CellValue,
): BacklogItem {
  switch (column) {
    case 'category':
      return { ...item, category: stringValue(value) };
    case 'description':
      return { ...item, description: stringValue(value) };
    case 'value':
      return { ...item, value: scoreValue(value) };
    case 'media':
      return { ...item, media: scoreValue(value) };
    case 'autonomy':
      return { ...item, autonomy: scoreValue(value) };
    case 'total':
      return { ...item, total: numericValue(value) };
    case 'complexity':
      return { ...item, complexity: stringValue(value) as BacklogItem['complexity'] };
    case 'status':
      return { ...item, status: stringValue(value) as BacklogItem['status'] };
    case 'epic':
      return {
        ...item,
        epic: value === null || value === '' ? null : (stringValue(value) as BacklogItem['epic']),
      };
    case 'created':
      return { ...item, created: stringValue(value) as BacklogItem['created'] };
    case 'updated':
      return { ...item, updated: stringValue(value) as BacklogItem['updated'] };
    default: {
      const exhaustive: never = column;
      throw new Error(`applyCellEdit: unknown column ${exhaustive as string}`);
    }
  }
}

function stringValue(value: CellValue): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  return value;
}

function numericValue(value: CellValue): number | '-' {
  if (value === '-' || value === null) return '-';
  if (typeof value === 'number') return value;
  if (value === '') return '-';
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return '-';
  return n;
}

function scoreValue(value: CellValue): BacklogItem['value'] {
  if (value === null || value === '' || value === '-') return '-';
  if (value === 1 || value === 3 || value === 5) return value;
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    if (n === 1 || n === 3 || n === 5) return n;
  }
  return '-';
}

// ─── Collision detection ──────────────────────────────────────────────────

export interface CollisionReport {
  hasCollision: boolean;
  duplicateIds: ItemId[];
}

export function detectCollisions(doc: BacklogDocument): CollisionReport {
  const counts = new Map<ItemId, number>();
  for (const it of doc.items) {
    counts.set(it.id, (counts.get(it.id) ?? 0) + 1);
  }
  const duplicates: ItemId[] = [];
  for (const [id, n] of counts) {
    if (n > 1) duplicates.push(id);
  }
  return { hasCollision: duplicates.length > 0, duplicateIds: duplicates };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function rewriteIdsAcrossEdits(
  edits: PendingEdit[],
  oldId: ItemId,
  newId: ItemId,
): PendingEdit[] {
  return edits.map((edit) => {
    if (edit.kind === 'item-cell' && edit.itemId === oldId) {
      return { ...edit, itemId: newId };
    }
    return edit;
  });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
