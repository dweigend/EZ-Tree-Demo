/**
 * Deterministic hashing and pseudo-random helpers for world generation.
 * All spatial content derives from stable integer or string seeds; no Math.random is used.
 */

export function hashString(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function hashCoordinates(seed: number, x: number, z: number, salt = 0): number {
  let hash = seed ^ Math.imul(x, 374_761_393) ^ Math.imul(z, 668_265_263) ^ salt;
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function unitRandom(hash: number): number {
  return hash / 4_294_967_295;
}

export function signedRandom(hash: number): number {
  return unitRandom(hash) * 2 - 1;
}
