/**
 * React-context store. Holds the loaded baseline BacklogDocument, the array
 * of pending edits, and view state (sort/filter/group). All edits are
 * persisted to localStorage on change so reload preserves staging.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Dispatch, SetStateAction } from 'react';

import type {
  BacklogDocument,
  Column,
  EpicId,
  ItemId,
  IsoDate,
  PendingEdit,
  PendingEditsEnvelopeV1,
  Sha,
  GitRef,
} from '../types';
import { applyPendingEdits, todayIso, rewriteIdsAcrossEdits } from './pendingEdits';
import { readEnvelope, writeEnvelope, clearEnvelope } from './persistence';

// ─── View state ──────────────────────────────────────────────────────────

export type SortKey = 'id' | 'total' | 'updated' | 'created';
export type SortAxis = 'asc' | 'desc';

export interface StructuredFilters {
  status: string | null;
  category: string | null;
  epic: string | null;
  complexity: string | null;
}

export interface ViewState {
  sortKey: SortKey;
  sortDir: SortAxis;
  filters: StructuredFilters;
  freeText: string;
  groupByEpic: boolean;
  expandAllDescriptions: boolean;
  expandedRows: Set<ItemId>;
}

export const defaultView = (): ViewState => ({
  sortKey: 'id',
  sortDir: 'desc',
  filters: { status: null, category: null, epic: null, complexity: null },
  freeText: '',
  groupByEpic: false,
  expandAllDescriptions: false,
  expandedRows: new Set(),
});

// ─── Store shape ─────────────────────────────────────────────────────────

export interface StoreLoaded {
  status: 'loaded';
  baseline: BacklogDocument;
  baselineText: string;
  baselineSha: Sha;
  targetRef: GitRef;
  mode: 'live' | 'pr';
  prNumber: number | null;
}

export type StoreState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | StoreLoaded;

export interface StoreApi {
  state: StoreState;
  setState: Dispatch<SetStateAction<StoreState>>;
  edits: PendingEdit[];
  setEdits: (edits: PendingEdit[] | ((prev: PendingEdit[]) => PendingEdit[])) => void;
  view: ViewState;
  setView: Dispatch<SetStateAction<ViewState>>;
  /** Document with pending edits projected over the baseline. */
  projected: BacklogDocument | null;
  /** Convenience for editors. */
  stageEdit: (edit: PendingEdit) => void;
  undoEdit: (index: number) => void;
  clearStaging: () => void;
  /** Persisted-payload warning (e.g. >1MB). */
  persistenceWarning: string | null;
}

const StoreContext = createContext<StoreApi | null>(null);

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}

export const StoreProvider = StoreContext.Provider;

// ─── Hook factory ────────────────────────────────────────────────────────

