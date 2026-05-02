import { describe, expect, it } from 'vitest';
import {
  asEpicId,
  asIsoDate,
  asItemId,
  asScoreCell,
  asSha,
  asStatus,
  asTotal,
  ABSENT_SCORE,
} from '../types';

describe('narrowing helpers', () => {
  it('asItemId accepts numeric strings and integers', () => {
    expect(asItemId('235') as unknown as number).toBe(235);
    expect(asItemId(42) as unknown as number).toBe(42);
  });
  it('asItemId rejects non-numeric / out-of-range', () => {
    expect(() => asItemId('abc')).toThrow();
    expect(() => asItemId(0)).toThrow();
    expect(() => asItemId(10000)).toThrow();
  });

  it('asEpicId accepts E## form only', () => {
    expect(asEpicId('E01')).toBe('E01');
    expect(() => asEpicId('e01')).toThrow();
    expect(() => asEpicId('E1')).toThrow();
    expect(() => asEpicId('024')).toThrow();
  });

  it('asIsoDate validates YYYY-MM-DD', () => {
    expect(asIsoDate('2026-05-02')).toBe('2026-05-02');
    expect(() => asIsoDate('2026/05/02')).toThrow();
    expect(() => asIsoDate('05-02-2026')).toThrow();
  });

  it('asSha accepts hex 7..40 chars', () => {
    expect(asSha('abcdef0')).toBe('abcdef0');
    expect(() => asSha('xyz')).toThrow();
  });

  it('asStatus accepts known workflow values', () => {
    expect(asStatus('proposed')).toBe('proposed');
    expect(asStatus('complete')).toBe('complete');
    expect(() => asStatus('subsumed')).toThrow();
  });

  it('asScoreCell accepts integers and the dash sentinel', () => {
    expect(asScoreCell('-')).toBe(ABSENT_SCORE);
    expect(asScoreCell('5')).toBe(5);
    expect(asScoreCell('4')).toBe(4);
    expect(() => asScoreCell('abc')).toThrow();
  });

  it('asTotal accepts integers and dash', () => {
    expect(asTotal('-')).toBe(ABSENT_SCORE);
    expect(asTotal('12')).toBe(12);
  });
});
