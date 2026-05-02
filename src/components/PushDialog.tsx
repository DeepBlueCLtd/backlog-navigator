import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { strings } from '../strings';
import { summarise, summaryToText } from '../format/summary';
import { unifiedDiff } from '../format/diff';
import { defaultPrTitle, defaultPrBody } from '../format/defaults';
import { applyPendingEdits, detectCollisions } from '../state/pendingEdits';
import { serializeBacklog } from '../parser/serializeBacklog';
import { push, type PushResult } from '../state/push';
import type { DeploymentMode } from '../state/deploymentMode';

export interface PushDialogProps {
  deploymentMode: DeploymentMode;
  onClose: () => void;
}

export function PushDialog({ deploymentMode, onClose }: PushDialogProps): JSX.Element | null {
  const { state, edits, clearStaging } = useStore();
  const [showDiff, setShowDiff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);

  const summary = useMemo(() => summarise(edits), [edits]);
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');

  useEffect(() => {
    setPrTitle(defaultPrTitle(summary));
    setPrBody(defaultPrBody(summary));
  }, [summary]);

  const projection = useMemo(() => {
    if (state.status !== 'loaded') return null;
    const candidate = applyPendingEdits(state.baseline, edits);
    return {
      collisions: detectCollisions(candidate),
      candidateText: serializeBacklog(candidate),
    };
  }, [state, edits]);

  const diff = useMemo(() => {
    if (!showDiff || !projection || state.status !== 'loaded') return '';
    return unifiedDiff(state.baselineText, projection.candidateText);
  }, [showDiff, projection, state]);

  if (state.status !== 'loaded' || !projection) return null;
  const collisions = projection.collisions;

  const isPrMode = state.mode === 'pr';
  const isDryRun = deploymentMode === 'dry-run';

  const confirmLabel = isDryRun
    ? strings.push.confirmDryRun
    : isPrMode
      ? strings.push.confirmPr
      : strings.push.confirm;

  const onConfirm = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    const r = await push({
      baseline: state.baseline,
      baselineText: state.baselineText,
      baselineSha: state.baselineSha,
      edits,
      prTitle,
      prBody,
      mode: isDryRun ? 'dry-run' : state.mode,
      targetRef: state.targetRef as string,
    });
    setResult(r);
    setBusy(false);
    if (r.kind === 'live-success' || r.kind === 'pr-success') {
      clearStaging();
    }
  };

  const renderResult = (): JSX.Element | null => {
    if (!result) return null;
    if (result.kind === 'live-success') {
      return (
        <div className="banner success" role="status">
          {strings.push.successLive(result.prUrl)}{' '}
          <a href={result.prUrl} target="_blank" rel="noopener noreferrer">
            ↗
          </a>
        </div>
      );
    }
    if (result.kind === 'pr-success') {
      return <div className="banner success">PR commit added (sha {result.commitSha.slice(0, 7)}).</div>;
    }
    if (result.kind === 'dry-run') {
      return <div className="banner success">{strings.push.successDryRun}</div>;
    }
    if (result.kind === 'collision') {
      return <div className="banner error">{strings.push.collision} ({result.duplicateIds.join(', ')})</div>;
    }
    if (result.kind === 'stale-base') {
      return <div className="banner error">{strings.push.staleBase}</div>;
    }
    if (result.kind === 'scope-missing') {
      return <div className="banner error">{strings.push.scopeMissing}</div>;
    }
    if (result.kind === 'auth-missing') {
      return <div className="banner error">{strings.auth.title}</div>;
    }
    return <div className="banner error">{result.message}</div>;
  };

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label={strings.push.title}>
      <div className="dialog">
        <header>{strings.push.title}{isDryRun ? ' — preview' : ''}</header>
        <div className="body">
          {renderResult()}
          {collisions.hasCollision ? (
            <div className="banner error" role="alert">
              {strings.push.collision} ({collisions.duplicateIds.join(', ')})
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="pr-title">{strings.push.prTitleLabel}</label>
            <input
              id="pr-title"
              type="text"
              value={prTitle}
              onChange={(e) => setPrTitle(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pr-body">{strings.push.prBodyLabel}</label>
            <textarea id="pr-body" value={prBody} onChange={(e) => setPrBody(e.target.value)} />
          </div>
          <div className="field">
            <strong>{strings.push.summaryHeading}</strong>
            <p>{summaryToText(summary)} ({summary.totalEditedRows} row{summary.totalEditedRows === 1 ? '' : 's'})</p>
          </div>
          <div className="field">
            <button onClick={() => setShowDiff((v) => !v)} data-testid="toggle-diff">
              {showDiff ? strings.push.rawDiffHide : strings.push.rawDiff}
            </button>
            {showDiff ? <pre className="diff" data-testid="diff-output">{diff}</pre> : null}
          </div>
        </div>
        <footer>
          <button onClick={onClose} disabled={busy}>
            {strings.push.cancel}
          </button>
          <button
            className="primary"
            onClick={onConfirm}
            disabled={busy || collisions.hasCollision}
            data-testid="confirm-push"
          >
            {busy ? strings.push.pushing : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
