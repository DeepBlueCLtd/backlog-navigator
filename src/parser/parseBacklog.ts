/**
 * Parser for BACKLOG.md (post-refactor 12-column Items table + 4-column Epics
 * table). Produces a typed BacklogDocument and round-trips byte-for-byte
 * through serializeBacklog (CI-tested).
 *
 * Contract: see specs/242-backlog-navigator/contracts/backlog-md-format.md.
 */

import type {
  BacklogDocument,
  BacklogItem,
  Epic,
  EpicId,
  IsoDate,
  ParseWarning,
  RawRow,
} from '../types';
import {
  asEpicId,
  asItemId,
  asIsoDate,
  asComplexity,
  asScoreCell,
  asStatus,
  asTotal,
} from '../types';

// ─── Strikethrough ─────────────────────────────────────────────────────────

const STRIKETHROUGH_PREFIX = '~~';
const STRIKETHROUGH_SUFFIX = '~~';

export function unwrapStrikethrough(line: string): { stripped: string; struck: boolean } {
  if (line.startsWith(STRIKETHROUGH_PREFIX) && line.endsWith(STRIKETHROUGH_SUFFIX)) {
    return {
      stripped: line.slice(STRIKETHROUGH_PREFIX.length, -STRIKETHROUGH_SUFFIX.length),
      struck: true,
    };
  }
  return { stripped: line, struck: false };
}

// ─── Pipe-aware splitter ───────────────────────────────────────────────────

/**
 * Split a markdown table row into cells, honouring escaped pipes (`\|`).
 * Returns the cells WITHOUT the leading/trailing pipe and WITHOUT the
 * surrounding spaces — but `\|` inside cells is converted to `|`.
 */
export function splitRowCells(row: string): string[] {
  const trimmed = row.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    throw new Error(`splitRowCells: row missing leading/trailing pipe: ${JSON.stringify(row)}`);
  }
  const inner = trimmed.slice(1, -1);
  const cells: string[] = [];
  let buf = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '\\' && inner[i + 1] === '|') {
      buf += '|';
      i++;
      continue;
    }
    if (ch === '|') {
      cells.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  cells.push(buf.trim());
  return cells;
}

// ─── Header detection ─────────────────────────────────────────────────────

const ITEMS_HEADER_COLUMNS = [
  'ID', 'Category', 'Description', 'V', 'M', 'A', 'Total',
  'Complexity', 'Status', 'Epic', 'Created', 'Updated',
];

const EPICS_HEADER_COLUMNS = ['ID', 'Title', 'Description', 'Status'];

function isHeader(row: string, expected: string[]): boolean {
  try {
    const cells = splitRowCells(row);
    if (cells.length !== expected.length) return false;
    return cells.every((c, i) => c === expected[i]);
  } catch {
    return false;
  }
}

function isSeparator(row: string, columnCount: number): boolean {
  try {
    const cells = splitRowCells(row);
    if (cells.length !== columnCount) return false;
    return cells.every((c) => /^:?-+:?$/.test(c));
  } catch {
    return false;
  }
}

// ─── Item-row parsing ──────────────────────────────────────────────────────

