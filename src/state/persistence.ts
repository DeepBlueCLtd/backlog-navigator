/**
 * localStorage persistence for the pending-edits envelope.
 * Schema contract: specs/242-backlog-navigator/contracts/localstorage-schema.md.
 */

import type { PendingEditsEnvelopeV1 } from '../types';

const KEY = 'backlog-navigator:pending-edits:v1';
const SOFT_WARN_BYTES = 1024 * 1024; // 1MB soft warning per the contract

export function readEnvelope(): PendingEditsEnvelopeV1 | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidEnvelope(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeEnvelope(envelope: PendingEditsEnvelopeV1): { warning?: string } {
  const serialised = JSON.stringify(envelope);
  try {
    localStorage.setItem(KEY, serialised);
  } catch (err) {
    throw new Error(
      `persistence.writeEnvelope: localStorage write failed (${(err as Error).message})`,
    );
  }
  if (serialised.length > SOFT_WARN_BYTES) {
    return {
      warning: `Pending edits payload is ${(serialised.length / 1024).toFixed(0)}KB — consider pushing or discarding before staging more.`,
    };
  }
  return {};
}

export function clearEnvelope(): void {
  localStorage.removeItem(KEY);
}

function isValidEnvelope(v: unknown): v is PendingEditsEnvelopeV1 {
  if (!v || typeof v !== 'object') return false;
  const e = v as Partial<PendingEditsEnvelopeV1>;
  return (
    e.schemaVersion === 1 &&
    typeof e.baselineSha === 'string' &&
    typeof e.targetRef === 'string' &&
    (e.mode === 'live' || e.mode === 'pr') &&
    Array.isArray(e.edits) &&
    typeof e.lastModified === 'string'
  );
}

/** Test-only: bypass typeguard for fixture writes. */
export const _PERSISTENCE_KEY = KEY;
