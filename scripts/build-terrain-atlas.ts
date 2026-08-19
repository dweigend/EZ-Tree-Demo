/**
 * Builds fixed 3x3 desktop and PICO atlases from the eight local Poly Haven materials.
 * Source downloads stay reproducible through the manifest; runtime receives albedo plus packed normal/roughness atlases.
 */

import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

interface MaterialSource {
  readonly slot: string;
  readonly asset: string;
  readonly name: string;
  readonly author: string;
  readonly tileMeters: number;
}

interface MaterialManifest {
  readonly license: string;
  readonly licenseUrl: string;
  readonly materials: readonly MaterialSource[];
}

type AtlasMap = 'albedo' | 'surface';

interface AtlasJob {
  readonly materials: readonly MaterialSource[];
  readonly map: AtlasMap;
  readonly atlasSize: number;
  readonly output: string;
}

interface CellJob {
  readonly material: MaterialSource;
  readonly map: AtlasMap;
  readonly cellSize: number;
  readonly contentSize: number;
}

const ATLAS_COLUMNS = 3;
const ATLAS_GUTTER = 8;
const ATLAS_PROFILES = { desktop: 3_072, pico90: 1_536 } as const;
const repoRoot = path.resolve(import.meta.dir, '..');
const sourceRoot = path.join(repoRoot, 'assets/source/terrain-materials/polyhaven');
const runtimeRoot = path.join(repoRoot, 'public/assets/terrain');
const manifest = await readManifest(path.join(repoRoot, 'assets/source/terrain-materials/polyhaven.json'));
const tempRoot = await mkdtemp(path.join(tmpdir(), 'terrain-atlas-'));

try {
  await validateMaps(manifest.materials);
  for (const [profile, atlasSize] of Object.entries(ATLAS_PROFILES)) {
    await buildProfileAtlas(profile, atlasSize, manifest.materials);
  }
  await writePaletteMetadata(manifest);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function buildProfileAtlas(
  profile: string,
  atlasSize: number,
  materials: readonly MaterialSource[],
): Promise<void> {
  const profileRoot = path.join(runtimeRoot, profile === 'desktop' ? 'palette-desktop' : 'palette-pico');
  await mkdir(profileRoot, { recursive: true });
  await buildAtlas({ materials, map: 'albedo', atlasSize, output: path.join(profileRoot, 'albedo.webp') });
  await buildAtlas({ materials, map: 'surface', atlasSize, output: path.join(profileRoot, 'normal.webp') });
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
  const options = job.output.endsWith('.webp') ? ['-quality', '88'] : ['-define', 'png:compression-level=9'];
  await runMagick([...rows, '-append', ...options, job.output]);
}

async function buildCell(job: CellJob): Promise<string> {
  const materialRoot = path.join(sourceRoot, job.material.asset);
  const sources =
    job.map === 'albedo'
      ? [path.join(materialRoot, 'basecolor.jpg')]
      : [
          path.join(materialRoot, 'normal.jpg'),
          path.join(materialRoot, 'roughness.jpg'),
          '-alpha',
          'off',
          '-compose',
          'CopyOpacity',
          '-composite',
        ];
  const output = path.join(tempRoot, `${job.material.asset}-${job.map}-${job.cellSize}.png`);
  await runMagick([
    ...sources,
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

async function buildFillerCell(mapName: AtlasMap, cellSize: number): Promise<string> {
  const output = path.join(tempRoot, `filler-${mapName}-${cellSize}.png`);
  const color = mapName === 'surface' ? '#8080ffff' : '#000000';
  await runMagick(['-size', `${cellSize}x${cellSize}`, `xc:${color}`, output]);
  return output;
}

async function writePaletteMetadata(source: MaterialManifest): Promise<void> {
  const metadata = {
    slots: source.materials.map(({ slot, asset, name, author }) => ({ slot, source: asset, name, author })),
    tileMeters: source.materials.map((material) => material.tileMeters),
    atlasColumns: ATLAS_COLUMNS,
    atlasSize: ATLAS_PROFILES,
    gutterPixels: ATLAS_GUTTER,
    surfaceEncoding: 'normal-rgb-roughness-a',
    license: source.license,
    licenseUrl: source.licenseUrl,
  };
  await Bun.write(path.join(runtimeRoot, 'palette.json'), `${JSON.stringify(metadata, null, 2)}\n`);
}

async function validateMaps(materials: readonly MaterialSource[]): Promise<void> {
  if (materials.length !== 8) throw new Error('The terrain palette requires exactly eight Poly Haven materials.');
  for (const material of materials) {
    for (const mapName of ['basecolor.jpg', 'normal.jpg', 'roughness.jpg']) {
      await runMagick(['identify', '-quiet', path.join(sourceRoot, material.asset, mapName)]);
    }
  }
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

async function readManifest(file: string): Promise<MaterialManifest> {
  return (await Bun.file(file).json()) as MaterialManifest;
}
