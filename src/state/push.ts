/**
 * Push pipeline. Converts pending edits into a commit (+ optional PR) on
 * GitHub, with stale-base detection, ID-collision blocking, and dry-run
 * support.
 */

import {
  commitFile,
  createBranch,
  encodeUtf8ToBase64,
  GitHubError,
  getRefSha,
  openPullRequest,
} from '../github/api';
import { serializeBacklog } from '../parser/serializeBacklog';
import { applyPendingEdits, detectCollisions } from './pendingEdits';
import type {
  BacklogDocument,
  PendingEdit,
  Sha,
} from '../types';
import { strings } from '../strings';

export interface PushArgs {
  baseline: BacklogDocument;
  baselineText: string;
  baselineSha: Sha;
  edits: PendingEdit[];
  prTitle: string;
  prBody: string;
  mode: 'live' | 'pr' | 'dry-run';
  /** Live mode: ignored. PR mode: head branch. Dry-run: ignored. */
  targetRef: string;
}

export type PushResult =
  | { kind: 'live-success'; prUrl: string; prNumber: number; commitSha: string }
  | { kind: 'pr-success'; commitSha: string }
  | { kind: 'dry-run' }
  | { kind: 'collision'; duplicateIds: number[] }
  | { kind: 'stale-base' }
  | { kind: 'scope-missing' }
  | { kind: 'auth-missing' }
  | { kind: 'network-error'; message: string };

const SLUG_PREFIX = 'backlog-navigator';

function buildBranchName(prTitle: string): string {
  const slug =
    prTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'edits';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${SLUG_PREFIX}/${slug}-${date}`;
}

export async function push(args: PushArgs): Promise<PushResult> {
  const candidate = applyPendingEdits(args.baseline, args.edits);

  const collisions = detectCollisions(candidate);
  if (collisions.hasCollision) {
    return { kind: 'collision', duplicateIds: collisions.duplicateIds.map((id) => id as number) };
  }

  const candidateText = serializeBacklog(candidate);

  if (args.mode === 'dry-run') {
    return { kind: 'dry-run' };
  }

  try {
    if (args.mode === 'pr') {
      const branch = args.targetRef;
      const result = await commitFile({
        message: args.prTitle,
        contentBase64: encodeUtf8ToBase64(candidateText),
        branch,
        sha: args.baselineSha,
      });
      return { kind: 'pr-success', commitSha: result.commit.sha };
    }

    // live mode
    const main = await getRefSha('main');
    const branch = await ensureUniqueBranch(buildBranchName(args.prTitle), main.object.sha);
    const result = await commitFile({
      message: args.prTitle,
      contentBase64: encodeUtf8ToBase64(candidateText),
      branch,
      sha: args.baselineSha,
    });
    const pr = await openPullRequest({
      title: args.prTitle,
      body: args.prBody,
      head: branch,
      base: 'main',
    });
    return {
      kind: 'live-success',
      prUrl: pr.html_url,
      prNumber: pr.number,
      commitSha: result.commit.sha,
    };
  } catch (err) {
    if (err instanceof GitHubError) {
      if (err.status === 0) return { kind: 'auth-missing' };
      if (err.staleBase) return { kind: 'stale-base' };
      if (err.missingScope) return { kind: 'scope-missing' };
      return { kind: 'network-error', message: `${strings.push.failPrefix}: HTTP ${err.status}` };
    }
    return {
      kind: 'network-error',
      message: `${strings.push.failPrefix}: ${(err as Error).message}`,
    };
  }
}

async function ensureUniqueBranch(initial: string, fromSha: string): Promise<string> {
  let candidate = initial;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await createBranch(candidate, fromSha);
      return candidate;
    } catch (err) {
      if (err instanceof GitHubError && err.status === 422) {
        candidate = `${initial}-${attempt + 2}`;
        continue;
      }
      throw err;
    }
  }
  throw new Error('ensureUniqueBranch: exhausted retry attempts');
}