function parseItemRow(
  rawLine: string,
  lineNumber: number,
  warnings: ParseWarning[],
): BacklogItem | null {
  const { stripped, struck } = unwrapStrikethrough(rawLine.trim());
  let cells: string[];
  try {
    cells = splitRowCells(stripped);
  } catch (err) {
    warnings.push({
      kind: 'unparsed-row',
      rawLine,
      lineNumber,
      reason: err instanceof Error ? err.message : 'split failed',
    });
    return null;
  }

  if (cells.length !== ITEMS_HEADER_COLUMNS.length) {
    warnings.push({
      kind: 'unparsed-row',
      rawLine,
      lineNumber,
      reason: `expected ${ITEMS_HEADER_COLUMNS.length} columns, got ${cells.length}`,
    });
    return null;
  }

  const [
    idRaw,
    category,
    description,
    valueRaw,
    mediaRaw,
    autonomyRaw,
    totalRaw,
    complexityRaw,
    statusRaw,
    epicRaw,
    createdRaw,
    updatedRaw,
  ] = cells as [
    string, string, string, string, string, string,
    string, string, string, string, string, string,
  ];

  try {
    const id = asItemId(idRaw);
    const idLiteral = idRaw;
    const value = asScoreCell(valueRaw);
    const media = asScoreCell(mediaRaw);
    const autonomy = asScoreCell(autonomyRaw);
    const total = asTotal(totalRaw);
    const complexity = asComplexity(complexityRaw);
    const status = asStatus(statusRaw);
    const epic: EpicId | null = epicRaw === '' ? null : asEpicId(epicRaw);
    const created: IsoDate = asIsoDate(createdRaw);
    const updated: IsoDate = asIsoDate(updatedRaw);

    return {
      id,
      idLiteral,
      category,
      description,
      value,
      media,
      autonomy,
      total,
      complexity,
      status,
      epic,
      created,
      updated,
      strikethrough: struck,
    };
  } catch (err) {
    warnings.push({
      kind: 'malformed-cell',
      rawLine,
      lineNumber,
      reason: err instanceof Error ? err.message : 'cell narrow failed',
    });
    return null;
  }
}

function parseEpicRow(
  rawLine: string,
  lineNumber: number,
  warnings: ParseWarning[],
): Epic | null {
  // Post-refactor: no strikethrough on epic rows.
  let cells: string[];
  try {
    cells = splitRowCells(rawLine.trim());
  } catch (err) {
    warnings.push({
      kind: 'unparsed-row',
      rawLine,
      lineNumber,
      reason: err instanceof Error ? err.message : 'split failed',
    });
    return null;
  }

  if (cells.length !== EPICS_HEADER_COLUMNS.length) {
    warnings.push({
      kind: 'unparsed-row',
      rawLine,
      lineNumber,
      reason: `expected ${EPICS_HEADER_COLUMNS.length} epic columns, got ${cells.length}`,
    });
    return null;
  }

  const [idRaw, title, description, statusRaw] = cells as [
    string, string, string, string,
  ];

  try {
    const id = asEpicId(idRaw);
    const status = asStatus(statusRaw);
    return { id, title, description, status };
  } catch (err) {
    warnings.push({
      kind: 'malformed-cell',
      rawLine,
      lineNumber,
      reason: err instanceof Error ? err.message : 'epic narrow failed',
    });
    return null;
  }
}

// ─── Main entrypoint ───────────────────────────────────────────────────────

