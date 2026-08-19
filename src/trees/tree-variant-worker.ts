/**
 * Generates bounded EZ-Tree variants off the main thread and returns transferable geometry buffers.
 * The document shim only satisfies EZ-Tree's eager TextureLoader setup; worker materials are discarded.
 */

import type { BufferGeometry, Material } from 'three';
import { createHedgeLods, createTreeLods, disposeTreeLods, getTransferables, normaliseTreeGeometry, serializeTreeLods } from './tree-geometry';
import type { TreeVariantRequest, TreeVariantResponse, TreeVariantSuccess } from './tree-variant-contract';

interface GeneratedTree {
  readonly branchesMesh: { readonly geometry: BufferGeometry; readonly material: Material | Material[] };
  readonly leavesMesh: { readonly geometry: BufferGeometry; readonly material: Material | Material[] };
  generate(): void;
  clear(): void;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<TreeVariantRequest>) => void) | null;
  postMessage(message: TreeVariantResponse, transfer?: Transferable[]): void;
}

const workerScope = self as unknown as WorkerScope;
installEzTreeDocumentShim();
const ezTreeModule = import('@dgreenheck/ez-tree');

workerScope.onmessage = (event): void => {
  void generateVariant(event.data);
};

async function generateVariant(request: TreeVariantRequest): Promise<void> {
  const startedAt = performance.now();
  try {
    const module = await ezTreeModule;
    const TreeConstructor = module.Tree as unknown as new (options: unknown) => GeneratedTree;
    const tree = new TreeConstructor(request.preset);
    tree.generate();
    const nearSource = normaliseTreeGeometry(tree.branchesMesh.geometry, tree.leavesMesh.geometry);
    const lods = request.slot === 'hedge' ? createHedgeLods(nearSource) : createTreeLods(nearSource);
    disposeGeneratedTree(tree);
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

function installEzTreeDocumentShim(): void {
  if ('document' in globalThis) return;
  Object.defineProperty(globalThis, 'document', {
    value: {
      createElementNS: (): EventTarget => new EventTarget(),
    },
  });
}

function disposeGeneratedTree(tree: GeneratedTree): void {
  tree.branchesMesh.geometry.dispose();
  tree.leavesMesh.geometry.dispose();
  disposeMaterials(tree.branchesMesh.material);
  disposeMaterials(tree.leavesMesh.material);
  tree.clear();
}

function disposeMaterials(material: Material | Material[]): void {
  for (const entry of Array.isArray(material) ? material : [material]) entry.dispose();
}
