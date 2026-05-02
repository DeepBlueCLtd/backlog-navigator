import React, { useMemo, useState } from 'react';
import {
  CategoryComboBox,
  ComplexityDropdown,
  DateInput,
  DescriptionTextarea,
  EpicPicker,
  IdInput,
  ScorePicker,
  StatusDropdown,
} from './editors/CellEditors';
import { DescriptionCell } from './DescriptionCell';
import {
  ABSENT_SCORE,
  type BacklogDocument,
  type BacklogItem,
  type CellValue,
  type Column,
  type IsoDate,
  type PendingEdit,
  type ScoreCell,
  asEpicId,
  asIsoDate,
  asItemId,
  SENTINEL_CREATED,
} from '../types';
import { useStore, findEditForCell } from '../state/store';
import { strings } from '../strings';
import { todayIso } from '../state/pendingEdits';

export interface ItemRowProps {
  item: BacklogItem;
  doc: BacklogDocument;
  baseline: BacklogItem | undefined;
  rowIndex: number;
  /** Whether the user is authenticated; if not, edits trigger an auth prompt callback. */
  authed: boolean;
  onAuthRequired: () => void;
}

type EditingCell = Column | null;

export function ItemRow({
  item,
  doc,
  baseline: _baseline,
  authed,
  onAuthRequired,
}: ItemRowProps): JSX.Element {
  const { stageEdit, edits, undoEdit } = useStore();
  const [editing, setEditing] = useState<EditingCell>(null);

  const editedColumns = useMemo(() => {
    const cols = new Set<Column>();
    for (const e of edits) {
      if (e.kind === 'item-cell' && e.itemId === item.id) cols.add(e.column);
      if (e.kind === 'item-id-rename' && e.newId === item.id) cols.add('id');
    }
    return cols;
  }, [edits, item.id]);

  const beginEdit = (col: Column): void => {
    if (!authed) {
      onAuthRequired();
      return;
    }
    setEditing(col);
  };

  const commit = (column: Exclude<Column, 'id'>, before: CellValue, after: CellValue): void => {
    if (before === after) {
      setEditing(null);
      return;
    }
    const edit: PendingEdit = {
      kind: 'item-cell',
      itemId: item.id,
      column,
      before,
      after,
      stagedAt: todayIso() as IsoDate,
    };
    stageEdit(edit);
    setEditing(null);
  };

  const commitId = (newRaw: number): void => {
    if (newRaw === (item.id as number)) {
      setEditing(null);
      return;
    }
    try {
      const newId = asItemId(newRaw);
      const edit: PendingEdit = {
        kind: 'item-id-rename',
        oldId: item.id,
        newId,
        stagedAt: todayIso() as IsoDate,
      };
      stageEdit(edit);
    } catch {
      // ignore invalid; editor will surface inline
    }
    setEditing(null);
  };

  const undoCol = (column: Column): void => {
    const found = findEditForCell(edits, item.id, column);
    if (found) undoEdit(found.index);
  };

  const struck = item.status === 'complete';
  const isEditedRow = editedColumns.size > 0;

  const renderCell = (col: Column, raw: React.ReactNode, klass = ''): JSX.Element => {
    const edited = editedColumns.has(col);
    const cls = `${klass}${edited ? ' edited' : ''}`.trim();
    const onContext = (e: React.MouseEvent): void => {
      if (edited) {
        e.preventDefault();
        undoCol(col);
      }
    };
    return (
      <td
        className={cls}
        onClick={() => editing === null && beginEdit(col)}
        onContextMenu={onContext}
        title={edited ? `Edited (right-click to undo)` : undefined}
      >
        {editing === col ? renderEditor(col) : raw}
      </td>
    );
  };

  const renderEditor = (col: Column): JSX.Element | null => {
    const cancel = (): void => setEditing(null);
    switch (col) {
      case 'id':
        return (
          <IdInput
            value={item.id as number}
            onChange={() => undefined}
            onCancel={cancel}
            collisionWarning={false}
            autoFocus
            // commit on blur (Enter is implicit in number inputs)
          />
        );
      case 'status':
        return (
          <StatusDropdown
            value={item.status}
            onChange={(v) => commit('status', item.status, v)}
            onCancel={cancel}
            autoFocus
          />
        );
      case 'complexity':
        return (
          <ComplexityDropdown
            value={item.complexity}
            onChange={(v) => commit('complexity', item.complexity, v)}
            onCancel={cancel}
            autoFocus
          />
        );
      case 'value':
      case 'media':
      case 'autonomy':
        return (
          <ScorePicker
            value={item[col] as ScoreCell}
            onChange={(v: ScoreCell) => commit(col, item[col] as CellValue, v)}
            onCancel={cancel}
            autoFocus
          />
        );
      case 'total':
        return (
          <ScorePicker
            value={(item.total === ABSENT_SCORE ? '-' : (item.total as 1 | 3 | 5))}
            onChange={(v: ScoreCell) => commit('total', item.total as CellValue, v)}
            onCancel={cancel}
            autoFocus
          />
        );
      case 'epic':
        return (
          <EpicPicker
            value={item.epic ?? ''}
            epics={doc.epics}
            onChange={(v) => {
              try {
                const next = v === '' ? null : asEpicId(v);
                commit('epic', item.epic, next);
              } catch {
                // ignore
              }
            }}
            onCancel={cancel}
            autoFocus
          />
        );
      case 'created':
      case 'updated':
        return (
          <DateInput
            value={item[col] as string}
            onChange={(v) => {
              try {
                commit(col, item[col] as CellValue, asIsoDate(v));
              } catch {
                /* ignore */
              }
            }}
            onCancel={cancel}
            autoFocus
          />
        );
      case 'category':
        return (
          <CategoryComboBox
            value={item.category}
            categories={Array.from(new Set(doc.items.map((i) => i.category))).sort()}
            onChange={(v) => commit('category', item.category, v)}
            onCancel={cancel}
            autoFocus
          />
        );
      case 'description':
        return (
          <DescriptionTextarea
            value={item.description}
            onChange={(v) => commit('description', item.description, v)}
            onCancel={cancel}
            autoFocus
          />
        );
      default:
        return null;
    }
  };

  // Note on the `id` editor: number inputs don't fire onChange with a final
  // value cleanly; we wrap commit in onBlur when the editor is open.
  const idCell = editing === 'id' ? (
    <td className={`id ${editedColumns.has('id') ? 'edited' : ''}`} data-testid={`row-id-${item.id}`}>
      <input
        type="number"
        autoFocus
        defaultValue={item.id as number}
        onBlur={(e) => commitId(Number.parseInt(e.target.value, 10))}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(null);
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </td>
  ) : (
    <td
      className={`id ${editedColumns.has('id') ? 'edited' : ''}`}
      onClick={() => beginEdit('id')}
      data-testid={`row-id-${item.id}`}
    >
      {item.id}
    </td>
  );

  const totalText = item.total === ABSENT_SCORE ? '-' : String(item.total);
  const isSentinelCreated = item.created === SENTINEL_CREATED;

  return (
    <tr
      className={`${struck ? 'struck' : ''} ${isEditedRow ? 'edited' : ''}`.trim()}
      data-testid={`row-${item.id}`}
    >
      {idCell}
      {renderCell('category', item.category, 'short')}
      {renderCell(
        'description',
        <DescriptionCell itemId={item.id} text={item.description} />,
        'description',
      )}
      {renderCell('value', String(item.value), 'score')}
      {renderCell('media', String(item.media), 'score')}
      {renderCell('autonomy', String(item.autonomy), 'score')}
      {renderCell('total', totalText, 'numeric')}
      {renderCell('complexity', item.complexity, 'short')}
      {renderCell('status', item.status, 'short')}
      {renderCell('epic', item.epic ?? '—', 'short')}
      {renderCell(
        'created',
        <span
          className={isSentinelCreated ? 'sentinel-date' : ''}
          title={isSentinelCreated ? strings.errors.sentinelDate : undefined}
        >
          {item.created}
        </span>,
        'short',
      )}
      {renderCell('updated', item.updated, 'short')}
    </tr>
  );
}