export function parseBacklog(text: string): BacklogDocument {
  // Preserve EOF newline. Split such that re-joining with '\n' reconstructs
  // the input minus the trailing newline; we track that separately.
  const trailingNewline = text.endsWith('\n') ? '\n' : '';
  const body = trailingNewline === '\n' ? text.slice(0, -1) : text;
  const lines = body.split('\n');

  const warnings: ParseWarning[] = [];

  // Find Epics header
  let epicsHeaderIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isHeader(lines[i] as string, EPICS_HEADER_COLUMNS)) {
      epicsHeaderIdx = i;
      break;
    }
  }
  if (epicsHeaderIdx === -1) {
    throw new Error('parseBacklog: Epics header row not found');
  }
  const epicsSeparatorIdx = epicsHeaderIdx + 1;
  if (!isSeparator(lines[epicsSeparatorIdx] as string, EPICS_HEADER_COLUMNS.length)) {
    throw new Error('parseBacklog: Epics separator row not found at expected position');
  }

  // Find end of Epics body
  let epicsEndIdx = epicsSeparatorIdx + 1;
  while (epicsEndIdx < lines.length && (lines[epicsEndIdx] as string).trim().startsWith('|')) {
    epicsEndIdx++;
  }
  // epicsEndIdx is now the first non-table line after epics

  // Find Items header (must appear after epicsEndIdx)
  let itemsHeaderIdx = -1;
  for (let i = epicsEndIdx; i < lines.length; i++) {
    if (isHeader(lines[i] as string, ITEMS_HEADER_COLUMNS)) {
      itemsHeaderIdx = i;
      break;
    }
  }
  if (itemsHeaderIdx === -1) {
    throw new Error('parseBacklog: Items header row not found (post-refactor 12-column format)');
  }
  const itemsSeparatorIdx = itemsHeaderIdx + 1;
  if (!isSeparator(lines[itemsSeparatorIdx] as string, ITEMS_HEADER_COLUMNS.length)) {
    throw new Error('parseBacklog: Items separator row not found at expected position');
  }

  let itemsEndIdx = itemsSeparatorIdx + 1;
  while (itemsEndIdx < lines.length) {
    const line = lines[itemsEndIdx] as string;
    const trimmed = line.trim();
    const candidate = unwrapStrikethrough(trimmed).stripped;
    if (!candidate.startsWith('|')) break;
    itemsEndIdx++;
  }

  // Slice opaque sections
  const preamble = lines.slice(0, epicsHeaderIdx).join('\n') + (epicsHeaderIdx > 0 ? '\n' : '');
  const epicsHeader = lines[epicsHeaderIdx] as string;
  const epicsSeparator = lines[epicsSeparatorIdx] as string;
  const epicRowLines = lines.slice(epicsSeparatorIdx + 1, epicsEndIdx);
  const midamble =
    (lines.slice(epicsEndIdx, itemsHeaderIdx).join('\n')) +
    (itemsHeaderIdx > epicsEndIdx ? '\n' : '');
  const itemsHeader = lines[itemsHeaderIdx] as string;
  const itemsSeparator = lines[itemsSeparatorIdx] as string;
  const itemRowLines = lines.slice(itemsSeparatorIdx + 1, itemsEndIdx);
  const postambleLines = lines.slice(itemsEndIdx);
  const postamble = postambleLines.join('\n');

  const epics: Epic[] = [];
  const rawEpicRows: RawRow[] = [];
  for (let i = 0; i < epicRowLines.length; i++) {
    const lineNumber = epicsSeparatorIdx + 2 + i;
    const localWarnings: ParseWarning[] = [];
    const epic = parseEpicRow(epicRowLines[i] as string, lineNumber, localWarnings);
    if (epic) {
      epics.push(epic);
    } else {
      rawEpicRows.push({ index: i, rawLine: epicRowLines[i] as string });
    }
    warnings.push(...localWarnings);
  }

  const items: BacklogItem[] = [];
  const rawItemRows: RawRow[] = [];
  const seenIds = new Set<number>();
  for (let i = 0; i < itemRowLines.length; i++) {
    const lineNumber = itemsSeparatorIdx + 2 + i;
    const localWarnings: ParseWarning[] = [];
    const item = parseItemRow(itemRowLines[i] as string, lineNumber, localWarnings);
    if (item) {
      const idNum = item.id as unknown as number;
      if (seenIds.has(idNum)) {
        warnings.push({
          kind: 'duplicate-id',
          rawLine: itemRowLines[i] as string,
          lineNumber,
          reason: `duplicate item id ${idNum}`,
        });
        rawItemRows.push({ index: i, rawLine: itemRowLines[i] as string });
      } else {
        seenIds.add(idNum);
        items.push(item);
      }
    } else {
      rawItemRows.push({ index: i, rawLine: itemRowLines[i] as string });
      warnings.push(...localWarnings);
    }
  }

  return {
    preamble,
    itemsHeader,
    itemsSeparator,
    items,
    rawItemRows,
    itemRowCount: itemRowLines.length,
    midamble,
    epicsHeader,
    epicsSeparator,
    epics,
    rawEpicRows,
    epicRowCount: epicRowLines.length,
    postamble,
    trailingNewline,
    parseWarnings: warnings,
  };
}
