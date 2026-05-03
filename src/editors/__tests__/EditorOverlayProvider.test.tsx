import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useEffect, useState, type ReactNode } from 'react';

import { EditorOverlayProvider } from '../EditorOverlayProvider';
import { useEditorOverlay } from '../EditorOverlayContext';
import { StoreProvider, type StoreApi } from '../../state/store';
import type { BacklogDocument, ItemId, PendingEdit } from '../../types';

/**
 * Build a minimal StoreApi stub that captures `stageEdit` calls.
 * The provider only consumes `stageEdit`; everything else is irrelevant
 * to its tests.
 */
function makeStoreApi(): { api: StoreApi; staged: PendingEdit[] } {
  const staged: PendingEdit[] = [];
  const api: StoreApi = {
    state: { status: 'loading' },
    setState: () => undefined,
    edits: [],
    setEdits: () => undefined,
    view: {} as StoreApi['view'],
    setView: () => undefined,
    projected: null as BacklogDocument | null,
    stageEdit: (edit) => {
      staged.push(edit);
    },
    undoEdit: () => undefined,
    clearStaging: () => undefined,
    persistenceWarning: null,
  };
  return { api, staged };
}

interface HarnessProps {
  children?: ReactNode;
  initialIsMobile: boolean;
  staged: PendingEdit[];
  api: StoreApi;
  /** Exposed handle so tests can flip the mode mid-test. */
  setMode?: (cb: (next: boolean) => void) => void;
}

function Harness({ children, initialIsMobile, api, setMode }: HarnessProps): JSX.Element {
  const [isMobile, setIsMobile] = useState<boolean>(initialIsMobile);
  useEffect(() => {
    setMode?.((next) => setIsMobile(next));
  }, [setMode]);

  return (
    <StoreProvider value={api}>
      <EditorOverlayProvider isMobileOverride={isMobile}>{children}</EditorOverlayProvider>
    </StoreProvider>
  );
}

function ProbeBottomSheet({ initialValue = 'proposed' }: { initialValue?: string }): JSX.Element {
  const overlay = useEditorOverlay();
  return (
    <div>
      <button
        type="button"
        data-testid="probe-open"
        onClick={() =>
          overlay.openBottomSheet({
            itemId: 1 as unknown as ItemId,
            editorKind: 'status',
            initialValue,
          })
        }
      >
        Open
      </button>
      <button
        type="button"
        data-testid="probe-set-clean"
        onClick={() => overlay.setBottomSheetValue(initialValue)}
      >
        Set-clean
      </button>
      <button
        type="button"
        data-testid="probe-set-dirty"
        onClick={() => overlay.setBottomSheetValue('approved')}
      >
        Set-dirty
      </button>
      <button
        type="button"
        data-testid="probe-save"
        onClick={() => overlay.saveBottomSheet()}
      >
        Save
      </button>
      <button
        type="button"
        data-testid="probe-request-close"
        onClick={() => overlay.requestCloseBottomSheet()}
      >
        Request-close
      </button>
      <output data-testid="probe-state">
        {overlay.bottomSheet.open
          ? `${overlay.bottomSheet.editorKind}=${String(overlay.bottomSheet.pendingValue)}|dirty=${overlay.bottomSheet.dirty}`
          : 'closed'}
      </output>
    </div>
  );
}

function ProbeDescription(): JSX.Element {
  const overlay = useEditorOverlay();
  return (
    <div>
      <button
        type="button"
        data-testid="probe-desc-open"
        onClick={() =>
          overlay.openDescriptionEditor({
            itemId: 1 as unknown as ItemId,
            rawMarkdown: 'original body',
          })
        }
      >
        Open desc
      </button>
      <button
        type="button"
        data-testid="probe-desc-edit"
        onClick={() => overlay.setDescriptionMarkdown('original body modified')}
      >
        Edit desc
      </button>
      <button
        type="button"
        data-testid="probe-desc-save"
        onClick={() => overlay.saveDescription()}
      >
        Save desc
      </button>
      <output data-testid="probe-desc-state">
        {overlay.descriptionEditor.open
          ? `open|raw=${overlay.descriptionEditor.rawMarkdown}`
          : 'closed'}
      </output>
    </div>
  );
}

