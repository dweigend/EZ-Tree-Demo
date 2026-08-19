/**
 * Generates official skeleton-based EZ-Tree LOD variants off the main thread and transfers raw buffers.
 * Presets remain texture-free in the worker; materials and maps stay owned by the main rendering thread.
 */

import { Tree } from '@dgreenheck/ez-tree';
import { createHedgeLods, createTreeLods, disposeTreeLods, getTransferables, serializeTreeLods } from './tree-geometry';
import type { TreeVariantRequest, TreeVariantResponse, TreeVariantSuccess } from './tree-variant-contract';

interface WorkerScope {
  onmessage: ((event: MessageEvent<TreeVariantRequest>) => void) | null;
  postMessage(message: TreeVariantResponse, transfer?: Transferable[]): void;
}

const workerScope = self as unknown as WorkerScope;

workerScope.onmessage = (event): void => {
  generateVariant(event.data);
};

function generateVariant(request: TreeVariantRequest): void {
  const startedAt = performance.now();
  try {
    const tree = new Tree();
    tree.options.copy(request.preset as Tree['options']);
    const lods = request.isHedge ? createHedgeLods(tree) : createTreeLods(tree);
    tree.clear();
    const serialized = serializeTreeLods(lods);
    const response: TreeVariantSuccess = {
      type: 'generated',
      requestId: request.requestId,
      slot: request.slot,
      presetId: request.presetId,
      height: request.height,
      generationMs: performance.now() - startedAt,
      lods: serialized,
    };
    workerScope.postMessage(response, getTransferables(serialized));
    disposeTreeLods(lods);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown tree worker failure';
    workerScope.postMessage({ type: 'failed', requestId: request.requestId, message });
  }
}
