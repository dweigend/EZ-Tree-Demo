/**
 * Guards the centralized landscape catalog against missing runtime/source mirrors and legacy delivery paths.
 */

import { expect, test } from 'bun:test';
import { LANDSCAPE_ASSET_CATALOG } from '../src/assets/landscape-asset-catalog';

test('every tree and model catalog entry has a source and runtime file', async () => {
  const runtimeUrls = [
    ...Object.values(LANDSCAPE_ASSET_CATALOG.trees.bark).flatMap((asset) => Object.values(asset)),
    ...Object.values(LANDSCAPE_ASSET_CATALOG.trees.leaves),
    LANDSCAPE_ASSET_CATALOG.models.meadowPatch,
    LANDSCAPE_ASSET_CATALOG.models.grassTuft,
    ...LANDSCAPE_ASSET_CATALOG.models.rocks,
  ];
  for (const url of runtimeUrls) {
    const runtimePath = `public${url}`;
    const sourcePath = runtimePath.replace('public/assets/landscape', 'assets/source/landscape');
    expect(await Bun.file(runtimePath).exists()).toBe(true);
    expect(await Bun.file(sourcePath).exists()).toBe(true);
  }
});

test('legacy asset roots and Draco decoder are not shipped', async () => {
  for (const path of [
    'public/assets/draco/draco_decoder.wasm',
    'public/assets/rocks/rock1.glb',
    'public/assets/terrain/grass.jpg',
    'public/assets/trees/leaves/oak.png',
    'public/assets/vegetation/grass-patch.glb',
  ]) {
    expect(await Bun.file(path).exists()).toBe(false);
  }
});

test('the five delivered GLBs do not require Draco', async () => {
  const modelUrls = [
    LANDSCAPE_ASSET_CATALOG.models.meadowPatch,
    LANDSCAPE_ASSET_CATALOG.models.grassTuft,
    ...LANDSCAPE_ASSET_CATALOG.models.rocks,
  ];
  for (const url of modelUrls) {
    const document = await readGlbDocument(`public${url}`);
    expect(document.extensionsUsed ?? []).not.toContain('KHR_draco_mesh_compression');
  }
});

interface GlbDocument {
  readonly extensionsUsed?: readonly string[];
}

async function readGlbDocument(path: string): Promise<GlbDocument> {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  const json = new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)).replace(/\0+$/, '');
  return JSON.parse(json) as GlbDocument;
}
