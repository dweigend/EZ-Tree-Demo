/** Guards deterministic clustered tree density, stable ranks, and shrub-only hedge variants. */

import { describe, expect, test } from 'bun:test';
import { CONFIG, TERRAIN, VEGETATION, WORLD_SEED } from '../config';
import { hashString } from '../core/random';
import { EcologyField } from '../ecology/ecology-field';
import { HeightField } from '../terrain/height-field';
import { TREE_TEMPLATES } from '../trees/tree-templates';
import { getChunkViewWindow } from '../world/chunk-coordinates';
import { ForestDistribution, type TreePlacement } from './forest-distribution';

describe('ForestDistribution', () => {
  test('repeats placements and keeps stable-rank order inside each chunk', () => {
    const first = createDistribution();
    const second = createDistribution();
    const placements = first.getChunkPlacements(0, 0);
    expect(placements).toEqual(second.getChunkPlacements(0, 0));
    const treeRanks = placements.filter(isTree).map((placement) => placement.rank);
    expect(treeRanks).toEqual([...treeRanks].sort((left, right) => left - right));
  });

  test('keeps default and strong-region tree populations within the agreed budgets', () => {
    const distribution = createDistribution();
    const defaultPopulation = countVisible(distribution, 0, 0, 120);
    const strongPopulation = countVisible(distribution, 0, -3);
    expect(defaultPopulation.trees + defaultPopulation.shrubs).toBeGreaterThanOrEqual(500);
    expect(defaultPopulation.trees + defaultPopulation.shrubs).toBeLessThanOrEqual(750);
    expect(strongPopulation.trees).toBeGreaterThanOrEqual(600);
    expect(strongPopulation.trees).toBeLessThanOrEqual(900);
  });

  test('uses only shrub templates for hedge placements', () => {
    const placements = createDistribution().getChunkPlacements(1, 1);
    const shrubs = placements.filter((placement) => placement.kind === 'shrub');
    expect(shrubs.length).toBeGreaterThan(0);
    expect(shrubs.every((placement) => TREE_TEMPLATES[placement.variant]?.form === 'shrub')).toBe(true);
  });
});

function createDistribution(): ForestDistribution {
  const heightField = new HeightField(WORLD_SEED, CONFIG.view.relief);
  const ecologyField = new EcologyField(WORLD_SEED);
  return new ForestDistribution(heightField, ecologyField, hashString(`${WORLD_SEED}:forest`), TREE_TEMPLATES);
}

function countVisible(distribution: ForestDistribution, chunkX: number, chunkZ: number, offsetZ = 0): {
  trees: number;
  shrubs: number;
} {
  const cameraX = chunkX * TERRAIN.chunkSize;
  const cameraZ = chunkZ * TERRAIN.chunkSize + offsetZ;
  const chunks = getChunkViewWindow(chunkX, chunkZ, TERRAIN.chunkRadius, { x: 0, z: -1 });
  const visible = chunks.flatMap((chunk) => distribution.getChunkPlacements(chunk.x, chunk.z))
    .filter((placement) => Math.hypot(placement.x - cameraX, placement.z - cameraZ) < VEGETATION.farDistance);
  return {
    trees: visible.filter(isTree).length,
    shrubs: visible.filter((placement) => placement.kind === 'shrub').length,
  };
}

function isTree(placement: TreePlacement): boolean {
  return placement.kind === 'tree';
}
