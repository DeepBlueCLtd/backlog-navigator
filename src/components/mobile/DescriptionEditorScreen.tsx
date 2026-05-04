import { useEffect, useRef } from 'react';
import { useEditorOverlay } from '../../editors/EditorOverlayContext';
import { useStore } from '../../state/store';

/**
 * Full-screen Markdown editor for the Description column (FR-006, FR-009).
 *
 * Reads `descriptionEditor` state from `EditorOverlayContext` (Issue 1A
 * — survives layout-mode crossing). Save commits via
 * `overlay.saveDescription()` which constructs the SAME PendingEdit
 * shape as desktop's `<DescriptionCell>` save path. Cancel calls
 * `overlay.requestCloseDescription()` which surfaces the FR-009
 * discard-confirm dialog when there are unsaved changes.
 */
export function DescriptionEditorScreen(): JSX.Element | null {
  const overlay = useEditorOverlay();
  const store = useStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const editor = overlay.descriptionEditor;
  const dirty = editor.open && editor.rawMarkdown !== editor.originalMarkdown;

  // Autofocus the textarea on open.
  useEffect(() => {
    if (editor.open && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at the end of the existing content.
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editor.open]);

  // ESC dismisses (with FR-009 confirm if dirty).
  useEffect(() => {
    if (!editor.open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') overlay.requestCloseDescription();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editor.open, overlay]);

  if (!editor.open) return null;

  const itemLiteral =
    store.projected?.items.find((it) => it.id === editor.itemId)?.idLiteral ??
    String(editor.itemId);

  return (
    <div
      className="description-editor-screen"
      data-testid="description-editor-screen"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit Description for #${itemLiteral}`}
    >
      <header className="description-editor-header">
        <button
          type="button"
          className="description-editor-cancel"
          data-testid="description-editor-cancel"
          onClick={() => overlay.requestCloseDescription()}
        >
          Cancel
        </button>
        <h2 className="description-editor-title">
          {dirty ? <span aria-label="modified">◍ </span> : null}
          #{itemLiteral} — Description
        </h2>
        <button
          type="button"
          className="description-editor-save"
          data-testid="description-editor-save"
          onClick={() => overlay.saveDescription()}
          disabled={!dirty}
        >
          Save
        </button>
      </header>
      <textarea
        ref={textareaRef}
        className="description-editor-textarea"
        data-testid="description-editor-textarea"
        aria-label="Description (Markdown source)"
        value={editor.rawMarkdown}
        onChange={(e) => overlay.setDescriptionMarkdown(e.target.value)}
        spellCheck={true}
      />
    </div>
  );
}
