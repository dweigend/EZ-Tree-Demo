/** Guards deterministic meadow flowers, rocky patches, and incompatible habitat suppression. */

import { describe, expect, test } from 'bun:test';
import { CONFIG, WORLD_SEED } from '../config';
import { hashString } from '../core/random';
import { EcologyField, createEcologySample } from '../ecology/ecology-field';
import { HeightField } from '../terrain/height-field';
import { GroundCoverDistribution } from './ground-cover-distribution';

describe('GroundCoverDistribution', () => {
  test('repeats chunk placements exactly', () => {
    const first = createDistribution().distribution;
    const second = createDistribution().distribution;
    expect(first.getChunkPlacements(0, 0)).toEqual(second.getChunkPlacements(0, 0));
  });

  test('places flowers in meadows and rocks in rocky non-lake habitat', () => {
    const { distribution, ecology, heightField } = createDistribution();
    const placements = sampleArea(distribution);
    expect(placements.flowers.length).toBeGreaterThan(0);
    expect(placements.rocks.length).toBeGreaterThan(0);
    for (const flower of placements.flowers.slice(0, 80)) {
      const sample = sampleEcology(ecology, heightField, flower.x, flower.z);
      expect(sample.meadow).toBeGreaterThan(0.18);
      expect(sample.lake).toBeLessThanOrEqual(0.05);
    }
    for (const rock of placements.rocks.slice(0, 80)) {
      const sample = sampleEcology(ecology, heightField, rock.x, rock.z);
      expect(sample.rock).toBeGreaterThan(0.12);
      expect(sample.lake).toBeLessThanOrEqual(0.05);
    }
  });
});

function createDistribution(): {
  distribution: GroundCoverDistribution;
  ecology: EcologyField;
  heightField: HeightField;
} {
  const heightField = new HeightField(WORLD_SEED, CONFIG.view.relief);
  const ecology = new EcologyField(WORLD_SEED);
  const seed = hashString(`${WORLD_SEED}:ground-cover`);
  return { distribution: new GroundCoverDistribution(heightField, ecology, seed), ecology, heightField };
}

function sampleArea(distribution: GroundCoverDistribution) {
  const chunks = [-1, 0, 1].flatMap((z) => [-1, 0, 1].map((x) => distribution.getChunkPlacements(x, z)));
  return {
    flowers: chunks.flatMap((placements) => placements.flowers),
    rocks: chunks.flatMap((placements) => placements.rocks),
  };
}

function sampleEcology(ecology: EcologyField, heightField: HeightField, x: number, z: number) {
  const height = heightField.getHeight(x, z);
  const slope = heightField.getSlope(x, z);
  const moisture = heightField.getMoisture(x, z, height);
  return ecology.sample({ x, z, height, slope, moisture }, createEcologySample());
}
