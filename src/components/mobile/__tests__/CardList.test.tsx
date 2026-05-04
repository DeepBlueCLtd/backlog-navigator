import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { CardList } from '../CardList';
import { EditorOverlayProvider } from '../../../editors/EditorOverlayProvider';
import {
  StoreProvider,
  defaultView,
  selectFilteredSortedItems,
  type StoreApi,
  type ViewState,
} from '../../../state/store';
import {
  type BacklogDocument,
  type BacklogItem,
  type EpicId,
  type ItemId,
  type IsoDate,
} from '../../../types';

function makeDoc(items: BacklogItem[]): BacklogDocument {
  return {
    preamble: '',
    itemsHeader: '',
    itemsSeparator: '',
    items,
    rawItemRows: [],
    itemRowCount: items.length,
    midamble: '',
    epicsHeader: '',
    epicsSeparator: '',
    epics: [],
    rawEpicRows: [],
    epicRowCount: 0,
    postamble: '',
    trailingNewline: '\n',
    parseWarnings: [],
  };
}

function item(id: number, status: BacklogItem['status'], updated: string): BacklogItem {
  return {
    id: id as unknown as ItemId,
    idLiteral: String(id).padStart(3, '0'),
    category: 'Feature',
    description: `Item ${id}`,
    value: 3,
    media: 3,
    autonomy: 3,
    total: 9,
    complexity: 'Medium',
    status,
    epic: 'E01' as unknown as EpicId,
    created: '2026-05-01' as IsoDate,
    updated: updated as IsoDate,
    strikethrough: status === 'complete',
  };
}

function makeStoreApi(view: ViewState): StoreApi {
  return {
    state: { status: 'loading' },
    setState: () => undefined,
    edits: [],
    setEdits: () => undefined,
    view,
    setView: () => undefined,
    projected: null,
    stageEdit: () => undefined,
    undoEdit: () => undefined,
    clearStaging: () => undefined,
    persistenceWarning: null,
  };
}

/**
 * Verifies the selector behaviour directly — `selectFilteredSortedItems`
 * is the single source of truth for which rows the CardList renders.
 *
 * Virtualised rendering is exercised in the mobile Playwright suite
 * (`e2e/mobile/browse.mobile.spec.ts`); jsdom does not run layout, so
 * `useVirtualizer` cannot accurately decide which rows are in-view here.
 */
describe('CardList selector — phase / includeCompleted / freeText / sort', () => {
  it('default view (phase=any, includeCompleted=false) hides complete rows', () => {
    const doc = makeDoc([
      item(244, 'implementing', '2026-05-03'),
      item(243, 'approved', '2026-05-02'),
      item(241, 'complete', '2026-05-02'),
    ]);
    const result = selectFilteredSortedItems(doc, defaultView());
    const ids = result.map((r) => r.id as unknown as number);
    expect(ids).toEqual([244, 243]);
  });

  it('shows complete rows when includeCompleted=true', () => {
    const doc = makeDoc([
      item(244, 'implementing', '2026-05-03'),
      item(241, 'complete', '2026-05-02'),
    ]);
    const result = selectFilteredSortedItems(doc, {
      ...defaultView(),
      includeCompleted: true,
    });
    expect(result.map((r) => r.id as unknown as number)).toEqual([244, 241]);
  });

  it('phase=done forces include-completed and excludes other statuses', () => {
    const doc = makeDoc([
      item(244, 'implementing', '2026-05-03'),
      item(241, 'complete', '2026-05-02'),
    ]);
    const result = selectFilteredSortedItems(doc, {
      ...defaultView(),
      phase: 'done',
    });
    expect(result.map((r) => r.id as unknown as number)).toEqual([241]);
  });

  it('phase=triage shows only proposed/needs-interview rows', () => {
    const doc = makeDoc([
      item(244, 'implementing', '2026-05-03'),
      item(243, 'approved', '2026-05-02'),
      item(242, 'proposed', '2026-05-02'),
      item(241, 'needs-interview', '2026-05-02'),
    ]);
    const result = selectFilteredSortedItems(doc, {
      ...defaultView(),
      phase: 'triage',
    });
    expect(result.map((r) => r.id as unknown as number).sort()).toEqual([241, 242]);
  });

  it('phase=active includes implementing + blocked', () => {
    const doc = makeDoc([
      item(244, 'implementing', '2026-05-03'),
      item(243, 'blocked', '2026-05-02'),
      item(242, 'approved', '2026-05-02'),
    ]);
    const result = selectFilteredSortedItems(doc, {
      ...defaultView(),
      phase: 'active',
    });
    expect(result.map((r) => r.id as unknown as number).sort()).toEqual([243, 244]);
  });

  it('free-text search filters by ID + description', () => {
    const doc = makeDoc([
      item(244, 'implementing', '2026-05-03'),
      item(243, 'approved', '2026-05-02'),
    ]);
    const result = selectFilteredSortedItems(doc, {
      ...defaultView(),
      freeText: '244',
    });
    expect(result.map((r) => r.id as unknown as number)).toEqual([244]);
  });

  it('default sort is updated descending (FR-013)', () => {
    const doc = makeDoc([
      item(241, 'implementing', '2026-05-01'),
      item(244, 'implementing', '2026-05-03'),
      item(242, 'implementing', '2026-05-02'),
    ]);
    const result = selectFilteredSortedItems(doc, defaultView());
    expect(result.map((r) => r.id as unknown as number)).toEqual([244, 242, 241]);
  });

  it('explicit status=complete filter overrides the include-completed default', () => {
    const doc = makeDoc([
      item(244, 'implementing', '2026-05-03'),
      item(241, 'complete', '2026-05-02'),
    ]);
    const result = selectFilteredSortedItems(doc, {
      ...defaultView(),
      filters: { status: 'complete', category: null, epic: null, complexity: null },
    });
    expect(result.map((r) => r.id as unknown as number)).toEqual([241]);
  });
});

/**
 * Renders the empty-filter state when nothing matches. The empty path
 * does not depend on the virtualiser, so it can be asserted in jsdom.
 */
describe('CardList — empty filter state', () => {
  function renderList(doc: BacklogDocument, view: ViewState): void {
    const api = makeStoreApi(view);
    render(
      <StoreProvider value={api}>
        <EditorOverlayProvider>
          <CardList doc={doc} />
        </EditorOverlayProvider>
      </StoreProvider>,
    );
  }

  it('renders the empty-filter state with a Reset link when nothing matches', () => {
    const doc = makeDoc([item(244, 'implementing', '2026-05-03')]);
    renderList(doc, { ...defaultView(), freeText: 'zzz-no-match' });
    expect(screen.getByTestId('card-list-empty')).toBeTruthy();
    const reset = screen.getByText('Reset filter');
    expect(reset).toBeTruthy();
    fireEvent.click(reset);
  });
});
