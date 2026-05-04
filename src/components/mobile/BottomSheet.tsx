import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export interface BottomSheetProps {
  open: boolean;
  title: string;
  /** Callback when the user requests dismiss via drag / tap-outside / ESC. */
  onRequestClose: () => void;
  /** Save button click. */
  onSave: () => void;
  /** Disabled state for the Save button (e.g. when no value change). */
  saveDisabled?: boolean;
  children: ReactNode;
}

const DRAG_DISMISS_THRESHOLD_PX = 80;

/**
 * Hand-rolled bottom-sheet container (per Article IX guidance, ~80 LoC).
 *
 * Behaviour:
 *   - `open=false` → renders nothing.
 *   - `open=true` → backdrop + sheet slide up from the bottom.
 *   - Drag the handle (or anywhere in the sheet header) downward more
 *     than `DRAG_DISMISS_THRESHOLD_PX` to dismiss.
 *   - Tap the backdrop to dismiss.
 *   - ESC dismisses (Bluetooth keyboards on tablets).
 *   - All dismiss paths call `onRequestClose`, which the
 *     `EditorOverlayProvider` wires to `requestCloseBottomSheet` —
 *     surfaces the FR-009 discard-confirm dialog if dirty.
 *
 * State (translateY) is local to the gesture only; the editor state
 * itself lives in `EditorOverlayContext` (Review §Issue 1A).
 */
export function BottomSheet({
  open,
  title,
  onRequestClose,
  onSave,
  saveDisabled,
  children,
}: BottomSheetProps): JSX.Element | null {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const dragStartRef = useRef<{ y: number; active: boolean }>({ y: 0, active: false });

  // ESC dismisses
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onRequestClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onRequestClose]);

  const onPointerDown = useCallback((e: React.PointerEvent): void => {
    dragStartRef.current = { y: e.clientY, active: true };
    setDragOffset(0);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent): void => {
    if (!dragStartRef.current.active) return;
    const dy = e.clientY - dragStartRef.current.y;
    if (dy > 0) setDragOffset(dy);
  }, []);
  const onPointerUp = useCallback(
    (_e: React.PointerEvent): void => {
      const dy = dragOffset;
      dragStartRef.current = { y: 0, active: false };
      if (dy > DRAG_DISMISS_THRESHOLD_PX) {
        onRequestClose();
      } else {
        setDragOffset(0);
      }
    },
    [dragOffset, onRequestClose],
  );

  if (!open) return null;

  return (
    <div
      className="bottom-sheet-backdrop"
      data-testid="bottom-sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onRequestClose();
      }}
    >
      <div
        ref={sheetRef}
        className="bottom-sheet"
        data-testid="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          transition: dragOffset > 0 ? 'none' : undefined,
        }}
      >
        <div
          className="bottom-sheet-handle"
          data-testid="bottom-sheet-handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <header className="bottom-sheet-header">
          <button
            type="button"
            className="bottom-sheet-cancel"
            data-testid="bottom-sheet-cancel"
            onClick={onRequestClose}
          >
            Cancel
          </button>
          <h2 className="bottom-sheet-title">{title}</h2>
          <button
            type="button"
            className="bottom-sheet-save"
            data-testid="bottom-sheet-save"
            onClick={onSave}
            disabled={saveDisabled}
          >
            Save
          </button>
        </header>
        <div className="bottom-sheet-content">{children}</div>
      </div>
    </div>
  );
}
