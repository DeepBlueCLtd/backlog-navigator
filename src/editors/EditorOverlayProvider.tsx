import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useStore } from '../state/store';
import { todayIso } from '../state/pendingEdits';
import {
  type BottomSheetEditorKind,
  type BottomSheetState,
  type CellValue,
  type Column,
  type DescriptionEditorState,
  type IsoDate,
  type PendingEdit,
} from '../types';
import {
  EditorOverlayContext,
  useEditorOverlay,
  type EditorOverlayContextValue,
} from './EditorOverlayContext';

// Mobile editors split off into the same chunk as App.tsx's mobile imports
// (#247). Mounting is gated on `isMobile` so the desktop user never triggers
// the dynamic import.
const BottomSheetEditor = lazy(() =>
  import('../components/mobile/BottomSheetEditor').then((m) => ({ default: m.BottomSheetEditor })),
);
const DescriptionEditorScreen = lazy(() =>
  import('../components/mobile/DescriptionEditorScreen').then((m) => ({
    default: m.DescriptionEditorScreen,
  })),
);

const MOBILE_BREAKPOINT_MAX = 1023;

interface DiscardPromptState {
  open: boolean;
  editor: 'bottom-sheet' | 'description';
  reason: 'cancel' | 'rotation';
  onSave: () => void;
  onDiscard: () => void;
  onContinue: () => void;
}

const DISCARD_CLOSED: DiscardPromptState = {
  open: false,
  editor: 'bottom-sheet',
  reason: 'cancel',
  onSave: () => undefined,
  onDiscard: () => undefined,
  onContinue: () => undefined,
};

/**
 * Map an editor kind onto the underlying `BacklogItem` column. The score-V/M/A
 * editor kinds correspond to the `value`/`media`/`autonomy` columns; the
 * status/category/epic editors map directly.
 */
function columnFor(kind: BottomSheetEditorKind): Exclude<Column, 'id'> {
  switch (kind) {
    case 'status':
      return 'status';
    case 'category':
      return 'category';
    case 'epic':
      return 'epic';
    case 'score-V':
      return 'value';
    case 'score-M':
      return 'media';
    case 'score-A':
      return 'autonomy';
  }
}

interface EditorOverlayProviderProps {
  children: ReactNode;
  /**
   * Optional override for testing — callers can inject a synchronous mode
   * signal instead of the matchMedia-driven one. Defaults to undefined.
   */
  isMobileOverride?: boolean;
}

