import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { StickyPushBar } from '../StickyPushBar';
import { StoreProvider, type StoreApi } from '../../../state/store';
import {
  type IsoDate,
  type ItemId,
  type PendingEdit,
} from '../../../types';

function makeStoreApi(edits: PendingEdit[], clearStaging: () => void = () => undefined): StoreApi {
  return {
    state: { status: 'loading' },
    setState: () => undefined,
    edits,
    setEdits: () => undefined,
    view: {} as StoreApi['view'],
    setView: () => undefined,
    projected: null,
    stageEdit: () => undefined,
    undoEdit: () => undefined,
    clearStaging,
    persistenceWarning: null,
  };
}

const stagedAt = '2026-05-04' as IsoDate;
const itemId = (n: number): ItemId => n as unknown as ItemId;
const sampleEdit: PendingEdit = {
  kind: 'item-cell',
  itemId: itemId(244),
  column: 'status',
  before: 'proposed',
  after: 'approved',
  stagedAt,
};

describe('StickyPushBar', () => {
  it('returns null when there are no dirty edits (FR-010)', () => {
    const api = makeStoreApi([]);
    const { container } = render(
      <StoreProvider value={api}>
        <StickyPushBar onPushChanges={() => undefined} />
      </StoreProvider>,
    );
    expect(container.querySelector('[data-testid=sticky-push-bar]')).toBeNull();
  });

  it('renders the bar with singular dirty count', () => {
    const api = makeStoreApi([sampleEdit]);
    render(
      <StoreProvider value={api}>
        <StickyPushBar onPushChanges={() => undefined} />
      </StoreProvider>,
    );
    expect(screen.getByTestId('sticky-push-bar-count').textContent).toBe('1 unsynced edit');
  });

  it('renders the bar with plural dirty count', () => {
    const api = makeStoreApi([sampleEdit, { ...sampleEdit, itemId: itemId(243) }]);
    render(
      <StoreProvider value={api}>
        <StickyPushBar onPushChanges={() => undefined} />
      </StoreProvider>,
    );
    expect(screen.getByTestId('sticky-push-bar-count').textContent).toBe('2 unsynced edits');
  });

  it('Push button calls onPushChanges (same callback as desktop PendingFooter)', () => {
    const api = makeStoreApi([sampleEdit]);
    const onPush = vi.fn();
    render(
      <StoreProvider value={api}>
        <StickyPushBar onPushChanges={onPush} />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByTestId('push-button'));
    expect(onPush).toHaveBeenCalled();
  });

  it('discard button calls clearStaging when confirmed', () => {
    const clearStaging = vi.fn();
    const api = makeStoreApi([sampleEdit], clearStaging);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <StoreProvider value={api}>
        <StickyPushBar onPushChanges={() => undefined} />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByTestId('discard-button'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(clearStaging).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('discard button is a no-op when the user cancels the confirm', () => {
    const clearStaging = vi.fn();
    const api = makeStoreApi([sampleEdit], clearStaging);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <StoreProvider value={api}>
        <StickyPushBar onPushChanges={() => undefined} />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByTestId('discard-button'));
    expect(clearStaging).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('exposes data-state for variant styling (idle | conflict | success)', () => {
    const api = makeStoreApi([sampleEdit]);
    render(
      <StoreProvider value={api}>
        <StickyPushBar onPushChanges={() => undefined} variant="conflict" />
      </StoreProvider>,
    );
    expect(screen.getByTestId('sticky-push-bar').getAttribute('data-state')).toBe('conflict');
  });
});
