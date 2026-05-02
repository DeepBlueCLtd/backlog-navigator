/**
 * Synthesise a unified diff between baseline and candidate BACKLOG.md text.
 * Used in the Push dialog's raw-diff toggle.
 */

import { createPatch } from 'diff';

export function unifiedDiff(baseline: string, candidate: string, filename = 'BACKLOG.md'): string {
  return createPatch(filename, baseline, candidate, '', '', { context: 3 });
}
