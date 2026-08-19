/**
 * Defines structured-clone-safe messages and typed geometry buffers for background tree generation.
 * Runtime materials and Three.js objects deliberately stay on the main thread.
 */

import type { TreePresetData, TreePresetId } from './tree-templates';

export type TreeVariantSlot = TreePresetId | 'hedge';

export interface SerializedGeometry {
  readonly position: Float32Array;
  readonly normal: Float32Array;
  readonly uv: Float32Array;
  readonly index: Uint16Array | Uint32Array;
}

export interface SerializedGeometryPair {
  readonly branches: SerializedGeometry;
  readonly leaves: SerializedGeometry;
}

export interface SerializedTreeLods {
  readonly near: SerializedGeometryPair;
  readonly middle: SerializedGeometryPair;
  readonly far: SerializedGeometryPair;
}

export interface TreeVariantRequest {
  readonly type: 'generate';
  readonly requestId: number;
  readonly slot: TreeVariantSlot;
  readonly presetId: TreePresetId;
  readonly height: number;
  readonly preset: TreePresetData;
  readonly seed: number;
}

export interface TreeVariantSuccess {
  readonly type: 'generated';
  readonly requestId: number;
  readonly slot: TreeVariantSlot;
  readonly presetId: TreePresetId;
  readonly height: number;
  readonly generationMs: number;
  readonly lods: SerializedTreeLods;
}

export interface TreeVariantFailure {
  readonly type: 'failed';
  readonly requestId: number;
  readonly message: string;
}

export type TreeVariantResponse = TreeVariantSuccess | TreeVariantFailure;