describe('EditorOverlayProvider', () => {
  it('opens, marks dirty when value changes, and saves a status edit through the store', () => {
    const { api, staged } = makeStoreApi();
    render(
      <Harness initialIsMobile={true} api={api} staged={staged}>
        <ProbeBottomSheet initialValue="proposed" />
      </Harness>,
    );
    expect(screen.getByTestId('probe-state').textContent).toBe('closed');

    act(() => screen.getByTestId('probe-open').click());
    expect(screen.getByTestId('probe-state').textContent).toBe('status=proposed|dirty=false');

    act(() => screen.getByTestId('probe-set-dirty').click());
    expect(screen.getByTestId('probe-state').textContent).toBe('status=approved|dirty=true');

    act(() => screen.getByTestId('probe-save').click());
    expect(screen.getByTestId('probe-state').textContent).toBe('closed');
    expect(staged).toHaveLength(1);
    expect(staged[0]).toMatchObject({
      kind: 'item-cell',
      column: 'status',
      before: 'proposed',
      after: 'approved',
    });
  });

  it('save with no value change does NOT stage an edit', () => {
    const { api, staged } = makeStoreApi();
    render(
      <Harness initialIsMobile={true} api={api} staged={staged}>
        <ProbeBottomSheet />
      </Harness>,
    );
    act(() => screen.getByTestId('probe-open').click());
    act(() => screen.getByTestId('probe-save').click());
    expect(staged).toHaveLength(0);
  });

  it('requestCloseBottomSheet closes immediately when clean (no confirm dialog)', () => {
    const { api, staged } = makeStoreApi();
    render(
      <Harness initialIsMobile={true} api={api} staged={staged}>
        <ProbeBottomSheet />
      </Harness>,
    );
    act(() => screen.getByTestId('probe-open').click());
    act(() => screen.getByTestId('probe-request-close').click());
    expect(screen.queryByTestId('discard-confirm')).toBeNull();
    expect(screen.getByTestId('probe-state').textContent).toBe('closed');
  });

  it('requestCloseBottomSheet surfaces the discard-confirm dialog when dirty', () => {
    const { api, staged } = makeStoreApi();
    render(
      <Harness initialIsMobile={true} api={api} staged={staged}>
        <ProbeBottomSheet />
      </Harness>,
    );
    act(() => screen.getByTestId('probe-open').click());
    act(() => screen.getByTestId('probe-set-dirty').click());
    act(() => screen.getByTestId('probe-request-close').click());

    // Sheet stays open; dialog is visible
    expect(screen.queryByTestId('discard-confirm')).not.toBeNull();
    expect(screen.getByTestId('probe-state').textContent).toBe('status=approved|dirty=true');

    // Discard: sheet closes; nothing staged
    act(() => screen.getByTestId('discard-confirm-discard').click());
    expect(screen.queryByTestId('discard-confirm')).toBeNull();
    expect(screen.getByTestId('probe-state').textContent).toBe('closed');
    expect(staged).toHaveLength(0);
  });

  it('discard-confirm Save commits the pending edit', () => {
    const { api, staged } = makeStoreApi();
    render(
      <Harness initialIsMobile={true} api={api} staged={staged}>
        <ProbeBottomSheet />
      </Harness>,
    );
    act(() => screen.getByTestId('probe-open').click());
    act(() => screen.getByTestId('probe-set-dirty').click());
    act(() => screen.getByTestId('probe-request-close').click());
    act(() => screen.getByTestId('discard-confirm-save').click());
    expect(screen.getByTestId('probe-state').textContent).toBe('closed');
    expect(staged).toHaveLength(1);
    expect(staged[0]).toMatchObject({ column: 'status', after: 'approved' });
  });

  it('cross-mode rotation with dirty bottom-sheet surfaces the discard-confirm dialog (Issue 1A regression)', () => {
    const { api, staged } = makeStoreApi();
    let flipMode!: (next: boolean) => void;
    render(
      <Harness
        initialIsMobile={true}
        api={api}
        staged={staged}
        setMode={(cb) => {
          flipMode = cb;
        }}
      >
        <ProbeBottomSheet />
      </Harness>,
    );
    act(() => screen.getByTestId('probe-open').click());
    act(() => screen.getByTestId('probe-set-dirty').click());

    // Cross the breakpoint
    act(() => flipMode(false));
    expect(screen.queryByTestId('discard-confirm')).not.toBeNull();
  });

  it('intra-mode rotation does NOT surface the discard-confirm dialog', () => {
    const { api, staged } = makeStoreApi();
    let flipMode!: (next: boolean) => void;
    render(
      <Harness
        initialIsMobile={true}
        api={api}
        staged={staged}
        setMode={(cb) => {
          flipMode = cb;
        }}
      >
        <ProbeBottomSheet />
      </Harness>,
    );
    act(() => screen.getByTestId('probe-open').click());
    act(() => screen.getByTestId('probe-set-dirty').click());

    // Stay in mobile mode (no breakpoint crossed)
    act(() => flipMode(true));
    expect(screen.queryByTestId('discard-confirm')).toBeNull();
    expect(screen.getByTestId('probe-state').textContent).toBe('status=approved|dirty=true');
  });

  it('description editor: open → edit → save commits the edit through the store', () => {
    const { api, staged } = makeStoreApi();
    render(
      <Harness initialIsMobile={true} api={api} staged={staged}>
        <ProbeDescription />
      </Harness>,
    );
    act(() => screen.getByTestId('probe-desc-open').click());
    expect(screen.getByTestId('probe-desc-state').textContent).toContain('open|raw=original body');
    act(() => screen.getByTestId('probe-desc-edit').click());
    act(() => screen.getByTestId('probe-desc-save').click());
    expect(staged).toHaveLength(1);
    expect(staged[0]).toMatchObject({
      column: 'description',
      before: 'original body',
      after: 'original body modified',
    });
  });

  it('useEditorOverlay throws outside the provider', () => {
    function Bare(): JSX.Element {
      useEditorOverlay();
      return <div />;
    }
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Bare />)).toThrow(/EditorOverlayProvider/);
    error.mockRestore();
  });
});
