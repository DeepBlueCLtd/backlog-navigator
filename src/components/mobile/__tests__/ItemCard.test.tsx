import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ItemCard } from '../ItemCard';
import { EditorOverlayProvider } from '../../../editors/EditorOverlayProvider';
import { StoreProvider, type StoreApi } from '../../../state/store';
import {
  type BacklogItem,
  type EpicId,
  type ItemId,
  type IsoDate,
} from '../../../types';

function makeItem(overrides: Partial<BacklogItem> = {}): BacklogItem {
  return {
    id: 244 as unknown as ItemId,
    idLiteral: '244',
    category: 'Feature',
    description: 'Backlog Navigator — full mobile parity (PWA).',
    value: 4,
    media: 3,
    autonomy: 3,
    total: 10,
    complexity: 'Medium',
    status: 'implementing',
    epic: 'E03' as unknown as EpicId,
    created: '2026-05-02' as IsoDate,
    updated: '2026-05-03' as IsoDate,
    strikethrough: false,
    ...overrides,
  };
}

function makeStoreApi(): StoreApi {
  return {
    state: { status: 'loading' },
    setState: () => undefined,
    edits: [],
    setEdits: () => undefined,
    view: {} as StoreApi['view'],
    setView: () => undefined,
    projected: null,
    stageEdit: () => undefined,
    undoEdit: () => undefined,
    clearStaging: () => undefined,
    persistenceWarning: null,
  };
}

function renderCard(item: BacklogItem, dirty = false): { container: ReactNode } {
  const api = makeStoreApi();
  return render(
    <StoreProvider value={api}>
      <EditorOverlayProvider>
        <ItemCard item={item} dirty={dirty} />
      </EditorOverlayProvider>
    </StoreProvider>,
  );
}

describe('ItemCard', () => {
  it('renders ID, Category, Score, Status, Epic, Updated', () => {
    renderCard(makeItem());
    const card = screen.getByTestId('item-card-244');
    const utils = within(card);
    expect(utils.getByText('#244')).toBeTruthy();
    expect(utils.getByTestId('category-chip').textContent).toBe('Feature');
    // Score chip text may be split across spans
    const score = utils.getByTestId('score-chip');
    expect(score.textContent).toContain('10');
    expect(score.textContent).toContain('4·3·3');
    expect(utils.getByTestId('status-chip').textContent).toContain('implementing');
    expect(utils.getByTestId('epic-chip').textContent).toBe('E03');
    expect(card.textContent).toContain('updated 2026-05-03');
  });

  it('renders with strikethrough when status is complete (FR-004)', () => {
    renderCard(makeItem({ status: 'complete' }));
    const card = screen.getByTestId('item-card-244');
    expect(card.getAttribute('data-strikethrough')).toBe('true');
    // The ID should be wrapped in <s>; the description summary too.
    expect(card.querySelector('s')).not.toBeNull();
  });

  it('does NOT render strikethrough for non-complete statuses', () => {
    renderCard(makeItem({ status: 'implementing' }));
    const card = screen.getByTestId('item-card-244');
    expect(card.getAttribute('data-strikethrough')).toBeNull();
  });

  it('shows the dirty marker when dirty=true', () => {
    renderCard(makeItem(), true);
    const card = screen.getByTestId('item-card-244');
    expect(card.getAttribute('data-dirty')).toBe('true');
    expect(card.querySelector('.item-card-dirty')).not.toBeNull();
  });

  it('renders absent score values as "-"', () => {
    renderCard(makeItem({ value: '-', media: '-', autonomy: '-', total: '-' }));
    const card = screen.getByTestId('item-card-244');
    const score = card.querySelector('[data-testid="score-chip"]');
    expect(score?.textContent).toContain('-');
    expect(score?.textContent).toContain('-·-·-');
  });

  it('renders epic as "—" when null', () => {
    renderCard(makeItem({ epic: null }));
    expect(screen.getByTestId('epic-chip').textContent).toBe('—');
  });

  it('truncates a very long description on the card surface', () => {
    const long = 'X'.repeat(500);
    renderCard(makeItem({ description: long }));
    const desc = screen.getByTestId('item-card-description');
    // Should end with ellipsis and be ~200+1 chars (200 + "…").
    expect(desc.textContent?.length).toBeLessThan(250);
    expect(desc.textContent?.endsWith('…')).toBe(true);
  });

  it('renders the copy-speckit-command button with status-sensitive command', () => {
    renderCard(makeItem({ status: 'implementing' }));
    const btn = screen.getByTestId('copy-speckit-command');
    expect(btn.getAttribute('data-command')).toBe('/speckit.implement 244');
  });

  it('copy button maps approved → /speckit.specify <id>', () => {
    renderCard(makeItem({ status: 'approved' }));
    const btn = screen.getByTestId('copy-speckit-command');
    expect(btn.getAttribute('data-command')).toBe('/speckit.specify 244');
  });

  it('copy button maps proposed → /speckit.start <id>', () => {
    renderCard(makeItem({ status: 'proposed' }));
    const btn = screen.getByTestId('copy-speckit-command');
    expect(btn.getAttribute('data-command')).toBe('/speckit.start 244');
  });

  it('copy button is hidden for terminal statuses', () => {
    renderCard(makeItem({ status: 'complete' }));
    expect(screen.queryByTestId('copy-speckit-command')).toBeNull();
  });
});
