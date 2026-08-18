/**
 * Validates the four selected PATINA materials and packs desktop/PICO terrain atlases.
 * ImageMagick performs deterministic gutter expansion, atlas packing, and roughness analysis offline.
 */

import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

interface MaterialJob {
  readonly id: string;
  readonly slot: 'meadow' | 'valley' | 'forest' | 'exposed';
  readonly winner: boolean;
}

const SLOT_ORDER = ['meadow', 'valley', 'forest', 'exposed'] as const;
const ATLAS_PROFILES = { desktop: 2_048, pico90: 1_024 } as const;
const repoRoot = path.resolve(import.meta.dir, '..');
const outputRoot = path.join(repoRoot, 'output/materials');
const runtimeRoot = path.join(repoRoot, 'public/assets/terrain');
const jobs = await readJobs(path.join(repoRoot, 'assets/source/terrain-materials/prompts.jsonl'));
const winners = selectWinners(jobs);
const tempRoot = await mkdtemp(path.join(tmpdir(), 'terrain-atlas-'));

try {
  await validateWinnerMaps(winners);
  for (const [profile, atlasSize] of Object.entries(ATLAS_PROFILES)) {
    await buildProfileAtlas(profile, atlasSize, winners);
  }
  await writePaletteMetadata(winners);
  await buildContactSheet(jobs);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function buildProfileAtlas(profile: string, atlasSize: number, selected: readonly MaterialJob[]): Promise<void> {
  const profileRoot = path.join(runtimeRoot, profile === 'desktop' ? 'palette-desktop' : 'palette-pico');
  await mkdir(profileRoot, { recursive: true });
  await buildAtlas(selected, 'basecolor.png', atlasSize, path.join(profileRoot, 'albedo.webp'));
  await buildAtlas(selected, 'normal.png', atlasSize, path.join(profileRoot, 'normal.png'));
}

async function buildAtlas(selected: readonly MaterialJob[], mapName: string, atlasSize: number, output: string): Promise<void> {
  const cellSize = atlasSize / 2;
  const contentSize = cellSize - 16;
  const cells: string[] = [];
  for (const job of selected) {
    const source = path.join(outputRoot, job.id, mapName);
    const cell = path.join(tempRoot, `${path.basename(output)}-${job.id}.png`);
    await runMagick([source, '-resize', `${contentSize}x${contentSize}!`, '-virtual-pixel', 'tile', '-set', 'option:distort:viewport', `${cellSize}x${cellSize}-8-8`, '-filter', 'point', '-distort', 'SRT', '0', '+repage', cell]);
    cells.push(cell);
  }
  const rowTop = path.join(tempRoot, `${path.basename(output)}-top.png`);
  const rowBottom = path.join(tempRoot, `${path.basename(output)}-bottom.png`);
  await runMagick([cells[0]!, cells[1]!, '+append', rowTop]);
  await runMagick([cells[2]!, cells[3]!, '+append', rowBottom]);
  const options = output.endsWith('.webp') ? ['-quality', '88'] : ['-define', 'png:compression-level=9'];
  await runMagick([rowTop, rowBottom, '-append', ...options, output]);
}

async function writePaletteMetadata(selected: readonly MaterialJob[]): Promise<void> {
  const roughness = await Promise.all(selected.map((job) => readMedianRoughness(path.join(outputRoot, job.id, 'roughness.png'))));
  const metadata = {
    slots: selected.map((job) => ({ slot: job.slot, source: job.id })),
    roughness,
    atlasSize: { desktop: ATLAS_PROFILES.desktop, pico90: ATLAS_PROFILES.pico90 },
    gutterPixels: 8,
  };
  await Bun.write(path.join(runtimeRoot, 'palette.json'), `${JSON.stringify(metadata, null, 2)}\n`);
}

async function buildContactSheet(jobs: readonly MaterialJob[]): Promise<void> {
  const available = jobs.map((job) => path.join(outputRoot, job.id, 'basecolor.png'));
  if (!(await Promise.all(available.map((file) => Bun.file(file).exists()))).every(Boolean)) return;
  await runMagick(['montage', ...available, '-thumbnail', '320x320', '-tile', '5x2', '-geometry', '+8+8', path.join(outputRoot, 'contact-sheet.webp')]);
}

async function validateWinnerMaps(selected: readonly MaterialJob[]): Promise<void> {
  for (const job of selected) {
    for (const mapName of ['basecolor.png', 'normal.png', 'roughness.png']) {
      const file = path.join(outputRoot, job.id, mapName);
      if (!(await Bun.file(file).exists())) throw new Error(`Missing PATINA winner map: ${file}`);
      await runMagick(['identify', '-quiet', file]);
    }
  }
}

function selectWinners(jobs: readonly MaterialJob[]): MaterialJob[] {
  const winners = SLOT_ORDER.map((slot) => jobs.find((job) => job.slot === slot && job.winner));
  if (winners.some((job) => !job)) throw new Error('Exactly one selected material is required for every terrain slot.');
  return winners as MaterialJob[];
}

async function readMedianRoughness(file: string): Promise<number> {
  const value = await runMagick([file, '-colorspace', 'Gray', '-format', '%[fx:median]', 'info:']);
  return Number(Number(value.trim()).toFixed(4));
}

async function runMagick(arguments_: readonly string[]): Promise<string> {
  const process = Bun.spawn(['magick', ...arguments_], { stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, exitCode] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);
  if (exitCode !== 0) throw new Error(`ImageMagick failed: ${stderr.trim()}`);
  return stdout;
}

async function readJobs(filePath: string): Promise<MaterialJob[]> {
  return (await Bun.file(filePath).text()).split('\n').filter(Boolean).map((line) => JSON.parse(line) as MaterialJob);
}
