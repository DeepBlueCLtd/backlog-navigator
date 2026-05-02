/**
 * Branded primitive types, enums, and narrowing helpers.
 *
 * Branding ensures function signatures cannot accidentally swap an ItemId for
 * an EpicId, and forces every string crossing into application code through a
 * narrowing helper that throws on malformed input (Article XV — types are
 * canonical at boundaries).
 */

declare const __brand: unique symbol;

export type ItemId = number & { readonly [__brand]: 'ItemId' };
export type EpicId = string & { readonly [__brand]: 'EpicId' };
export type IsoDate = string & { readonly [__brand]: 'IsoDate' };
export type GitRef = string & { readonly [__brand]: 'GitRef' };
export type Sha = string & { readonly [__brand]: 'Sha' };

// ─── Enumerations ────────────────────────────────────────────────────────────

export const STATUS_VALUES = [
  'needs-interview',
  'proposed',
  'approved',
  'specified',
  'clarified',
  'planned',
  'tasked',
  'implementing',
  'complete',
  'blocked',
  'parked',
  'rejected',
] as const;
export type Status = (typeof STATUS_VALUES)[number];

/** Status values surfaced in the navigator's edit dropdown. parked/rejected
 *  are excluded — that workflow convention removes the row from the table. */
export const EDITABLE_STATUS_VALUES = STATUS_VALUES.filter(
  (s) => s !== 'parked' && s !== 'rejected',
);

export const COMPLEXITY_VALUES = ['Low', 'Medium', 'High'] as const;
export type Complexity = (typeof COMPLEXITY_VALUES)[number];

/** The canonical scoring rubric is 1/3/5, but the live BACKLOG.md contains
 *  intermediate scores (2, 4) entered by humans pre-rubric. The parser
 *  accepts any positive integer plus the literal `-` sentinel; the editor
 *  surfaces the canonical {1,3,5,-} options but doesn't reject existing
 *  intermediate values. */
export const SCORE_VALUES = [1, 3, 5] as const;
export type CanonicalScore = (typeof SCORE_VALUES)[number];

export const ABSENT_SCORE = '-' as const;
export type ScoreCell = number | typeof ABSENT_SCORE;

export const COLUMNS = [
  'id',
  'category',
  'description',
  'value',
  'media',
  'autonomy',
  'total',
  'complexity',
  'status',
  'epic',
  'created',
  'updated',
] as const;
export type Column = (typeof COLUMNS)[number];

/** ISO date used as the sentinel when a row's Created date couldn't be
 *  recovered from git history. Visually flagged in the UI. */
export const SENTINEL_CREATED = '2025-01-01';

// ─── Narrowing helpers ──────────────────────────────────────────────────────

const ITEM_ID_RE = /^\d+$/;
export function asItemId(raw: string | number): ItemId {
  const n = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 9999 || !Number.isInteger(n)) {
    throw new Error(`asItemId: invalid item id ${JSON.stringify(raw)}`);
  }
  if (typeof raw === 'string' && !ITEM_ID_RE.test(raw.trim())) {
    throw new Error(`asItemId: non-numeric item id ${JSON.stringify(raw)}`);
  }
  return n as ItemId;
}

const EPIC_ID_RE = /^E\d{2}$/;
export function asEpicId(raw: string): EpicId {
  if (!EPIC_ID_RE.test(raw)) {
    throw new Error(`asEpicId: invalid epic id ${JSON.stringify(raw)}`);
  }
  return raw as EpicId;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function asIsoDate(raw: string): IsoDate {
  if (!ISO_DATE_RE.test(raw)) {
    throw new Error(`asIsoDate: invalid ISO date ${JSON.stringify(raw)}`);
  }
  return raw as IsoDate;
}

const SHA_RE = /^[0-9a-f]{7,40}$/i;
export function asSha(raw: string): Sha {
  if (!SHA_RE.test(raw)) {
    throw new Error(`asSha: invalid sha ${JSON.stringify(raw)}`);
  }
  return raw as Sha;
}

export function asGitRef(raw: string): GitRef {
  if (!raw || raw.length === 0 || /\s/.test(raw)) {
    throw new Error(`asGitRef: invalid ref ${JSON.stringify(raw)}`);
  }
  return raw as GitRef;
}

export function asStatus(raw: string): Status {
  if (!STATUS_VALUES.includes(raw as Status)) {
    throw new Error(`asStatus: unknown status ${JSON.stringify(raw)}`);
  }
  return raw as Status;
}

export function asComplexity(raw: string): Complexity {
  if (!COMPLEXITY_VALUES.includes(raw as Complexity)) {
    throw new Error(`asComplexity: unknown complexity ${JSON.stringify(raw)}`);
  }
  return raw as Complexity;
}

export function asScoreCell(raw: string): ScoreCell {
  if (raw === '-') return ABSENT_SCORE;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && Number.isInteger(n) && n >= 0 && n <= 99) return n;
  throw new Error(`asScoreCell: invalid score ${JSON.stringify(raw)}`);
}

