import { useMemo } from 'react';
import type { BacklogDocument } from '../types';
import { COMPLEXITY_VALUES, EDITABLE_STATUS_VALUES } from '../types';
import { strings } from '../strings';
import { useStore } from '../state/store';

export interface FilterBarProps {
  doc: BacklogDocument;
  onOpenSettings?: () => void;
}

export function FilterBar({ doc, onOpenSettings }: FilterBarProps): JSX.Element {
  const { view, setView } = useStore();
  const categories = useMemo(() => {
    const set = new Set<string>();
    doc.items.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set).sort();
  }, [doc]);

  return (
    <div className="toolbar" role="region" aria-label="Filters">
      <label htmlFor="filter-status">{strings.filters.status}</label>
      <select
        id="filter-status"
        value={view.filters.status ?? ''}
        onChange={(e) =>
          setView((v) => ({
            ...v,
            filters: { ...v.filters, status: e.target.value || null },
          }))
        }
      >
        <option value="">{strings.filters.any}</option>
        {EDITABLE_STATUS_VALUES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <label htmlFor="filter-category">{strings.filters.category}</label>
      <select
        id="filter-category"
        value={view.filters.category ?? ''}
        onChange={(e) =>
          setView((v) => ({
            ...v,
            filters: { ...v.filters, category: e.target.value || null },
          }))
        }
      >
        <option value="">{strings.filters.any}</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <label htmlFor="filter-epic">{strings.filters.epic}</label>
      <select
        id="filter-epic"
        value={view.filters.epic ?? ''}
        onChange={(e) =>
          setView((v) => ({
            ...v,
            filters: { ...v.filters, epic: e.target.value || null },
          }))
        }
      >
        <option value="">{strings.filters.any}</option>
        <option value="__none__">{strings.filters.none}</option>
        {doc.epics.map((e) => (
          <option key={e.id} value={e.id}>
            {e.id}
          </option>
        ))}
      </select>

      <label htmlFor="filter-complexity">{strings.filters.complexity}</label>
      <select
        id="filter-complexity"
        value={view.filters.complexity ?? ''}
        onChange={(e) =>
          setView((v) => ({
            ...v,
            filters: { ...v.filters, complexity: e.target.value || null },
          }))
        }
      >
        <option value="">{strings.filters.any}</option>
        {COMPLEXITY_VALUES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <input
        type="search"
        placeholder={strings.filters.placeholder}
        value={view.freeText}
        onChange={(e) => setView((v) => ({ ...v, freeText: e.target.value }))}
        aria-label="Free text filter"
        style={{ minWidth: 200 }}
      />

      <label htmlFor="filter-include-completed" style={{ marginLeft: 8 }}>
        <input
          id="filter-include-completed"
          type="checkbox"
          checked={view.includeCompleted}
          onChange={(e) =>
            setView((v) => ({ ...v, includeCompleted: e.target.checked }))
          }
        />
        Include completed
      </label>

      <button
        onClick={() => setView((v) => ({ ...v, groupByEpic: !v.groupByEpic }))}
        aria-pressed={view.groupByEpic}
      >
        {view.groupByEpic ? strings.group.flat : strings.group.byEpic}
      </button>

      <button
        onClick={() =>
          setView((v) => ({
            ...v,
            expandAllDescriptions: !v.expandAllDescriptions,
          }))
        }
      >
        {view.expandAllDescriptions ? strings.description.collapseAll : strings.description.expandAll}
      </button>

      {onOpenSettings ? (
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={strings.auth.settingsAriaLabel}
          data-testid="open-settings"
          style={{ marginLeft: 'auto' }}
        >
          {strings.auth.settingsButton}
        </button>
      ) : null}
    </div>
  );
}
