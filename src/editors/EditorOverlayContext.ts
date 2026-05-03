import { createContext, useContext } from 'react';
import type {
  BottomSheetEditorKind,
  BottomSheetState,
  CellValue,
  DescriptionEditorState,
  ItemId,
} from '../types';

/**
 * Context value exposed by `<EditorOverlayProvider>`. Lifts editor state above
 * the layout-mode branch so iPad rotation across the 1024 px breakpoint cannot
 * silently destroy a dirty edit (Review §Issue 1A; Article I.3).
 */
export interface EditorOverlayContextValue {
  bottomSheet: BottomSheetState;
  descriptionEditor: DescriptionEditorState;
  /** True when either editor has unsaved changes. */
  hasDirtyEditor: boolean;

  // Bottom-sheet actions
  openBottomSheet(args: {
    itemId: ItemId;
    editorKind: BottomSheetEditorKind;
    initialValue: CellValue;
  }): void;
  setBottomSheetValue(value: CellValue): void;
  saveBottomSheet(): void;
  /** Discards the pending value if any; safe to call when not open. */
  cancelBottomSheet(): void;
  /** Starts the discard flow — returns true if no confirmation needed (clean). */
  requestCloseBottomSheet(): boolean;

  // Description editor actions
  openDescriptionEditor(args: { itemId: ItemId; rawMarkdown: string }): void;
  setDescriptionMarkdown(value: string): void;
  saveDescription(): void;
  cancelDescription(): void;
  requestCloseDescription(): boolean;

  // Discard-confirm modal control (FR-009; cross-mode rotation guard)
  discardPrompt:
    | { open: false }
    | {
        open: true;
        editor: 'bottom-sheet' | 'description';
        reason: 'cancel' | 'rotation';
        onSave(): void;
        onDiscard(): void;
        onContinue(): void;
      };
  resolveDiscardPrompt(action: 'save' | 'discard' | 'continue'): void;
}

export const EditorOverlayContext = createContext<EditorOverlayContextValue | null>(null);

/**
 * Hook for consumers. Throws if used outside `<EditorOverlayProvider>` so a
 * misplaced consumer surfaces immediately rather than silently no-oping.
 */
export function useEditorOverlay(): EditorOverlayContextValue {
  const ctx = useContext(EditorOverlayContext);
  if (!ctx) {
    throw new Error(
      'useEditorOverlay() called outside <EditorOverlayProvider>. Wrap the App tree before mounting any editor consumer.',
    );
  }
  return ctx;
}
