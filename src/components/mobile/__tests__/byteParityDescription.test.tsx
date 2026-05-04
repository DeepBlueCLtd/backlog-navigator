import { describe, expect, it } from 'vitest';
import { applyPendingEdits } from '../../../state/pendingEdits';
import { serializeBacklog } from '../../../parser/serializeBacklog';
import { parseBacklog } from '../../../parser/parseBacklog';
import { type IsoDate, type ItemId, type PendingEdit } from '../../../types';

/**
 * Round-trip byte-parity gate (FR-015 / SC-009) for the Description
 * column. Mobile DescriptionEditorScreen.save() and desktop
 * DescriptionCell.save() both construct the same `item-cell` PendingEdit
 * with `column='description'`. This test exercises Markdown content
 * with embedded links, escaped pipes, and table syntax — the kind of
 * content that's most-likely to round-trip badly.
 */
const FIXTURE = `# Backlog

## Epics

| ID | Title | Description | Status |
|----|-------|-------------|--------|
| E01 | First | Epic | approved |

## Items

| ID | Category | Description | V | M | A | Total | Complexity | Status | Epic | Created | Updated |
|----|----------|-------------|---|---|---|-------|------------|--------|------|---------|---------|
| 244 | Feature | Backlog Navigator — full mobile parity. | 4 | 3 | 3 | 10 | Medium | implementing | E01 | 2026-05-02 | 2026-05-03 |
`;

const stagedAt = '2026-05-04' as IsoDate;
const itemId = (n: number): ItemId => n as unknown as ItemId;

function descriptionEdit(before: string, after: string): PendingEdit {
  return {
    kind: 'item-cell',
    itemId: itemId(244),
    column: 'description',
    before,
    after,
    stagedAt,
  };
}

describe('Round-trip byte-parity — Description editor', () => {
  it('round-trips a plain Markdown edit', () => {
    const doc = parseBacklog(FIXTURE);
    const edit = descriptionEdit(
      'Backlog Navigator — full mobile parity.',
      'Backlog Navigator — full mobile parity (PWA). Phase 5 active.',
    );
    const out = serializeBacklog(applyPendingEdits(doc, [edit]));
    // Reparse + reserialise — confirms the round-trip is stable.
    const reparsed = parseBacklog(out);
    expect(reparsed.items[0]?.description).toBe(
      'Backlog Navigator — full mobile parity (PWA). Phase 5 active.',
    );
    expect(serializeBacklog(reparsed)).toBe(out);
  });

  it('round-trips a Markdown link without breaking the table', () => {
    const doc = parseBacklog(FIXTURE);
    const edit = descriptionEdit(
      'Backlog Navigator — full mobile parity.',
      'See [spec](specs/244-navigator-mobile-pwa/spec.md) for details.',
    );
    const out = serializeBacklog(applyPendingEdits(doc, [edit]));
    const reparsed = parseBacklog(out);
    expect(reparsed.items[0]?.description).toBe(
      'See [spec](specs/244-navigator-mobile-pwa/spec.md) for details.',
    );
    expect(serializeBacklog(reparsed)).toBe(out);
  });

  it('round-trips an escaped pipe character (\\|)', () => {
    const doc = parseBacklog(FIXTURE);
    const edit = descriptionEdit(
      'Backlog Navigator — full mobile parity.',
      'Markdown table cell with a literal pipe like `a \\| b`.',
    );
    const out = serializeBacklog(applyPendingEdits(doc, [edit]));
    const reparsed = parseBacklog(out);
    expect(reparsed.items[0]?.description).toBe(
      'Markdown table cell with a literal pipe like `a \\| b`.',
    );
    expect(serializeBacklog(reparsed)).toBe(out);
  });

  it('clean save (no value change) is byte-stable through the parser', () => {
    const doc = parseBacklog(FIXTURE);
    // Empty edit list — EditorOverlayProvider.saveDescription only
    // stages an edit when raw !== original, so a clean save reaches
    // the reducer as a no-op. The serialised output should re-parse
    // and re-serialise to itself.
    const round1 = serializeBacklog(applyPendingEdits(doc, []));
    const round2 = serializeBacklog(parseBacklog(round1));
    expect(round1).toBe(round2);
  });
});
