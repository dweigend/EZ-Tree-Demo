/**
 * Generates the ten terrain PBR candidates through Fal PATINA from GPT reference images.
 * This offline script validates credentials and outputs; it is never imported by the browser runtime.
 */

import { fal } from '@fal-ai/client';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

interface MaterialJob {
  readonly id: string;
  readonly out: string;
  readonly patina_prompt: string;
  readonly material_seed: number;
}

interface PatinaImage {
  readonly url: string;
  readonly map_type?: string;
}

interface PatinaResult {
  readonly images: readonly PatinaImage[];
  readonly prompt?: string;
  readonly seed?: number;
}

const REQUIRED_MAPS = ['basecolor', 'normal', 'roughness'] as const;

const repoRoot = path.resolve(import.meta.dir, '..');
const sourceRoot = path.join(repoRoot, 'assets/source/landscape/terrain-materials');
const outputRoot = path.join(repoRoot, 'output/materials');
const jobs = await readJobs(path.join(sourceRoot, 'prompts.jsonl'));
const falKey = process.env.FAL_KEY;

if (!falKey) throw new Error('FAL_KEY is required for PATINA generation.');
fal.config({ credentials: falKey });
await mkdir(outputRoot, { recursive: true });

for (const job of jobs) await generateMaterial(job);

async function generateMaterial(job: MaterialJob): Promise<void> {
  const referencePath = path.join(sourceRoot, 'references', job.out);
  if (!(await Bun.file(referencePath).exists())) throw new Error(`Missing GPT reference: ${referencePath}`);
  const imageUrl = await fal.storage.upload(Bun.file(referencePath));
  const result = await fal.subscribe('fal-ai/patina/material', {
    input: createPatinaInput(job, imageUrl),
  });
  const data = validatePatinaResult(result.data, job.id);
  const jobOutput = path.join(outputRoot, job.id);
  await mkdir(jobOutput, { recursive: true });
  const resultPath = path.join(jobOutput, 'fal-result.json');
  await Bun.write(resultPath, `${JSON.stringify(data, null, 2)}\n`);
  await savePatinaOutputs(resultPath, jobOutput, job.patina_prompt);
}

function createPatinaInput(job: MaterialJob, imageUrl: string): Record<string, unknown> {
  return {
    prompt: job.patina_prompt,
    image_url: imageUrl,
    strength: 0.6,
    maps: ['basecolor', 'normal', 'roughness'],
    tiling_mode: 'both',
    image_size: 'square_hd',
    tile_size: 128,
    tile_stride: 64,
    num_inference_steps: 8,
    enable_prompt_expansion: false,
    upscale_factor: 0,
    output_format: 'png',
    seed: job.material_seed,
  };
}

function validatePatinaResult(value: unknown, id: string): PatinaResult {
  if (!isPatinaResult(value)) throw new Error(`PATINA returned no result for ${id}.`);
  const candidate = value as Partial<PatinaResult>;
  const mapTypes = new Set(candidate.images?.map((image) => image.map_type));
  const missingMap = REQUIRED_MAPS.find((map) => !mapTypes.has(map));
  if (missingMap) throw new Error(`PATINA result for ${id} is missing ${missingMap}.`);
  return candidate as PatinaResult;
}

function isPatinaResult(value: unknown): value is Partial<PatinaResult> {
  return Boolean(value) && typeof value === 'object';
}

async function savePatinaOutputs(resultPath: string, output: string, prompt: string): Promise<void> {
  const helper = '/Users/weigend/.codex/skills/texture-material-maker/scripts/save_patina_outputs.py';
  const process = Bun.spawn(['python3', helper, '--result', resultPath, '--out-dir', output, '--prompt', prompt], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if ((await process.exited) !== 0) throw new Error(`Could not save PATINA outputs in ${output}.`);
}

async function readJobs(filePath: string): Promise<MaterialJob[]> {
  const lines = (await Bun.file(filePath).text()).split('\n').filter(Boolean);
  return lines.map((line) => JSON.parse(line) as MaterialJob);
}
