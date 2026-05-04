import { type Phase, useStore } from '../../state/store';

const PHASE_OPTIONS: { value: Phase; label: string }[] = [
  { value: 'any', label: '(any)' },
  { value: 'triage', label: 'Triage' },
  { value: 'ready', label: 'Ready' },
  { value: 'active', label: 'Active' },
  { value: 'done', label: 'Done' },
];

/**
 * Mobile filter chrome (FR-011, FR-012). Two compact controls + free-text
 * search. Reuses the existing `view.phase`, `view.includeCompleted`, and
 * `view.freeText` state — no new reducer.
 *
 * The Phase + Include-completed pair behaves per FR-011:
 *   - Phase = `done` forces `includeCompleted = true` on the selector
 *     (handled inside `selectFilteredSortedItems`); the checkbox is also
 *     visually disabled here for clarity.
 */
export function MobileFilterBar(): JSX.Element {
  const { view, setView } = useStore();

  const phaseDisabled = false;
  const includeCompletedDisabled = view.phase === 'done';

  return (
    <div className="mobile-filter-bar" role="region" aria-label="Filters">
      <input
        type="search"
        className="mobile-filter-search"
        data-testid="mobile-filter-search"
        placeholder="Search backlog…"
        value={view.freeText}
        onChange={(e) =>
          setView((v) => ({ ...v, freeText: e.target.value }))
        }
        aria-label="Search backlog"
      />

      <div className="mobile-filter-row">
        <label className="mobile-filter-phase-label" htmlFor="mobile-filter-phase">
          Phase:
        </label>
        <select
          id="mobile-filter-phase"
          data-testid="phase-filter"
          className="mobile-filter-phase"
          value={view.phase}
          onChange={(e) =>
            setView((v) => ({ ...v, phase: e.target.value as Phase }))
          }
          disabled={phaseDisabled}
        >
          {PHASE_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <label className="mobile-filter-include-completed">
          <input
            type="checkbox"
            data-testid="include-completed-toggle"
            checked={includeCompletedDisabled ? true : view.includeCompleted}
            disabled={includeCompletedDisabled}
            onChange={(e) =>
              setView((v) => ({ ...v, includeCompleted: e.target.checked }))
            }
            aria-label="Include completed items"
          />
          Include completed
        </label>
      </div>
    </div>
  );
}
