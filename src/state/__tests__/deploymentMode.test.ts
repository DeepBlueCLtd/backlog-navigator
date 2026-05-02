import { describe, expect, it } from 'vitest';
import { detectDeploymentMode, detectPrNumber } from '../deploymentMode';

describe('detectDeploymentMode', () => {
  it('returns dry-run when ?dryRun=1 is set', () => {
    expect(detectDeploymentMode('?dryRun=1')).toBe('dry-run');
    expect(detectDeploymentMode('dryRun=1')).toBe('dry-run');
  });
  it('returns live when no override is set', () => {
    expect(detectDeploymentMode('')).toBe('live');
    expect(detectDeploymentMode('?other=foo')).toBe('live');
  });
});

describe('detectPrNumber', () => {
  it('parses ?pr=NNN', () => {
    expect(detectPrNumber('?pr=42')).toBe(42);
  });
  it('returns null on missing or invalid', () => {
    expect(detectPrNumber('')).toBe(null);
    expect(detectPrNumber('?pr=abc')).toBe(null);
    expect(detectPrNumber('?pr=0')).toBe(null);
  });
});
