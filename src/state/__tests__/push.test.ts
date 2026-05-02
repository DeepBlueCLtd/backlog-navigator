/**
 * Mocked-fetch tests for the push pipeline. Exercises the live-mode 4-call
 * sequence, dry-run no-op, PR-mode commit, and the failure branches: 409
 * stale-base, 403 missing-scope, 422 branch-already-exists retry, and
 * pre-flight collision blocking.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';

import { configureClient } from '../../github/api';
import { setPat, clearPat, _resetCacheForTests } from '../../github/auth';
import { parseBacklog } from '../../parser/parseBacklog';
import { push } from '../push';
import type { ItemId, IsoDate, PendingEdit, Sha } from '../../types';

const FIXTURE = `# Backlog

## Epics

| ID | Title | Description | Status |
|----|-------|-------------|--------|
| E01 | First | First epic | approved |

## Items

| ID | Category | Description | V | M | A | Total | Complexity | Status | Epic | Created | Updated |
|----|----------|-------------|---|---|---|-------|------------|--------|------|---------|---------|
| 001 | Feature | One | 5 | 3 | 5 | 13 | Medium | proposed | E01 | 2025-01-01 | 2025-01-01 |
| 002 | Bug | Two | 4 | 4 | 4 | 12 | Low | proposed |  | 2025-01-02 | 2025-01-02 |
`;

const stagedAt = '2026-05-02' as IsoDate;
const itemId = (n: number): ItemId => n as unknown as ItemId;
const baselineSha = '0123456789abcdef0123456789abcdef01234567' as Sha;

const SAMPLE_EDIT: PendingEdit = {
  kind: 'item-cell',
  itemId: itemId(1),
  column: 'status',
  before: 'proposed',
  after: 'approved',
  stagedAt,
};

interface MockCall {
  url: string;
  method: string;
  body: unknown;
}

function mockFetch(handlers: Array<(url: string, init: RequestInit) => Response | Promise<Response>>): {
  fn: typeof fetch;
  calls: MockCall[];
} {
  const calls: MockCall[] = [];
  let i = 0;
  const fn: typeof fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init.method ?? 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body as string) : null;
    calls.push({ url, method, body });
    const handler = handlers[i++];
    if (!handler) throw new Error(`mockFetch: no handler for call #${i} ${method} ${url}`);
    return handler(url, init);
  };
  return { fn, calls };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('push()', () => {
  beforeEach(() => {
    _resetCacheForTests();
    setPat('ghp_fake_pat_for_tests', ['repo'], 'octocat');
    configureClient({});
  });

  it('dry-run returns dry-run without making any fetch calls', async () => {
    const { fn, calls } = mockFetch([]);
    configureClient({ fetchImpl: fn });
    const baseline = parseBacklog(FIXTURE);
    const result = await push({
      baseline,
      baselineText: FIXTURE,
      baselineSha,
      edits: [SAMPLE_EDIT],
      prTitle: 't',
      prBody: 'b',
      mode: 'dry-run',
      targetRef: 'main',
    });
    expect(result.kind).toBe('dry-run');
    expect(calls.length).toBe(0);
  });

  it('blocks push when an ID rename collides with an existing ID', async () => {
    const { fn, calls } = mockFetch([]);
    configureClient({ fetchImpl: fn });
    const baseline = parseBacklog(FIXTURE);
    const collidingEdit: PendingEdit = {
      kind: 'item-id-rename',
      oldId: itemId(1),
      newId: itemId(2),
      stagedAt,
    };
    const result = await push({
      baseline,
      baselineText: FIXTURE,
      baselineSha,
      edits: [collidingEdit],
      prTitle: 't',
      prBody: 'b',
      mode: 'live',
      targetRef: 'main',
    });
    expect(result.kind).toBe('collision');
    if (result.kind === 'collision') {
      expect(result.duplicateIds).toContain(2);
    }
    expect(calls.length).toBe(0);
  });

  it('live mode runs the 4-call sequence (read main → branch → commit → PR)', async () => {
    const { fn, calls } = mockFetch([
      // 1. GET ref/heads/main
      () => jsonResponse(200, { ref: 'refs/heads/main', object: { sha: 'mainsha' } }),
      // 2. POST git/refs (create branch)
      () => jsonResponse(201, { ref: 'refs/heads/backlog-navigator/foo', object: { sha: 'mainsha' } }),
      // 3. PUT contents/BACKLOG.md
      () =>
        jsonResponse(200, {
          content: { sha: 'newfilesha', path: 'BACKLOG.md' },
          commit: { sha: 'commitsha' },
        }),
      // 4. POST pulls
      () =>
        jsonResponse(201, {
          number: 42,
          html_url: 'https://github.com/x/y/pull/42',
          state: 'open',
        }),
    ]);
    configureClient({ fetchImpl: fn });

    const baseline = parseBacklog(FIXTURE);
    const result = await push({
      baseline,
      baselineText: FIXTURE,
      baselineSha,
      edits: [SAMPLE_EDIT],
      prTitle: 'Backlog: 1 status change',
      prBody: 'auto-generated',
      mode: 'live',
      targetRef: 'main',
    });

    expect(result.kind).toBe('live-success');
    if (result.kind === 'live-success') {
      expect(result.prNumber).toBe(42);
      expect(result.prUrl).toBe('https://github.com/x/y/pull/42');
      expect(result.commitSha).toBe('commitsha');
    }
    expect(calls.length).toBe(4);
    expect(calls[0]?.url).toContain('/git/ref/heads/main');
    expect(calls[1]?.url).toContain('/git/refs');
    expect(calls[1]?.method).toBe('POST');
    expect(calls[2]?.url).toContain('/contents/BACKLOG.md');
    expect(calls[2]?.method).toBe('PUT');
    // The commit must include the baseline SHA — that's the staleness detector.
    expect((calls[2]?.body as { sha: string }).sha).toBe(baselineSha);
    expect(calls[3]?.url).toContain('/pulls');
    expect(calls[3]?.method).toBe('POST');
  });

  it('returns stale-base on 409 from the commit endpoint', async () => {
    const { fn } = mockFetch([
      () => jsonResponse(200, { ref: 'refs/heads/main', object: { sha: 'mainsha' } }),
      () => jsonResponse(201, { ref: 'refs/heads/foo', object: { sha: 'mainsha' } }),
      () => jsonResponse(409, { message: 'sha does not match' }),
    ]);
    configureClient({ fetchImpl: fn });
    const baseline = parseBacklog(FIXTURE);
    const result = await push({
      baseline,
      baselineText: FIXTURE,
      baselineSha,
      edits: [SAMPLE_EDIT],
      prTitle: 't',
      prBody: 'b',
      mode: 'live',
      targetRef: 'main',
    });
    expect(result.kind).toBe('stale-base');
  });

  it('returns scope-missing on 403 with scope error body', async () => {
    const { fn } = mockFetch([
      () =>
        new Response('{"message":"Resource not accessible: missing repo scope"}', {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
    ]);
    configureClient({ fetchImpl: fn });
    const baseline = parseBacklog(FIXTURE);
    const result = await push({
      baseline,
      baselineText: FIXTURE,
      baselineSha,
      edits: [SAMPLE_EDIT],
      prTitle: 't',
      prBody: 'b',
      mode: 'live',
      targetRef: 'main',
    });
    expect(result.kind).toBe('scope-missing');
  });

  it('retries with -2 suffix when create-branch returns 422 (already exists)', async () => {
    const { fn, calls } = mockFetch([
      // GET main
      () => jsonResponse(200, { ref: 'refs/heads/main', object: { sha: 'mainsha' } }),
      // POST refs — 422
      () => jsonResponse(422, { message: 'Reference already exists' }),
      // POST refs — second attempt with -2 suffix succeeds
      () => jsonResponse(201, { ref: 'refs/heads/foo-2', object: { sha: 'mainsha' } }),
      // PUT contents
      () =>
        jsonResponse(200, {
          content: { sha: 'sha2', path: 'BACKLOG.md' },
          commit: { sha: 'commitsha2' },
        }),
      // POST pulls
      () =>
        jsonResponse(201, {
          number: 43,
          html_url: 'https://github.com/x/y/pull/43',
          state: 'open',
        }),
    ]);
    configureClient({ fetchImpl: fn });
    const baseline = parseBacklog(FIXTURE);
    const result = await push({
      baseline,
      baselineText: FIXTURE,
      baselineSha,
      edits: [SAMPLE_EDIT],
      prTitle: 't',
      prBody: 'b',
      mode: 'live',
      targetRef: 'main',
    });
    expect(result.kind).toBe('live-success');
    expect(calls.length).toBe(5);
    // The second branch creation should target a `-2`-suffixed name.
    const secondRefBody = calls[2]?.body as { ref?: string } | null;
    expect(secondRefBody?.ref).toMatch(/-2$/);
  });

  it('PR mode commits onto the head branch directly with no PR creation', async () => {
    const { fn, calls } = mockFetch([
      // PUT contents directly — no GET ref, no POST refs, no POST pulls
      () =>
        jsonResponse(200, {
          content: { sha: 'newsha', path: 'BACKLOG.md' },
          commit: { sha: 'prcommit' },
        }),
    ]);
    configureClient({ fetchImpl: fn });
    const baseline = parseBacklog(FIXTURE);
    const result = await push({
      baseline,
      baselineText: FIXTURE,
      baselineSha,
      edits: [SAMPLE_EDIT],
      prTitle: 't',
      prBody: 'b',
      mode: 'pr',
      targetRef: 'feature/foo',
    });
    expect(result.kind).toBe('pr-success');
    if (result.kind === 'pr-success') {
      expect(result.commitSha).toBe('prcommit');
    }
    expect(calls.length).toBe(1);
    expect(calls[0]?.method).toBe('PUT');
    // Branch field on the body must be the PR head branch.
    const body = calls[0]?.body as { branch?: string } | null;
    expect(body?.branch).toBe('feature/foo');
  });

  it('returns auth-missing when no PAT is set in live mode', async () => {
    clearPat();
    const { fn } = mockFetch([]);
    configureClient({ fetchImpl: fn });
    const baseline = parseBacklog(FIXTURE);
    const result = await push({
      baseline,
      baselineText: FIXTURE,
      baselineSha,
      edits: [SAMPLE_EDIT],
      prTitle: 't',
      prBody: 'b',
      mode: 'live',
      targetRef: 'main',
    });
    // The first auth-required call (getRefSha) should fail before any
    // network round-trip.
    expect(result.kind).toBe('auth-missing');
  });

  it('redacts the PAT in thrown error messages (Article X)', async () => {
    const sentinel = 'ghp_TOP_SECRET_NEVER_LOG_ME';
    setPat(sentinel, ['repo']);
    const { fn } = mockFetch([
      () => jsonResponse(500, { message: 'internal error' }),
    ]);
    configureClient({ fetchImpl: fn });
    const baseline = parseBacklog(FIXTURE);
    const result = await push({
      baseline,
      baselineText: FIXTURE,
      baselineSha,
      edits: [SAMPLE_EDIT],
      prTitle: 't',
      prBody: 'b',
      mode: 'live',
      targetRef: 'main',
    });
    expect(result.kind).toBe('network-error');
    if (result.kind === 'network-error') {
      expect(result.message).not.toContain(sentinel);
    }
  });
});

// Suppress noisy console output from expected error paths.
vi.spyOn(console, 'error').mockImplementation(() => undefined);