export function asTotal(raw: string): number | typeof ABSENT_SCORE {
  if (raw === '-') return ABSENT_SCORE;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`asTotal: invalid total ${JSON.stringify(raw)}`);
  }
  return n;
}

// ─── Domain entities ────────────────────────────────────────────────────────

export interface BacklogItem {
  id: ItemId;
  /** Literal form of the ID as it appears in BACKLOG.md (e.g. "061"
   *  preserves zero-padding). Regenerated on rename. */
  idLiteral: string;
  category: string;
  description: string;
  value: ScoreCell;
  media: ScoreCell;
  autonomy: ScoreCell;
  total: number | typeof ABSENT_SCORE;
  complexity: Complexity;
  status: Status;
  epic: EpicId | null;
  created: IsoDate;
  updated: IsoDate;
  /** Source-of-truth strikethrough wrapping; derived from status === 'complete'
   *  on serialise, but parsed defensively to handle in-flight migrations. */
  strikethrough: boolean;
}

export interface Epic {
  id: EpicId;
  title: string;
  description: string;
  status: Status;
}

export interface ParseWarning {
  kind: 'unparsed-row' | 'malformed-cell' | 'unknown-status' | 'epic-id-mismatch' | 'duplicate-id';
  rawLine: string;
  lineNumber: number;
  reason: string;
}

/**
 * Indexed raw row (unparsed) preserved for byte-for-byte round-trip.
 * `index` is the absolute position in the original section's row sequence.
 */
export interface RawRow {
  index: number;
  rawLine: string;
}

export interface BacklogDocument {
  preamble: string;
  itemsHeader: string;
  itemsSeparator: string;
  /** Typed item rows (insertion order). */
  items: BacklogItem[];
  /** Unparsed item rows; serialiser interleaves by `index`. */
  rawItemRows: RawRow[];
  /** Total number of rows in the original Items table (typed + raw). */
  itemRowCount: number;
  midamble: string;
  epicsHeader: string;
  epicsSeparator: string;
  epics: Epic[];
  rawEpicRows: RawRow[];
  epicRowCount: number;
  postamble: string;
  trailingNewline: string;
  parseWarnings: ParseWarning[];
}

// ─── Pending edits ──────────────────────────────────────────────────────────

export type CellValue = string | number | typeof ABSENT_SCORE | null;

export type PendingEdit =
  | {
      kind: 'item-cell';
      itemId: ItemId;
      column: Exclude<Column, 'id'>;
      before: CellValue;
      after: CellValue;
      stagedAt: IsoDate;
    }
  | {
      kind: 'item-id-rename';
      oldId: ItemId;
      newId: ItemId;
      stagedAt: IsoDate;
    }
  | {
      kind: 'epic-cell';
      epicId: EpicId;
      column: 'title' | 'description' | 'status';
      before: string;
      after: string;
      stagedAt: IsoDate;
    };

// ─── Push session ───────────────────────────────────────────────────────────

export type PushMode = 'live' | 'pr' | 'dry-run';

export interface EditSummary {
  byKind: {
    statusChanges: number;
    idRenames: number;
    epicReassignments: number;
    scoreAdjustments: number;
    descriptionEdits: number;
    other: number;
  };
  totalEditedRows: number;
}

export interface PushSession {
  mode: PushMode;
  targetRef: GitRef;
  baselineSha: Sha;
  prTitle: string;
  prBody: string;
  edits: PendingEdit[];
  summary: EditSummary;
  unifiedDiff: string;
}

// ─── Persistence envelopes ──────────────────────────────────────────────────

export interface PendingEditsEnvelopeV1 {
  schemaVersion: 1;
  baselineSha: Sha;
  targetRef: GitRef;
  mode: 'live' | 'pr';
  prNumber: number | null;
  edits: PendingEdit[];
  lastModified: IsoDate;
}

export interface CredentialEnvelope {
  pat: string;
  scopes: string[];
  login?: string;
}
