import type { BacklogDocument } from '../../types';

/**
 * Phase 2 placeholder — Phase 3 (T034) replaces this with a virtualised
 * card list using `@tanstack/react-virtual`. Today this stub renders nothing
 * so that App.tsx can branch on layout mode without a runtime hole.
 */
export function CardList(_props: { doc: BacklogDocument }): JSX.Element {
  return (
    <div className="card-list-placeholder" data-testid="card-list">
      <p style={{ padding: '1rem', color: '#666' }}>
        (Mobile card list — Phase 3 of #244 fills this in.)
      </p>
    </div>
  );
}
