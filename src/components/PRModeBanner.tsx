/* react import is not needed with new jsx runtime */
import { strings } from '../strings';

export interface PRModeBannerProps {
  prNumber: number;
  branch: string;
  prUrl?: string;
  closed?: boolean;
  noChanges?: boolean;
}

export function PRModeBanner({
  prNumber,
  branch,
  prUrl,
  closed,
  noChanges,
}: PRModeBannerProps): JSX.Element {
  if (closed) {
    return (
      <div className="banner warn" role="status" data-testid="pr-mode-banner">
        {strings.prMode.closed(prNumber)}
      </div>
    );
  }
  return (
    <div className="banner pr-mode" role="status" data-testid="pr-mode-banner">
      {strings.prMode.banner(prNumber, branch)}
      {prUrl ? (
        <>
          {' — '}
          <a href={prUrl} target="_blank" rel="noopener noreferrer">
            View on GitHub ↗
          </a>
        </>
      ) : null}
      {noChanges ? <div>{strings.prMode.noChanges(prNumber)}</div> : null}
    </div>
  );
}
