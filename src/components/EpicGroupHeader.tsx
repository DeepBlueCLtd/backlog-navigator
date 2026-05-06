/* react import is not needed with new jsx runtime */
import type { Epic } from '../types';
import { strings } from '../strings';

export interface EpicGroupHeaderProps {
  epic: Epic | null; // null = "(unassigned)"
  done: number;
  total: number;
  fraction: number;
}

export function EpicGroupHeader({
  epic,
  done,
  total,
  fraction,
}: EpicGroupHeaderProps): JSX.Element {
  return (
    <tr>
      <td colSpan={11} className="epic-group-header" data-testid="epic-group-header">
        <span style={{ minWidth: 50 }}>{epic ? epic.id : strings.group.unassigned}</span>
        <span style={{ flex: 1 }}>{epic ? epic.title : ''}</span>
        <span className="progress-text">{strings.group.progress(done, total)}</span>
        <span className="progress-bar" aria-label={`${done} of ${total} complete`}>
          <div style={{ width: `${(fraction * 100).toFixed(0)}%` }} />
        </span>
        {epic ? <span style={{ color: 'var(--fg-muted)' }}>{epic.status}</span> : null}
      </td>
    </tr>
  );
}
