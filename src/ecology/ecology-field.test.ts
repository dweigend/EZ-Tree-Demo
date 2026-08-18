/** Guards deterministic world-space ecology masks and stable macro-feature selection. */

import { describe, expect, test } from 'bun:test';
import { EcologyField, createEcologySample, createMacroFeatureSample } from './ecology-field';

const SITE = { x: 418.5, z: -227.25, height: 62, slope: 0.18, moisture: 0.72 } as const;

describe('EcologyField', () => {
  test('returns deterministic bounded habitat masks', () => {
    const first = new EcologyField('stable-world').sample(SITE, createEcologySample());
    const second = new EcologyField('stable-world').sample(SITE, createEcologySample());
    expect(first).toEqual(second);
    for (const value of Object.values(first)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  test('keeps macro features stable within a world cell', () => {
    const ecology = new EcologyField('stable-world');
    const first = ecology.sampleMacroFeature(101, 202, createMacroFeatureSample());
    const second = ecology.sampleMacroFeature(102, 203, createMacroFeatureSample());
    expect(first.kind).toBe(second.kind);
    expect(first.centerX).toBe(second.centerX);
    expect(first.centerZ).toBe(second.centerZ);
  });

  test('changes its ecology when the world seed changes', () => {
    const first = new EcologyField('stable-world').sample(SITE, createEcologySample());
    const second = new EcologyField('other-world').sample(SITE, createEcologySample());
    expect(first).not.toEqual(second);
  });
});
