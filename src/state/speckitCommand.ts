import type { Status } from '../types';

/**
 * The set of speckit commands a backlog item can be at, in workflow order.
 * Mirrors the user-facing slash commands available in Claude Code.
 */
export type SpeckitCommand =
  | 'speckit.start'
  | 'speckit.specify'
  | 'speckit.clarify'
  | 'speckit.plan'
  | 'speckit.review'
  | 'speckit.tasks'
  | 'speckit.implement';

/**
 * Map a backlog item's `status` to the speckit command an analyst would
 * most-naturally invoke next.
 *
 * Returns `null` for terminal statuses (`complete` is done; `parked` and
 * `rejected` would have been removed from the table) — the UI hides the
 * copy button in those cases.
 *
 * Mapping rationale (per the workflow described in CLAUDE.md and the
 * speckit skill descriptions):
 *
 *   needs-interview → /speckit.start
 *     The item still needs requirements gathering; /speckit.start kicks
 *     off the workflow from the backlog row (the start command bridges
 *     into /interview if it detects an under-specified entry).
 *   proposed         → /speckit.start
 *     Approved-but-not-yet-started; the start command initialises the
 *     spec dir.
 *   approved         → /speckit.specify
 *     Item is ready to write the spec for.
 *   specified        → /speckit.clarify
 *     Spec exists; clarify before planning.
 *   clarified        → /speckit.plan
 *     Spec is clarified; time to plan.
 *   planned          → /speckit.review
 *     Plan exists; review it before generating tasks.
 *   tasked           → /speckit.implement
 *     Tasks are ready; start coding.
 *   implementing     → /speckit.implement
 *     Resume in-progress implementation.
 *   blocked          → /speckit.implement
 *     Blocked rows resume via implement; the analyst may follow up with
 *     a plan revision but implement is the closest single command.
 */
export function speckitCommandFor(status: Status): SpeckitCommand | null {
  switch (status) {
    case 'needs-interview':
    case 'proposed':
      return 'speckit.start';
    case 'approved':
      return 'speckit.specify';
    case 'specified':
      return 'speckit.clarify';
    case 'clarified':
      return 'speckit.plan';
    case 'planned':
      return 'speckit.review';
    case 'tasked':
      return 'speckit.implement';
    case 'implementing':
    case 'blocked':
      return 'speckit.implement';
    case 'complete':
    case 'parked':
    case 'rejected':
      return null;
  }
}

/**
 * Build the clipboard string for an item — `/<cmd> <id>`. Example:
 * `speckitClipboardString('implementing', 244) === '/speckit.implement 244'`.
 *
 * Returns `null` for terminal statuses.
 */
export function speckitClipboardString(
  status: Status,
  id: number,
): string | null {
  const cmd = speckitCommandFor(status);
  if (!cmd) return null;
  return `/${cmd} ${id}`;
}
