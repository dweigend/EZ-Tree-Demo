/**
 * Verifies bounded startup profile and benchmark selection without a browser environment.
 */

import { describe, expect, test } from 'bun:test';
import { parseBenchmarkMode, parseQualityProfileName } from '../src/config';

describe('startup configuration', () => {
  test('selects only the explicit PICO profile', () => {
    expect(parseQualityProfileName('pico90')).toBe('pico90');
    expect(parseQualityProfileName('desktop')).toBe('desktop');
    expect(parseQualityProfileName('unknown')).toBe('desktop');
    expect(parseQualityProfileName(null)).toBe('desktop');
  });

  test('rejects unknown benchmark modes', () => {
    expect(parseBenchmarkMode('desktop-flight')).toBe('desktop-flight');
    expect(parseBenchmarkMode('xr-flight')).toBe('xr-flight');
    expect(parseBenchmarkMode('adaptive')).toBeNull();
  });
});
