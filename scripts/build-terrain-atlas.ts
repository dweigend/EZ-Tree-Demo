/**
 * Builds one fixed 3x3 terrain atlas from the eight local Poly Haven materials.
 * Runtime receives albedo plus RG normal XY, B height, and A roughness surface data.
 */

import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LANDSCAPE_ASSET_CATALOG, type TerrainAtlasAsset } from '../src/assets/landscape-asset-catalog';
import {
  TERRAIN_TEXTURE_CONFIG,
  type TerrainMaterialConfig,
} from '../src/terrain/terrain-texture-config';

type AtlasMap = 'albedo' | 'surface';

interface AtlasJob {
  readonly materials: readonly TerrainMaterialConfig[];
  readonly map: AtlasMap;
  readonly atlasSize: number;
  readonly output: string;
}

interface CellJob {
  readonly material: TerrainMaterialConfig;
  readonly map: AtlasMap;
  readonly cellSize: number;
  readonly contentSize: number;
}

const ATLAS_COLUMNS = 3;
const ATLAS_GUTTER = 8;
const repoRoot = path.resolve(import.meta.dir, '..');
const sourceRoot = path.join(repoRoot, 'assets/source/landscape/terrain-materials/polyhaven');
const tempRoot = await mkdtemp(path.join(tmpdir(), 'terrain-atlas-'));

try {
  await validateMaps(TERRAIN_TEXTURE_CONFIG.materials);
  await buildTerrainAtlas(LANDSCAPE_ASSET_CATALOG.terrain, TERRAIN_TEXTURE_CONFIG.materials);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function buildTerrainAtlas(
  atlas: TerrainAtlasAsset,
  materials: readonly TerrainMaterialConfig[],
): Promise<void> {
  const outputRoot = path.dirname(toRuntimePath(atlas.albedo));
  await mkdir(outputRoot, { recursive: true });
  await buildAtlas({
    materials,
    map: 'albedo',
    atlasSize: atlas.atlasSize,
    output: toRuntimePath(atlas.albedo),
  });
  await buildAtlas({
    materials,
    map: 'surface',
    atlasSize: atlas.atlasSize,
    output: toRuntimePath(atlas.surface),
  });
}

async function buildAtlas(job: AtlasJob): Promise<void> {
  const cellSize = job.atlasSize / ATLAS_COLUMNS;
  const contentSize = cellSize - ATLAS_GUTTER * 2;
  const cells = await Promise.all(
    job.materials.map((material) => buildCell({ material, map: job.map, cellSize, contentSize })),
  );
  const filler = await buildFillerCell(job.map, cellSize);
  while (cells.length < ATLAS_COLUMNS ** 2) cells.push(filler);
  const rows: string[] = [];
  for (let row = 0; row < ATLAS_COLUMNS; row += 1) {
    const outputRow = path.join(tempRoot, `${path.basename(job.output)}-row-${row}.png`);
    await runMagick([...cells.slice(row * ATLAS_COLUMNS, (row + 1) * ATLAS_COLUMNS), '+append', outputRow]);
    rows.push(outputRow);
  }
  const options =
    job.map === 'surface'
      ? ['-define', 'webp:lossless=true', '-define', 'webp:method=6']
      : ['-quality', '88'];
  await runMagick([...rows, '-append', ...options, job.output]);
}

async function buildCell(job: CellJob): Promise<string> {
  const materialRoot = path.join(sourceRoot, job.material.asset);
  const source =
    job.map === 'albedo' ? path.join(materialRoot, 'basecolor.jpg') : await buildPackedSurface(job.material);
  const output = path.join(tempRoot, `${job.material.asset}-${job.map}-${job.cellSize}.png`);
  await runMagick([
    source,
    '-resize',
    `${job.contentSize}x${job.contentSize}!`,
    '-virtual-pixel',
    'tile',
    '-set',
    'option:distort:viewport',
    `${job.cellSize}x${job.cellSize}-${ATLAS_GUTTER}-${ATLAS_GUTTER}`,
    '-filter',
    'point',
    '-distort',
    'SRT',
    '0',
    '+repage',
    output,
  ]);
  return output;
}

async function buildPackedSurface(material: TerrainMaterialConfig): Promise<string> {
  const materialRoot = path.join(sourceRoot, material.asset);
  const normal = path.join(materialRoot, 'normal.jpg');
  const channels = await Promise.all([
    extractChannel(normal, 'R', `${material.asset}-normal-x.png`),
    extractChannel(normal, 'G', `${material.asset}-normal-y.png`),
    extractChannel(path.join(materialRoot, 'height.jpg'), 'R', `${material.asset}-height.png`),
    extractChannel(path.join(materialRoot, 'roughness.jpg'), 'R', `${material.asset}-roughness.png`),
  ]);
  const output = path.join(tempRoot, `${material.asset}-surface-source.png`);
  await runMagick([...channels, '-combine', output]);
  return output;
}

async function extractChannel(source: string, channel: 'R' | 'G', filename: string): Promise<string> {
  const output = path.join(tempRoot, filename);
  await runMagick([source, '-alpha', 'off', '-channel', channel, '-separate', '+channel', output]);
  return output;
}

async function buildFillerCell(mapName: AtlasMap, cellSize: number): Promise<string> {
  const output = path.join(tempRoot, `filler-${mapName}-${cellSize}.png`);
  const color = mapName === 'surface' ? '#8080ffff' : '#000000';
  await runMagick(['-size', `${cellSize}x${cellSize}`, `xc:${color}`, output]);
  return output;
}

async function validateMaps(materials: readonly TerrainMaterialConfig[]): Promise<void> {
  if (materials.length !== 8) throw new Error('The terrain palette requires exactly eight Poly Haven materials.');
  for (const material of materials) {
    for (const mapName of ['basecolor.jpg', 'normal.jpg', 'height.jpg', 'roughness.jpg']) {
      const dimensions = await runMagick([
        'identify',
        '-quiet',
        '-format',
        '%wx%h',
        path.join(sourceRoot, material.asset, mapName),
      ]);
      if (dimensions !== '1024x1024') {
        throw new Error(`${material.asset}/${mapName} must be an official 1K source map.`);
      }
    }
  }
}

function toRuntimePath(url: string): string {
  return path.join(repoRoot, 'public', url.replace(/^\//, ''));
}

async function runMagick(arguments_: readonly string[]): Promise<string> {
  const process = Bun.spawn(['magick', ...arguments_], { stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) throw new Error(`ImageMagick failed: ${stderr.trim()}`);
  return stdout;
}