export function EditorOverlayProvider({
  children,
  isMobileOverride,
}: EditorOverlayProviderProps): JSX.Element {
  const store = useStore();
  const realIsMobile = useIsMobile(MOBILE_BREAKPOINT_MAX);
  const isMobile = isMobileOverride ?? realIsMobile;

  const [bottomSheet, setBottomSheet] = useState<BottomSheetState>({ open: false });
  const [descriptionEditor, setDescriptionEditor] = useState<DescriptionEditorState>({
    open: false,
  });
  const [discardPrompt, setDiscardPromptState] = useState<DiscardPromptState>(DISCARD_CLOSED);

  const isBottomSheetDirty = bottomSheet.open && bottomSheet.dirty;
  const isDescriptionDirty =
    descriptionEditor.open && descriptionEditor.rawMarkdown !== descriptionEditor.originalMarkdown;
  const hasDirtyEditor = isBottomSheetDirty || isDescriptionDirty;

  // ─── Bottom-sheet actions ──────────────────────────────────────────────

  const openBottomSheet: EditorOverlayContextValue['openBottomSheet'] = useCallback(
    ({ itemId, editorKind, initialValue }) => {
      setBottomSheet({
        open: true,
        itemId,
        editorKind,
        pendingValue: initialValue,
        originalValue: initialValue,
        dirty: false,
      });
    },
    [],
  );

  const setBottomSheetValue: EditorOverlayContextValue['setBottomSheetValue'] = useCallback(
    (value) => {
      setBottomSheet((prev) => {
        if (!prev.open) return prev;
        return {
          ...prev,
          pendingValue: value,
          dirty: value !== prev.originalValue,
        };
      });
    },
    [],
  );

  const saveBottomSheet: EditorOverlayContextValue['saveBottomSheet'] = useCallback(() => {
    setBottomSheet((prev) => {
      if (!prev.open) return prev;
      if (prev.pendingValue !== prev.originalValue) {
        const column = columnFor(prev.editorKind);
        // Epic edit's `after` is "" for "no epic" — match desktop behaviour
        // where the EpicPicker emits empty string for the unselected option.
        const after: CellValue = prev.pendingValue;
        const edit: PendingEdit = {
          kind: 'item-cell',
          itemId: prev.itemId,
          column,
          before: prev.originalValue,
          after,
          stagedAt: todayIso() as IsoDate,
        };
        store.stageEdit(edit);
      }
      return { open: false };
    });
  }, [store]);

  const cancelBottomSheet: EditorOverlayContextValue['cancelBottomSheet'] = useCallback(() => {
    setBottomSheet({ open: false });
  }, []);

  const requestCloseBottomSheet: EditorOverlayContextValue['requestCloseBottomSheet'] =
    useCallback(() => {
      // Read state directly rather than from inside a setBottomSheet updater —
      // React 18 may defer the updater past the synchronous closure check.
      if (!bottomSheet.open) return true;
      if (!bottomSheet.dirty) {
        setBottomSheet({ open: false });
        return true;
      }
      setDiscardPromptState({
        open: true,
        editor: 'bottom-sheet',
        reason: 'cancel',
        onSave: () => {
          saveBottomSheet();
        },
        onDiscard: () => {
          cancelBottomSheet();
        },
        onContinue: () => undefined,
      });
      return false;
    }, [bottomSheet, cancelBottomSheet, saveBottomSheet]);

  // ─── Description-editor actions ────────────────────────────────────────

  const openDescriptionEditor: EditorOverlayContextValue['openDescriptionEditor'] = useCallback(
    ({ itemId, rawMarkdown }) => {
      setDescriptionEditor({
        open: true,
        itemId,
        rawMarkdown,
        originalMarkdown: rawMarkdown,
      });
    },
    [],
  );

  const setDescriptionMarkdown: EditorOverlayContextValue['setDescriptionMarkdown'] = useCallback(
    (value) => {
      setDescriptionEditor((prev) => {
        if (!prev.open) return prev;
        return { ...prev, rawMarkdown: value };
      });
    },
    [],
  );

  const saveDescription: EditorOverlayContextValue['saveDescription'] = useCallback(() => {
    setDescriptionEditor((prev) => {
      if (!prev.open) return prev;
      if (prev.rawMarkdown !== prev.originalMarkdown) {
        const edit: PendingEdit = {
          kind: 'item-cell',
          itemId: prev.itemId,
          column: 'description',
          before: prev.originalMarkdown,
          after: prev.rawMarkdown,
          stagedAt: todayIso() as IsoDate,
        };
        store.stageEdit(edit);
      }
      return { open: false };
    });
  }, [store]);

  const cancelDescription: EditorOverlayContextValue['cancelDescription'] = useCallback(() => {
    setDescriptionEditor({ open: false });
  }, []);

  const requestCloseDescription: EditorOverlayContextValue['requestCloseDescription'] =
    useCallback(() => {
      if (!descriptionEditor.open) return true;
      if (descriptionEditor.rawMarkdown === descriptionEditor.originalMarkdown) {
        setDescriptionEditor({ open: false });
        return true;
      }
      setDiscardPromptState({
        open: true,
        editor: 'description',
        reason: 'cancel',
        onSave: () => {
          saveDescription();
        },
        onDiscard: () => {
          cancelDescription();
        },
        onContinue: () => undefined,
      });
      return false;
    }, [descriptionEditor, cancelDescription, saveDescription]);

  // ─── Cross-mode rotation guard (Review §Issue 1A) ──────────────────────
  //
  // When the layout mode crosses the breakpoint (e.g. iPad rotation
  // 768x1024 → 1024x768), the mobile component subtree unmounts. If a dirty
  // edit is in flight, surface FR-009's discard-confirm dialog *before* the
  // unmount silently destroys it.

  const previousIsMobile = useRef<boolean>(isMobile);
  useEffect(() => {
    const wasMobile = previousIsMobile.current;
    if (wasMobile === isMobile) return;
    previousIsMobile.current = isMobile;
    if (!hasDirtyEditor) return;

    const editor: 'bottom-sheet' | 'description' = isBottomSheetDirty
      ? 'bottom-sheet'
      : 'description';
    setDiscardPromptState({
      open: true,
      editor,
      reason: 'rotation',
      onSave: () => {
        if (editor === 'bottom-sheet') saveBottomSheet();
        else saveDescription();
      },
      onDiscard: () => {
        if (editor === 'bottom-sheet') cancelBottomSheet();
        else cancelDescription();
      },
      onContinue: () => undefined,
    });
  }, [
    isMobile,
    hasDirtyEditor,
    isBottomSheetDirty,
    saveBottomSheet,
    saveDescription,
    cancelBottomSheet,
    cancelDescription,
  ]);

  const resolveDiscardPrompt: EditorOverlayContextValue['resolveDiscardPrompt'] = useCallback(
    (action) => {
      // Snapshot handlers, then close, then call them — so handlers see a
      // clean prompt state.
      const handlers = {
        save: discardPrompt.onSave,
        discard: discardPrompt.onDiscard,
        continue: discardPrompt.onContinue,
      };
      setDiscardPromptState(DISCARD_CLOSED);
      handlers[action]();
    },
    [discardPrompt],
  );

  const value = useMemo<EditorOverlayContextValue>(
    () => ({
      bottomSheet,
      descriptionEditor,
      hasDirtyEditor,
      openBottomSheet,
      setBottomSheetValue,
      saveBottomSheet,
      cancelBottomSheet,
      requestCloseBottomSheet,
      openDescriptionEditor,
      setDescriptionMarkdown,
      saveDescription,
      cancelDescription,
      requestCloseDescription,
      discardPrompt: discardPrompt.open
        ? {
            open: true,
            editor: discardPrompt.editor,
            reason: discardPrompt.reason,
            onSave: discardPrompt.onSave,
            onDiscard: discardPrompt.onDiscard,
            onContinue: discardPrompt.onContinue,
          }
        : { open: false },
      resolveDiscardPrompt,
    }),
    [
      bottomSheet,
      descriptionEditor,
      hasDirtyEditor,
      openBottomSheet,
      setBottomSheetValue,
      saveBottomSheet,
      cancelBottomSheet,
      requestCloseBottomSheet,
      openDescriptionEditor,
      setDescriptionMarkdown,
      saveDescription,
      cancelDescription,
      requestCloseDescription,
      discardPrompt,
      resolveDiscardPrompt,
    ],
  );

  return (
    <EditorOverlayContext.Provider value={value}>
      {children}
      {isMobile ? (
        <Suspense fallback={null}>
          <BottomSheetEditor />
          <DescriptionEditorScreen />
        </Suspense>
      ) : null}
      {discardPrompt.open ? <DiscardConfirmModal /> : null}
    </EditorOverlayContext.Provider>
  );
}

