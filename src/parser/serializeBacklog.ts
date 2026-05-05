/**
 * Serialise a BacklogDocument back to byte-for-byte stable Markdown.
 *
 * Round-trip invariant (CI-tested):
 *   serializeBacklog(parseBacklog(text)) === text
 *
 * Behavioural rules:
 * - Strikethrough wrapping is enforced from `status === 'complete'`. Per-cell
 *   wrapping is used (`| ~~v~~ | ~~v~~ |`) — row-level wrapping
 *   (`~~| v | v |~~`) was rejected because GFM table parsers treat the leading
 *   `~~|` as a first cell `~~` (the leading pipe is optional), shifting every
 *   column right by one and breaking the rendered table.
 * - Empty cells (e.g. an absent Epic) stay empty rather than wrapping `~~~~`.
 * - Pipe characters inside cell values are escaped as `\|`.
 * - `Epic === null` serialises as the empty cell `| |`.
 * - Unparseable rows in `rawItemRows` / `rawEpicRows` are emitted verbatim,
 *   interleaved with typed rows by their original index.
 */

import type { BacklogDocument, BacklogItem, Epic, RawRow } from '../types';
import { ABSENT_SCORE } from '../types';

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function formatScore(value: number | typeof ABSENT_SCORE): string {
  return value === ABSENT_SCORE ? '-' : String(value);
}

function formatItemRow(item: BacklogItem): string {
  const cells = [
    item.idLiteral,
    escapeCell(item.category),
    escapeCell(item.description),
    formatScore(item.value),
    formatScore(item.media),
    formatScore(item.autonomy),
    formatScore(item.total),
    item.complexity,
    item.status,
    item.epic === null ? '' : item.epic,
    item.created,
    item.updated,
  ];
  const rendered =
    item.status === 'complete'
      ? cells.map((c) => (c === '' ? '' : `~~${c}~~`))
      : cells;
  const inner = rendered.map((c) => ` ${c} `).join('|');
  return `|${inner}|`;
}

function formatEpicRow(epic: Epic): string {
  const cells = [
    epic.id,
    escapeCell(epic.title),
    escapeCell(epic.description),
    epic.status,
  ];
  const inner = cells.map((c) => ` ${c} `).join('|');
  return `|${inner}|`;
}

/**
 * Interleave typed rows and raw rows so the serialiser emits them in their
 * original positional order.
 */
function interleave(
  typedRows: string[],
  rawRows: RawRow[],
  totalCount: number,
): string[] {
  const out: string[] = new Array(totalCount);
  // Place raw rows at their original indices.
  const taken = new Set<number>();
  for (const r of rawRows) {
    out[r.index] = r.rawLine;
    taken.add(r.index);
  }
  // Fill remaining slots with typed rows in order.
  let typedIdx = 0;
  for (let i = 0; i < totalCount; i++) {
    if (taken.has(i)) continue;
    out[i] = typedRows[typedIdx++] ?? '';
  }
  return out;
}

export function serializeBacklog(doc: BacklogDocument): string {
  const epicLines = interleave(
    doc.epics.map(formatEpicRow),
    doc.rawEpicRows,
    doc.epicRowCount,
  );
  const itemLines = interleave(
    doc.items.map(formatItemRow),
    doc.rawItemRows,
    doc.itemRowCount,
  );

  const epicsSection = [doc.epicsHeader, doc.epicsSeparator, ...epicLines].join('\n');
  const itemsSection = [doc.itemsHeader, doc.itemsSeparator, ...itemLines].join('\n');

  return (
    doc.preamble +
    epicsSection +
    '\n' +
    doc.midamble +
    itemsSection +
    '\n' +
    doc.postamble +
    doc.trailingNewline
  );
}
