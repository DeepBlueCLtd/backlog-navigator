/**
 * CI gate: parse the live BACKLOG.md and re-serialise it; the output must
 * equal the input byte-for-byte. Failures here indicate a parser/serialiser
 * drift, not a content bug.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { parseBacklog } from '../parseBacklog';
import { serializeBacklog } from '../serializeBacklog';

const BACKLOG_PATH = join(__dirname, '..', '..', '..', '..', '..', 'BACKLOG.md');

describe('live BACKLOG.md round-trip', () => {
  it('parses with the expected shape', () => {
    const text = readFileSync(BACKLOG_PATH, 'utf8');
    const doc = parseBacklog(text);
    expect(doc.items.length).toBeGreaterThan(50);
    expect(doc.epics.length).toBeGreaterThan(5);
    // Legacy rows (composite IDs, non-standard statuses) are preserved as
    // raw rows so round-trip is byte-stable. They surface as parse warnings,
    // not as errors. Cap warnings at a sane bound so silent regressions in
    // the parser still fail this gate.
    expect(doc.parseWarnings.length).toBeLessThan(50);
  });

  it('round-trips byte-for-byte', () => {
    const text = readFileSync(BACKLOG_PATH, 'utf8');
    const doc = parseBacklog(text);
    const out = serializeBacklog(doc);
    expect(out).toBe(text);
  });
});
