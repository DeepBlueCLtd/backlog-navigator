import { describe, expect, it } from 'vitest';
import { parseBacklog, splitRowCells, unwrapStrikethrough } from '../parseBacklog';
import { serializeBacklog } from '../serializeBacklog';

const FIXTURE = `# Backlog

prose...

## Epics

intro

| ID | Title | Description | Status |
|----|-------|-------------|--------|
| E01 | First Epic | A description | approved |
| E02 | Second Epic | Another description | complete |

after epics

## Items

intro

| ID | Category | Description | V | M | A | Total | Complexity | Status | Epic | Created | Updated |
|----|----------|-------------|---|---|---|-------|------------|--------|------|---------|---------|
| 001 | Feature | A simple feature | 5 | 3 | 5 | 13 | Medium | approved | E01 | 2025-01-15 | 2026-04-01 |
~~| 002 | Bug | A completed fix | 4 | 4 | 4 | 12 | Low | complete | E01 | 2025-02-01 | 2026-04-15 |~~
| 003 | Tech Debt | Has \\| escaped pipe | - | - | - | - | High | proposed |  | 2026-04-22 | 2026-04-22 |

## Notes

trailing prose
`;

describe('splitRowCells', () => {
  it('splits a basic row', () => {
    const cells = splitRowCells('| a | b | c |');
    expect(cells).toEqual(['a', 'b', 'c']);
  });
  it('honours escaped pipes', () => {
    const cells = splitRowCells('| a | b\\|c | d |');
    expect(cells).toEqual(['a', 'b|c', 'd']);
  });
});

describe('unwrapStrikethrough', () => {
  it('detects row-level strikethrough', () => {
    const r = unwrapStrikethrough('~~| a | b |~~');
    expect(r.struck).toBe(true);
    expect(r.stripped).toBe('| a | b |');
  });
  it('returns input unchanged when not struck', () => {
    const r = unwrapStrikethrough('| a | b |');
    expect(r.struck).toBe(false);
  });
});

describe('parseBacklog', () => {
  it('parses items, epics, and preserves prose', () => {
    const doc = parseBacklog(FIXTURE);
    expect(doc.items.length).toBe(3);
    expect(doc.epics.length).toBe(2);
    expect(doc.items[0]?.id as unknown as number).toBe(1);
    expect(doc.items[0]?.idLiteral).toBe('001');
    expect(doc.items[1]?.strikethrough).toBe(true);
    expect(doc.items[2]?.description).toContain('| escaped pipe');
  });

  it('round-trips byte-for-byte', () => {
    const doc = parseBacklog(FIXTURE);
    const out = serializeBacklog(doc);
    expect(out).toBe(FIXTURE);
  });

  it('emits parse warnings for malformed rows but keeps them as raw', () => {
    const broken = FIXTURE.replace(
      '| 003 | Tech Debt | Has \\| escaped pipe | - | - | - | - | High | proposed |  | 2026-04-22 | 2026-04-22 |',
      '| 003 | Tech Debt | Bad row | - | - | - | - | High | weirdstatus |  | 2026-04-22 | 2026-04-22 |',
    );
    const doc = parseBacklog(broken);
    expect(doc.parseWarnings.length).toBeGreaterThan(0);
    expect(doc.rawItemRows.length).toBeGreaterThan(0);
    expect(serializeBacklog(doc)).toBe(broken);
  });
});
