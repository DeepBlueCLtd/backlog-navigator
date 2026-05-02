/* react import is not needed with new jsx runtime */
import { strings } from '../strings';

export function DryRunBanner(): JSX.Element {
  return (
    <div className="banner dry-run" role="status" data-testid="dry-run-banner">
      {strings.dryRun.banner}
    </div>
  );
}
