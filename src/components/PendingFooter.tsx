/* react import is not needed with new jsx runtime */
import { useStore } from '../state/store';
import { strings } from '../strings';

export interface PendingFooterProps {
  onPushChanges: () => void;
}

export function PendingFooter({ onPushChanges }: PendingFooterProps): JSX.Element {
  const { edits, clearStaging } = useStore();
  const n = edits.length;
  const onDiscard = (): void => {
    if (n === 0) return;
    if (window.confirm(strings.pending.confirmDiscard)) clearStaging();
  };
  return (
    <div className="pending-footer" role="region" aria-label="Pending edits">
      <span className="count" data-testid="pending-count">
        {n === 0 ? strings.pending.none : strings.pending.footer(n)}
      </span>
      <button onClick={onDiscard} disabled={n === 0}>
        {strings.pending.discardAll}
      </button>
      <button
        className="primary"
        onClick={onPushChanges}
        disabled={n === 0}
        data-testid="push-changes"
      >
        {strings.pending.pushChanges}
      </button>
    </div>
  );
}
