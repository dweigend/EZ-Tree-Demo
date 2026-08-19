/**
 * Schedules one low-frequency tree worker job at a time and stages successful near geometry for TreeSystem.
 * Worker failures keep the current variants intact; generation never falls back to the main thread.
 */

import { VARIANT_GENERATION } from '../config';
import { hashCoordinates } from '../core/random';
import { deserializeGeometry } from './tree-geometry';
import {
  createVariedTreePreset,
  TREE_PRESET_CATALOG,
  type TreePresetId,
  type TreeTemplate,
} from './tree-templates';
import type {
  TreeVariantRequest,
  TreeVariantResponse,
  TreeVariantSlot,
  TreeVariantSuccess,
} from './tree-variant-contract';

export interface GeneratedVariantUpdate {
  readonly slot: TreeVariantSlot;
  readonly presetId: TreeTemplate['id'];
  readonly height: number;
  readonly leaves: ReturnType<typeof deserializeGeometry>;
}

export interface TreeVariantGeneratorDiagnostics {
  readonly generatedVariants: number;
  readonly pendingVariantJobs: number;
  readonly lastVariantGenerationMs: number;
}

const VARIANT_ORDER = [
  'ash-small', 'aspen-small', 'oak-small', 'pine-small', 'bush-1',
  'ash-medium', 'aspen-medium', 'oak-medium', 'pine-medium', 'bush-2',
  'ash-large', 'aspen-large', 'oak-large', 'pine-large', 'bush-3', 'trellis',
] as const satisfies readonly TreePresetId[];
const VARIANT_SEQUENCE = VARIANT_ORDER.map((id) => requireTemplate(id));

export class TreeVariantGenerator {
  public generatedVariants = 0;
  public pendingVariantJobs = 0;
  public lastVariantGenerationMs = 0;
  private worker: Worker | null = null;
  private timer: number | null = null;
  private requestId = 0;
  private templateIndex = 0;
  private disposed = false;

  public constructor(
    private readonly seed: number,
    private readonly onVariant: (update: GeneratedVariantUpdate) => void,
  ) {}

  public start(): void {
    if (this.worker || this.disposed) return;
    this.worker = new Worker(new URL('./tree-variant-worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;
    this.worker.onerror = this.handleWorkerError;
    this.schedule(VARIANT_GENERATION.initialDelayMs);
  }

  public get diagnostics(): TreeVariantGeneratorDiagnostics {
    return {
      generatedVariants: this.generatedVariants,
      pendingVariantJobs: this.pendingVariantJobs,
      lastVariantGenerationMs: this.lastVariantGenerationMs,
    };
  }

  public dispose(): void {
    this.disposed = true;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.worker?.terminate();
    this.worker = null;
    this.timer = null;
    this.pendingVariantJobs = 0;
  }

  private schedule(delayMs: number): void {
    if (this.disposed || !this.worker) return;
    this.timer = window.setTimeout(() => this.requestNextVariant(), delayMs);
  }

  private requestNextVariant(): void {
    const worker = this.worker;
    const template = VARIANT_SEQUENCE[this.templateIndex];
    if (!worker || !template || this.pendingVariantJobs > 0) return;
    this.templateIndex = (this.templateIndex + 1) % VARIANT_SEQUENCE.length;
    this.requestId += 1;
    const seed = 1 + (hashCoordinates(this.seed, this.requestId, this.templateIndex) % 65_534);
    const request: TreeVariantRequest = {
      type: 'generate',
      requestId: this.requestId,
      slot: getTemplateSlot(template),
      presetId: template.id,
      height: template.height,
      preset: createVariedTreePreset(template, seed),
      seed,
    };
    this.pendingVariantJobs = 1;
    worker.postMessage(request);
  }

  private readonly handleMessage = (event: MessageEvent<TreeVariantResponse>): void => {
    if (this.disposed || event.data.requestId !== this.requestId) return;
    this.pendingVariantJobs = 0;
    if (event.data.type === 'generated') this.acceptVariant(event.data);
    this.schedule(VARIANT_GENERATION.intervalMs);
  };

  private acceptVariant(response: TreeVariantSuccess): void {
    this.generatedVariants += 1;
    this.lastVariantGenerationMs = Number(response.generationMs.toFixed(1));
    this.onVariant({
      slot: response.slot,
      presetId: response.presetId,
      height: response.height,
      leaves: deserializeGeometry(response.lods.near.leaves),
    });
  }

  private readonly handleWorkerError = (event: ErrorEvent): void => {
    event.preventDefault();
    this.pendingVariantJobs = 0;
    this.worker?.terminate();
    this.worker = null;
  };
}

function getTemplateSlot(template: TreeTemplate): TreeVariantSlot {
  return template.kind === 'hedge' ? 'hedge' : template.species;
}

function requireTemplate(id: TreePresetId): TreeTemplate {
  const template = TREE_PRESET_CATALOG.find((candidate) => candidate.id === id);
  if (!template) throw new Error(`Missing background tree preset: ${id}`);
  return template;
}
