import { useEffect, useState } from 'react';
import { StoreProvider, useStore, useStoreState } from './state/store';
import { detectDeploymentMode, detectPrNumber } from './state/deploymentMode';
import { getPullRequest, readBacklogMd, configureClient } from './github/api';
import { hasPat, subscribePat } from './github/auth';
import { parseBacklog } from './parser/parseBacklog';
import { asGitRef, asSha, type GitRef } from './types';
import { strings } from './strings';
import { ItemsTable } from './components/ItemsTable';
import { FilterBar } from './components/FilterBar';
import { PendingFooter } from './components/PendingFooter';
import { PushDialog } from './components/PushDialog';
import { DryRunBanner } from './components/DryRunBanner';
import { PRModeBanner } from './components/PRModeBanner';
import { StatusBanner } from './components/StatusBanner';
import { AuthPrompt } from './components/AuthPrompt';

interface PrMeta {
  number: number;
  branch: string;
  url: string;
  closed: boolean;
}

export function App(): JSX.Element {
  const api = useStoreState();
  return (
    <StoreProvider value={api}>
      <AppShell />
    </StoreProvider>
  );
}

function AppShell(): JSX.Element {
  const api = useStore();
  const { state, setState, persistenceWarning, projected } = api;

  const deploymentMode = detectDeploymentMode(window.location.search);
  const prNumber = detectPrNumber(window.location.search);
  const [prMeta, setPrMeta] = useState<PrMeta | null>(null);
  const [authed, setAuthed] = useState<boolean>(hasPat());
  const [showAuth, setShowAuth] = useState<boolean>(false);
  const [showPushDialog, setShowPushDialog] = useState<boolean>(false);

  useEffect(() => {
    configureClient({});
  }, []);

  useEffect(() => {
    const unsub = subscribePat(() => setAuthed(hasPat()));
    return unsub;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        let mode: 'live' | 'pr' = 'live';
        let targetRef: GitRef = asGitRef('main');
        let prMetaLocal: PrMeta | null = null;
        if (prNumber !== null) {
          try {
            const pr = await getPullRequest(prNumber);
            mode = 'pr';
            targetRef = asGitRef(pr.head.ref);
            prMetaLocal = {
              number: pr.number,
              branch: pr.head.ref,
              url: pr.html_url,
              closed: pr.state === 'closed',
            };
          } catch {
            if (!cancelled) {
              setState({ status: 'error', error: strings.prMode.invalid });
            }
            return;
          }
        }
        const { text, sha } = await readBacklogMd(targetRef as string);
        if (cancelled) return;
        const parsed = parseBacklog(text);
        setState({
          status: 'loaded',
          baseline: parsed,
          baselineText: text,
          baselineSha: asSha(sha),
          targetRef,
          mode,
          prNumber,
        });
        setPrMeta(prMetaLocal);
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            error: `${strings.app.loadError}: ${(err as Error).message}`,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prNumber, setState]);

  const onAuthRequired = (): void => setShowAuth(true);

  return (
    <div className="app-shell">
      {deploymentMode === 'dry-run' ? <DryRunBanner /> : null}
      {prMeta ? (
        <PRModeBanner
          prNumber={prMeta.number}
          branch={prMeta.branch}
          prUrl={prMeta.url}
          closed={prMeta.closed}
        />
      ) : null}
      {showAuth ? <AuthPrompt onSaved={() => setShowAuth(false)} /> : null}
      {persistenceWarning ? <StatusBanner kind="warn">{persistenceWarning}</StatusBanner> : null}

      {state.status === 'loading' ? (
        <StatusBanner kind="info">{strings.app.loading}</StatusBanner>
      ) : null}
      {state.status === 'error' ? <StatusBanner kind="error">{state.error}</StatusBanner> : null}

      {state.status === 'loaded' && projected ? (
        <>
          <FilterBar doc={projected} />
          <ItemsTable
            doc={projected}
            baseline={state.baseline}
            authed={authed || deploymentMode === 'dry-run'}
            onAuthRequired={onAuthRequired}
          />
          <PendingFooter onPushChanges={() => setShowPushDialog(true)} />
        </>
      ) : null}

      {showPushDialog ? (
        <PushDialog deploymentMode={deploymentMode} onClose={() => setShowPushDialog(false)} />
      ) : null}
    </div>
  );
}
