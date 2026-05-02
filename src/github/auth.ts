/**
 * PAT get/set/clear + is-set helpers. PAT is stored only in localStorage on
 * this device; never logged, never interpolated into thrown errors.
 *
 * Mirrors apps/spec-navigator/src/github/auth.ts. Uses the
 * `backlog-navigator:` namespace so the two apps retain independent control of
 * their stored credentials, even though the user may choose to use the same PAT.
 */

import type { CredentialEnvelope } from '../types';

const KEY = 'backlog-navigator:github-pat';

let cached: CredentialEnvelope | null | undefined = undefined;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) l();
}

export function subscribePat(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readStorage(): CredentialEnvelope | null {
  if (cached !== undefined) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cached = null;
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { pat?: unknown }).pat === 'string' &&
      Array.isArray((parsed as { scopes?: unknown }).scopes)
    ) {
      cached = parsed as CredentialEnvelope;
      return cached;
    }
    cached = null;
    return null;
  } catch {
    cached = null;
    return null;
  }
}

export function getPat(): string | null {
  const cred = readStorage();
  return cred ? cred.pat : null;
}

export function getCredential(): CredentialEnvelope | null {
  return readStorage();
}

export function hasPat(): boolean {
  return getPat() !== null;
}

export function setPat(pat: string, scopes: string[] = ['repo'], login?: string): void {
  if (!pat || pat.trim().length === 0) {
    throw new Error('PAT must not be empty');
  }
  const cred: CredentialEnvelope = { pat: pat.trim(), scopes, login };
  localStorage.setItem(KEY, JSON.stringify(cred));
  cached = cred;
  notify();
}

export function clearPat(): void {
  localStorage.removeItem(KEY);
  cached = null;
  notify();
}

/** Test-only cache flush. */
export function _resetCacheForTests(): void {
  cached = undefined;
}
