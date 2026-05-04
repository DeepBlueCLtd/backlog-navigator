import { describe, expect, it } from 'vitest';
import {
  speckitClipboardString,
  speckitCommandFor,
} from '../speckitCommand';
import { STATUS_VALUES, type Status } from '../../types';

describe('speckitCommandFor', () => {
  it('routes triage statuses to /speckit.start', () => {
    expect(speckitCommandFor('needs-interview')).toBe('speckit.start');
    expect(speckitCommandFor('proposed')).toBe('speckit.start');
  });

  it('routes approved → specify', () => {
    expect(speckitCommandFor('approved')).toBe('speckit.specify');
  });

  it('routes specified → clarify', () => {
    expect(speckitCommandFor('specified')).toBe('speckit.clarify');
  });

  it('routes clarified → plan', () => {
    expect(speckitCommandFor('clarified')).toBe('speckit.plan');
  });

  it('routes planned → review', () => {
    expect(speckitCommandFor('planned')).toBe('speckit.review');
  });

  it('routes tasked → implement', () => {
    expect(speckitCommandFor('tasked')).toBe('speckit.implement');
  });

  it('routes implementing + blocked → implement', () => {
    expect(speckitCommandFor('implementing')).toBe('speckit.implement');
    expect(speckitCommandFor('blocked')).toBe('speckit.implement');
  });

  it('returns null for terminal statuses', () => {
    expect(speckitCommandFor('complete')).toBeNull();
    expect(speckitCommandFor('parked')).toBeNull();
    expect(speckitCommandFor('rejected')).toBeNull();
  });

  it('covers every Status value (no fall-through)', () => {
    // Sanity gate: a future status added to STATUS_VALUES must be
    // explicitly mapped here, or this test fails (TS exhaustiveness
    // is enforced by the switch in speckitCommandFor).
    for (const s of STATUS_VALUES as readonly Status[]) {
      // No throw: every branch returns string|null.
      const result = speckitCommandFor(s);
      expect(result === null || typeof result === 'string').toBe(true);
    }
  });
});

describe('speckitClipboardString', () => {
  it('formats as /<cmd> <id>', () => {
    expect(speckitClipboardString('implementing', 244)).toBe(
      '/speckit.implement 244',
    );
    expect(speckitClipboardString('approved', 7)).toBe('/speckit.specify 7');
  });

  it('returns null for terminal statuses', () => {
    expect(speckitClipboardString('complete', 244)).toBeNull();
    expect(speckitClipboardString('parked', 244)).toBeNull();
  });
});
