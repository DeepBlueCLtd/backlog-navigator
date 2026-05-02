/**
 * Thin GitHub REST client. Read methods work without a PAT (rate-limited);
 * write methods require a `repo`-scoped PAT.
 *
 * All responses are validated by Zod schemas at the boundary. PATs never
 * appear in thrown error messages or log lines.
 */

import { z } from 'zod';

import { getPat } from './auth';
import {
  ContentsResponseSchema,
  ContentsWriteResponseSchema,
  CreatePullResponseSchema,
  PullResponseSchema,
  RefResponseSchema,
  type ContentsResponse,
  type ContentsWriteResponse,
  type CreatePullResponse,
  type PullResponse,
  type RefResponse,
} from './schemas';

export const DEFAULT_OWNER = 'debrief';
export const DEFAULT_REPO = 'debrief-future';
const API_ROOT = 'https://api.github.com';

export class GitHubError extends Error {
  readonly status: number;
  readonly body: string;
  /** Indicates the user's PAT lacks `repo` scope (heuristic from response). */
  readonly missingScope: boolean;
  /** Indicates GitHub said the file SHA in the request doesn't match HEAD. */
  readonly staleBase: boolean;
  constructor(
    message: string,
    status: number,
    body: string,
    flags: { missingScope?: boolean; staleBase?: boolean } = {},
  ) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.body = body;
    this.missingScope = flags.missingScope ?? false;
    this.staleBase = flags.staleBase ?? false;
  }
}

interface ClientConfig {
  owner: string;
  repo: string;
  /** Override the global fetch (test seam). */
  fetchImpl?: typeof fetch;
  /**
   * In dry-run preview mode, the navigator may load BACKLOG.md from the local
   * working tree (served by the preview build) rather than via GitHub.
   * Set this to a function returning {text, sha} to satisfy the read path
   * without touching the API.
   */
  dryRunReadOverride?: () => Promise<{ text: string; sha: string }>;
}

let config: ClientConfig = {
  owner: DEFAULT_OWNER,
  repo: DEFAULT_REPO,
};

export function configureClient(next: Partial<ClientConfig>): void {
  config = { ...config, ...next };
}

function getFetch(): typeof fetch {
  return config.fetchImpl ?? globalThis.fetch.bind(globalThis);
}

function authHeader(required: boolean): Record<string, string> {
  const pat = getPat();
  if (!pat) {
    if (required) {
      throw new GitHubError('Authentication required', 0, '', {});
    }
    return {};
  }
  return { Authorization: `Bearer ${pat}` };
}

async function readResponseBody(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function flagFromBody(status: number, body: string): { missingScope: boolean; staleBase: boolean } {
  const lower = body.toLowerCase();
  const missingScope =
    status === 403 &&
    (lower.includes('scope') || lower.includes('resource not accessible'));
  const staleBase =
    status === 409 ||
    (status === 422 && lower.includes('does not match'));
  return { missingScope, staleBase };
}

async function callApi<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
  authRequired: boolean,
): Promise<T> {
  const fetchImpl = getFetch();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...authHeader(authRequired),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetchImpl(`${API_ROOT}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await readResponseBody(res);
    const flags = flagFromBody(res.status, body);
    throw new GitHubError(
      `GitHub API ${res.status} on ${path}`,
      res.status,
      body,
      flags,
    );
  }
  const json: unknown = await res.json();
  return schema.parse(json);
}

// ─── Read endpoints ────────────────────────────────────────────────────────

export async function readBacklogMd(
  ref: string,
): Promise<{ text: string; sha: string }> {
  if (config.dryRunReadOverride) {
    return config.dryRunReadOverride();
  }
  const path = `/repos/${config.owner}/${config.repo}/contents/BACKLOG.md?ref=${encodeURIComponent(ref)}`;
  const data: ContentsResponse = await callApi(path, { method: 'GET' }, ContentsResponseSchema, false);
  // GitHub base64 may include line breaks; strip them.
  const cleaned = data.content.replace(/\n/g, '');
  const text =
    typeof atob === 'function'
      ? decodeURIComponent(escape(atob(cleaned)))
      : Buffer.from(cleaned, 'base64').toString('utf8');
  return { text, sha: data.sha };
}

export async function getPullRequest(number: number): Promise<PullResponse> {
  const path = `/repos/${config.owner}/${config.repo}/pulls/${number}`;
  return callApi(path, { method: 'GET' }, PullResponseSchema, false);
}

export async function getRefSha(branch: string): Promise<RefResponse> {
  const path = `/repos/${config.owner}/${config.repo}/git/ref/heads/${encodeURIComponent(branch)}`;
  return callApi(path, { method: 'GET' }, RefResponseSchema, true);
}

// ─── Write endpoints ───────────────────────────────────────────────────────

export async function createBranch(branch: string, sha: string): Promise<RefResponse> {
  const path = `/repos/${config.owner}/${config.repo}/git/refs`;
  return callApi(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
    },
    RefResponseSchema,
    true,
  );
}

export async function commitFile(args: {
  message: string;
  contentBase64: string;
  branch: string;
  sha: string;
}): Promise<ContentsWriteResponse> {
  const path = `/repos/${config.owner}/${config.repo}/contents/BACKLOG.md`;
  return callApi(
    path,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: args.message,
        content: args.contentBase64,
        sha: args.sha,
        branch: args.branch,
      }),
    },
    ContentsWriteResponseSchema,
    true,
  );
}

export async function openPullRequest(args: {
  title: string;
  body: string;
  head: string;
  base: string;
}): Promise<CreatePullResponse> {
  const path = `/repos/${config.owner}/${config.repo}/pulls`;
  return callApi(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    },
    CreatePullResponseSchema,
    true,
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

export function encodeUtf8ToBase64(text: string): string {
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(text)));
  }
  return Buffer.from(text, 'utf8').toString('base64');
}
