/** Verifies deterministic lake carving without coupling terrain tests to a fixed feature cell. */

import { describe, expect, test } from 'bun:test';
import { EcologyField, createMacroFeatureSample, type MacroFeatureSample } from '../ecology/ecology-field';
import { HeightField } from './height-field';

describe('HeightField lake basins', () => {
  test('lowers terrain only when the shared ecology field contains a lake', () => {
    const ecology = new EcologyField('lake-test');
    const lake = findLake(ecology);
    const original = new HeightField('lake-test');
    const carved = new HeightField('lake-test', 1, ecology);
    const originalHeight = original.getHeight(lake.centerX, lake.centerZ);
    const carvedHeight = carved.getHeight(lake.centerX, lake.centerZ);
    expect(carvedHeight).toBeLessThan(originalHeight - 3);
    expect(carved.getLakeSurfaceHeight(lake)).toBeGreaterThan(carvedHeight);
  });
});

function findLake(ecology: EcologyField): MacroFeatureSample {
  const feature = createMacroFeatureSample();
  for (let z = -8; z <= 8; z += 1) {
    for (let x = -8; x <= 8; x += 1) {
      ecology.sampleMacroFeature(x * 800 + 400, z * 800 + 400, feature);
      if (feature.kind === 'lake') return { ...feature };
    }
  }
  throw new Error('Expected at least one deterministic lake in the test window.');
}