/**
 * The discard-confirm modal. Mounted unconditionally inside the provider so
 * it remains visible regardless of the layout-mode unmount.
 *
 * The actual JSX is intentionally minimal — styling is layered in
 * `mobile.css` for mobile and `discard-confirm.css` for desktop (the modal
 * is reused by the desktop Description editor too). The control surface
 * is what matters: three explicit buttons, no implicit dismiss.
 */
function DiscardConfirmModal(): JSX.Element {
  const { discardPrompt, resolveDiscardPrompt } = useEditorOverlay();

  if (!discardPrompt.open) return <></>;

  const titleText =
    discardPrompt.reason === 'rotation'
      ? 'Save your changes?'
      : 'Discard your changes?';
  const bodyText =
    discardPrompt.reason === 'rotation'
      ? "The layout is changing because the screen rotated. Save your edit before it's discarded?"
      : "You have unsaved changes. What would you like to do?";

  return (
    <div className="discard-confirm-backdrop" data-testid="discard-confirm" role="dialog" aria-modal="true">
      <div className="discard-confirm-dialog">
        <h2 className="discard-confirm-title">{titleText}</h2>
        <p className="discard-confirm-body">{bodyText}</p>
        <div className="discard-confirm-actions">
          <button
            type="button"
            className="discard-confirm-save"
            data-testid="discard-confirm-save"
            onClick={() => resolveDiscardPrompt('save')}
          >
            Save
          </button>
          <button
            type="button"
            className="discard-confirm-discard"
            data-testid="discard-confirm-discard"
            onClick={() => resolveDiscardPrompt('discard')}
          >
            Discard
          </button>
          <button
            type="button"
            className="discard-confirm-continue"
            data-testid="discard-confirm-continue"
            onClick={() => resolveDiscardPrompt('continue')}
          >
            Continue editing
          </button>
        </div>
      </div>
    </div>
  );
}
