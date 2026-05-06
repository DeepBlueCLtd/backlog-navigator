import React from 'react';
import type { BacklogDocument, BacklogItem, EpicId } from '../types';
import { useStore, selectFilteredSortedItems, selectEpicProgress, type SortKey } from '../state/store';
import { ItemRow } from './ItemRow';
import { EpicGroupHeader } from './EpicGroupHeader';
import { strings } from '../strings';

export interface ItemsTableProps {
  doc: BacklogDocument;
  baseline: BacklogDocument;
  authed: boolean;
  onAuthRequired: () => void;
}

const SORTABLE: { key: SortKey; col: string; label: string }[] = [
  { key: 'id', col: 'id', label: strings.columns.id },
  { key: 'total', col: 'total', label: strings.columns.total },
  { key: 'updated', col: 'updated', label: strings.columns.updated },
  { key: 'created', col: 'created', label: strings.columns.created },
];

const FIXED: { col: string; label: string }[] = [
  { col: 'category', label: strings.columns.category },
  { col: 'description', label: strings.columns.description },
  { col: 'vma', label: strings.columns.vma },
  { col: 'complexity', label: strings.columns.complexity },
  { col: 'status', label: strings.columns.status },
  { col: 'epic', label: strings.columns.epic },
];

export function ItemsTable({ doc, baseline, authed, onAuthRequired }: ItemsTableProps): JSX.Element {
  const { view, setView } = useStore();
  const items = selectFilteredSortedItems(doc, view);

  const onSort = (key: SortKey): void => {
    setView((v) => {
      if (v.sortKey === key) {
        return { ...v, sortDir: v.sortDir === 'asc' ? 'desc' : 'asc' };
      }
      return { ...v, sortKey: key, sortDir: 'desc' };
    });
  };

  const sortIndicator = (key: SortKey): string => {
    if (view.sortKey !== key) return '';
    return view.sortDir === 'asc' ? '▲' : '▼';
  };

  const baselineById = new Map<number, BacklogItem>();
  for (const it of baseline.items) baselineById.set(it.id as number, it);

  const renderHeader = (): JSX.Element => {
    const isSortable = (col: string): SortKey | null => {
      const found = SORTABLE.find((s) => s.col === col);
      return found ? found.key : null;
    };
    const cells: JSX.Element[] = [];
    cells.push(
      <th key="id" onClick={() => onSort('id')} aria-sort={view.sortKey === 'id' ? (view.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        {strings.columns.id} <span className="sort-indicator">{sortIndicator('id')}</span>
      </th>,
    );
    cells.push(<th key="category">{strings.columns.category}</th>);
    cells.push(<th key="description">{strings.columns.description}</th>);
    cells.push(<th key="vma" className="vma" title="Value · Media · Autonomy">{strings.columns.vma}</th>);
    cells.push(
      <th key="total" onClick={() => onSort('total')} aria-sort={view.sortKey === 'total' ? (view.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        {strings.columns.total} <span className="sort-indicator">{sortIndicator('total')}</span>
      </th>,
    );
    cells.push(<th key="complexity">{strings.columns.complexity}</th>);
    cells.push(<th key="status">{strings.columns.status}</th>);
    cells.push(<th key="epic">{strings.columns.epic}</th>);
    cells.push(
      <th key="created" onClick={() => onSort('created')} aria-sort={view.sortKey === 'created' ? (view.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        {strings.columns.created} <span className="sort-indicator">{sortIndicator('created')}</span>
      </th>,
    );
    cells.push(
      <th key="updated" onClick={() => onSort('updated')} aria-sort={view.sortKey === 'updated' ? (view.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        {strings.columns.updated} <span className="sort-indicator">{sortIndicator('updated')}</span>
      </th>,
    );
    cells.push(<th key="action" aria-label="Row actions" className="action" />);
    void FIXED; void isSortable;
    return <tr>{cells}</tr>;
  };

  const tableBody = (): JSX.Element => {
    if (!view.groupByEpic) {
      return (
        <tbody>
          {items.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              doc={doc}
              baseline={baselineById.get(it.id as number)}
              rowIndex={0}
              authed={authed}
              onAuthRequired={onAuthRequired}
            />
          ))}
        </tbody>
      );
    }

    const groups = new Map<EpicId | null, BacklogItem[]>();
    for (const it of items) {
      const k = it.epic;
      const arr = groups.get(k) ?? [];
      arr.push(it);
      groups.set(k, arr);
    }

    const progress = selectEpicProgress(doc);
    const orderedKeys: (EpicId | null)[] = [...doc.epics.map((e) => e.id), null].filter((k) =>
      groups.has(k),
    );

    return (
      <tbody>
        {orderedKeys.map((k) => {
          const epic = k === null ? null : doc.epics.find((e) => e.id === k) ?? null;
          const p = progress.get(k) ?? { totalItems: 0, completeItems: 0, fraction: 0, epicId: k };
          const groupItems = groups.get(k) ?? [];
          return (
            <React.Fragment key={k ?? '__none__'}>
              <EpicGroupHeader epic={epic} done={p.completeItems} total={p.totalItems} fraction={p.fraction} />
              {groupItems.map((it) => (
                <ItemRow
                  key={it.id}
                  item={it}
                  doc={doc}
                  baseline={baselineById.get(it.id as number)}
                  rowIndex={0}
                  authed={authed}
                  onAuthRequired={onAuthRequired}
                />
              ))}
            </React.Fragment>
          );
        })}
      </tbody>
    );
  };

  return (
    <div className="table-wrap">
      <table className="items" aria-label="Backlog items">
        <thead>{renderHeader()}</thead>
        {tableBody()}
      </table>
    </div>
  );
}
