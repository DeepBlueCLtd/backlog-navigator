/**
 * Bootstrap shell for the Backlog Navigator (#242).
 *
 * This file is the minimal scaffold landed ahead of the main feature PR so
 * that the per-PR preview workflow can attach to a real production deploy on
 * `main`. The real implementation (browse / filter / group / edit / push)
 * lands in PR #580 against this scaffold.
 */
export function App(): JSX.Element {
  return (
    <div className="app-shell" data-testid="app-shell">
      <header className="banner">
        <strong>Backlog Navigator</strong> &mdash; bootstrap scaffold
      </header>
      <main className="body">
        <p>
          The full navigator implementation is landing in <a href="https://github.com/debrief/debrief-future/pull/580">PR&nbsp;#580</a>.
          This deploy proves the publish + preview workflow trio is wired up.
        </p>
      </main>
    </div>
  );
}