export function useStoreState(): StoreApi {
  const [state, setState] = useState<StoreState>({ status: 'loading' });
  const [edits, setEditsRaw] = useState<PendingEdit[]>([]);
  const [view, setView] = useState<ViewState>(defaultView());
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);

  // Restore staging from localStorage on first load
  useEffect(() => {
    const env = readEnvelope();
    if (env) setEditsRaw(env.edits);
  }, []);

  // Persist staging on every change once loaded
  useEffect(() => {
    if (state.status !== 'loaded') return;
    if (edits.length === 0) {
      clearEnvelope();
      setPersistenceWarning(null);
      return;
    }
    const envelope: PendingEditsEnvelopeV1 = {
      schemaVersion: 1,
      baselineSha: state.baselineSha,
      targetRef: state.targetRef,
      mode: state.mode,
      prNumber: state.prNumber,
      edits,
      lastModified: todayIso() as IsoDate,
    };
    try {
      const { warning } = writeEnvelope(envelope);
      setPersistenceWarning(warning ?? null);
    } catch (err) {
      setPersistenceWarning((err as Error).message);
    }
  }, [edits, state]);

  const setEdits = useCallback(
    (next: PendingEdit[] | ((prev: PendingEdit[]) => PendingEdit[])) => {
      setEditsRaw((prev) => (typeof next === 'function' ? next(prev) : next));
    },
    [],
  );

  const stageEdit = useCallback((edit: PendingEdit) => {
    setEditsRaw((prev) => {
      // If this is an ID rename, rewrite all later edits that reference the old id.
      if (edit.kind === 'item-id-rename') {
        const rewritten = rewriteIdsAcrossEdits(prev, edit.oldId, edit.newId);
        return [...rewritten, edit];
      }
      return [...prev, edit];
    });
  }, []);

  const undoEdit = useCallback((index: number) => {
    setEditsRaw((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearStaging = useCallback(() => {
    setEditsRaw([]);
    clearEnvelope();
  }, []);

  const projected = useMemo(() => {
    if (state.status !== 'loaded') return null;
    return applyPendingEdits(state.baseline, edits);
  }, [state, edits]);

  return {
    state,
    setState,
    edits,
    setEdits,
    view,
    setView,
    projected,
    stageEdit,
    undoEdit,
    clearStaging,
    persistenceWarning,
  };
}

// ─── Selectors ───────────────────────────────────────────────────────────

export interface FilteredItem {
  itemIdx: number;
}

export function selectFilteredSortedItems(
  doc: BacklogDocument,
  view: ViewState,
): BacklogDocument['items'] {
  const filtered = doc.items.filter((it) => {
    if (view.filters.status && it.status !== view.filters.status) return false;
    if (view.filters.category && it.category !== view.filters.category) return false;
    if (view.filters.complexity && it.complexity !== view.filters.complexity) return false;
    if (view.filters.epic) {
      const want = view.filters.epic;
      if (want === '__none__') {
        if (it.epic !== null) return false;
      } else if (it.epic !== want) {
        return false;
      }
    }
    if (view.freeText.trim().length > 0) {
      const haystack =
        `${it.id} ${it.category} ${it.description} ${it.status} ${it.complexity} ${it.epic ?? ''}`.toLowerCase();
      if (!haystack.includes(view.freeText.toLowerCase())) return false;
    }
    return true;
  });

  const dir = view.sortDir === 'asc' ? 1 : -1;
  const cmp = (a: BacklogDocument['items'][number], b: BacklogDocument['items'][number]): number => {
    let x: number | string;
    let y: number | string;
    switch (view.sortKey) {
      case 'id':
        x = a.id;
        y = b.id;
        break;
      case 'total':
        x = a.total === '-' ? -Infinity : a.total;
        y = b.total === '-' ? -Infinity : b.total;
        break;
      case 'updated':
        x = a.updated;
        y = b.updated;
        break;
      case 'created':
        x = a.created;
        y = b.created;
        break;
    }
    if (x < y) return -1 * dir;
    if (x > y) return 1 * dir;
    return 0;
  };
  return [...filtered].sort(cmp);
}

export interface EpicProgress {
  epicId: EpicId | null;
  totalItems: number;
  completeItems: number;
  fraction: number;
}

export function selectEpicProgress(doc: BacklogDocument): Map<EpicId | null, EpicProgress> {
  const map = new Map<EpicId | null, EpicProgress>();
  const seed = (id: EpicId | null): EpicProgress => ({
    epicId: id,
    totalItems: 0,
    completeItems: 0,
    fraction: 0,
  });
  for (const e of doc.epics) map.set(e.id, seed(e.id));
  map.set(null, seed(null));
  for (const it of doc.items) {
    const k = it.epic;
    const cur = map.get(k) ?? seed(k);
    cur.totalItems++;
    if (it.status === 'complete') cur.completeItems++;
    cur.fraction = cur.totalItems === 0 ? 0 : cur.completeItems / cur.totalItems;
    map.set(k, cur);
  }
  return map;
}

export type CellKey = `item:${number}:${Column}` | `epic:${string}:title|description|status`;

export function findEditForCell(
  edits: PendingEdit[],
  itemId: ItemId,
  column: Column,
): { edit: PendingEdit; index: number } | null {
  for (let i = edits.length - 1; i >= 0; i--) {
    const e = edits[i];
    if (!e) continue;
    if (e.kind === 'item-cell' && e.itemId === itemId && e.column === column) {
      return { edit: e, index: i };
    }
    if (e.kind === 'item-id-rename' && column === 'id' && e.newId === itemId) {
      return { edit: e, index: i };
    }
  }
  return null;
}
