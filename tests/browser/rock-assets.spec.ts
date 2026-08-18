/**
 * Guards the three runtime rock assets against open geometric seams before they enter instanced batches.
 * Position-based edge keys deliberately merge duplicated UV vertices while preserving real topology gaps.
 */

import { expect, test } from '@playwright/test';
import type { BufferGeometry } from 'three';

test('rock assets stay watertight and inside the low-poly budget', async ({ page }) => {
  await page.goto('/?profile=pico90');
  const statistics = await page.evaluate(async () => {
    const modulePath = '/src/assets/landscape-assets.ts';
    const { disposeLandscapeAssets, loadLandscapeAssets } = (await import(modulePath)) as typeof import(
      '../../src/assets/landscape-assets'
    );
    const assets = await loadLandscapeAssets();
    try {
      return assets.rocks.map((rock) => ({
        boundaryEdges: countGeometricBoundaryEdges(rock.geometry),
        triangles: (rock.geometry.index?.count ?? rock.geometry.getAttribute('position').count) / 3,
      }));
    } finally {
      disposeLandscapeAssets(assets);
    }

    function countGeometricBoundaryEdges(geometry: BufferGeometry): number {
      const positions = geometry.getAttribute('position');
      const indices = geometry.index;
      const elementCount = indices?.count ?? positions.count;
      const edges = new Map<string, number>();
      for (let offset = 0; offset < elementCount; offset += 3) {
        const triangle = [getIndex(offset), getIndex(offset + 1), getIndex(offset + 2)];
        countEdge(triangle[0]!, triangle[1]!);
        countEdge(triangle[1]!, triangle[2]!);
        countEdge(triangle[2]!, triangle[0]!);
      }
      return [...edges.values()].filter((count) => count === 1).length;

      function getIndex(offset: number): number {
        return indices?.getX(offset) ?? offset;
      }

      function countEdge(first: number, second: number): void {
        const firstKey = getPositionKey(first);
        const secondKey = getPositionKey(second);
        const key = firstKey < secondKey ? `${firstKey}|${secondKey}` : `${secondKey}|${firstKey}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }

      function getPositionKey(index: number): string {
        const precision = 10_000;
        return [positions.getX(index), positions.getY(index), positions.getZ(index)]
          .map((value) => Math.round(value * precision))
          .join(',');
      }
    }
  });

  expect(statistics.map(({ boundaryEdges }) => boundaryEdges)).toEqual([0, 0, 0]);
  expect(statistics.map(({ triangles }) => triangles)).toEqual([244, 162, 342]);
});
