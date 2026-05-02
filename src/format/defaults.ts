/**
 * Auto-generate default PR title/body strings from an EditSummary.
 */

import type { EditSummary } from '../types';
import { summaryToText } from './summary';
import { strings } from '../strings';

export function defaultPrTitle(summary: EditSummary): string {
  if (summary.totalEditedRows === 0) return 'Backlog: no changes';
  return `Backlog: ${summaryToText(summary)}`;
}

export function defaultPrBody(summary: EditSummary): string {
  return strings.defaults.prBodyPrefix + summaryToText(summary) + '.';
}
