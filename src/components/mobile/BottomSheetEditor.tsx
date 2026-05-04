import { useMemo } from 'react';
import { BottomSheet } from './BottomSheet';
import { useEditorOverlay } from '../../editors/EditorOverlayContext';
import { useStore } from '../../state/store';
import {
  CategoryComboBox,
  EpicPicker,
  ScorePicker,
  StatusDropdown,
} from '../editors/CellEditors';
import {
  type BottomSheetEditorKind,
  type CellValue,
  type Status,
  type ScoreCell,
} from '../../types';

const TITLES: Record<BottomSheetEditorKind, string> = {
  status: 'Status',
  category: 'Category',
  epic: 'Epic',
  'score-V': 'Value (V)',
  'score-M': 'Media (M)',
  'score-A': 'Autonomy (A)',
};

/**
 * Renders the active bottom-sheet editor. Reads `bottomSheetState` from
 * `EditorOverlayContext` (NOT local state — Issue 1A); the underlying
 * editor controls are reused from `components/editors/CellEditors.tsx`
 * so commit semantics stay byte-identical to desktop (FR-015 / SC-009).
 */
export function BottomSheetEditor(): JSX.Element | null {
  const overlay = useEditorOverlay();
  const store = useStore();

  const sheet = overlay.bottomSheet;
  const projected = store.projected;

  const categories = useMemo(() => {
    if (!projected) return [];
    const set = new Set<string>();
    for (const it of projected.items) {
      if (it.category) set.add(it.category);
    }
    return Array.from(set).sort();
  }, [projected]);

  if (!sheet.open) return null;

  const title = `${TITLES[sheet.editorKind]} — #${itemIdLiteral(sheet.itemId, projected?.items)}`;
  const noop = (): void => undefined;
  const setValue = (next: CellValue): void => overlay.setBottomSheetValue(next);

  return (
    <BottomSheet
      open={true}
      title={title}
      onRequestClose={() => overlay.requestCloseBottomSheet()}
      onSave={() => overlay.saveBottomSheet()}
      saveDisabled={!sheet.dirty}
    >
      {(() => {
        switch (sheet.editorKind) {
          case 'status':
            return (
              <StatusDropdown
                value={(sheet.pendingValue ?? 'proposed') as Status}
                onChange={(v) => setValue(v)}
                onCancel={noop}
                autoFocus
              />
            );
          case 'category':
            return (
              <CategoryComboBox
                value={String(sheet.pendingValue ?? '')}
                onChange={(v) => setValue(v)}
                onCancel={noop}
                categories={categories}
                autoFocus
              />
            );
          case 'epic':
            return (
              <EpicPicker
                value={String(sheet.pendingValue ?? '')}
                onChange={(v) => setValue(v)}
                onCancel={noop}
                epics={projected?.epics ?? []}
                autoFocus
              />
            );
          case 'score-V':
          case 'score-M':
          case 'score-A':
            return (
              <ScorePicker
                value={(sheet.pendingValue ?? '-') as ScoreCell}
                onChange={(v) => setValue(v)}
                onCancel={noop}
                autoFocus
              />
            );
        }
      })()}
    </BottomSheet>
  );
}

function itemIdLiteral(
  id: number | { toString(): string },
  items: { id: unknown; idLiteral: string }[] | undefined,
): string {
  if (!items) return String(id);
  const found = items.find((it) => it.id === id);
  return found?.idLiteral ?? String(id);
}
