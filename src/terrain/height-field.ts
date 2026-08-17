/**
 * Deterministic, continuous landscape height and biome sampling.
 * Domain-warped multi-scale Three.js noise creates macro landforms without owning any meshes.
 */

import { MathUtils } from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { hashString } from '../core/random';

export interface SurfaceSample {
  readonly height: number;
  readonly moisture: number;
  readonly slope: number;
}

export class HeightField {
  private readonly noise = new ImprovedNoise();
  private readonly offsetX: number;
  private readonly offsetZ: number;

  public constructor(seed: string) {
    const hash = hashString(seed);
    this.offsetX = (hash & 0xffff) * 0.73;
    this.offsetZ = ((hash >>> 16) & 0xffff) * 0.91;
  }

  public getHeight(x: number, z: number): number {
    const warped = this.getWarpedCoordinates(x, z);
    const continental = this.fbm(warped.x * 0.00062, warped.z * 0.00062, 4);
    const mountainMask = MathUtils.smoothstep(continental, -0.18, 0.48);
    const ridges = this.ridgedFbm(warped.x * 0.00145, warped.z * 0.00145, 4);
    const plains = MathUtils.smoothstep(this.fbm(x * 0.00038, z * 0.00038, 3), 0.18, 0.64);
    const hills = this.fbm(warped.x * 0.0034, warped.z * 0.0034, 4) * 31;
    const valley = this.getValleyDepth(warped.x, warped.z);
    return continental * 24 + mountainMask * ridges ** 2.25 * 178 + hills * (1 - plains * 0.72) - valley;
  }

  public getSurface(x: number, z: number): SurfaceSample {
    const step = 3;
    const height = this.getHeight(x, z);
    const dx = (this.getHeight(x + step, z) - this.getHeight(x - step, z)) / (step * 2);
    const dz = (this.getHeight(x, z + step) - this.getHeight(x, z - step)) / (step * 2);
    return { height, slope: Math.hypot(dx, dz), moisture: this.getMoisture(x, z, height) };
  }

  public getMoisture(x: number, z: number, height = this.getHeight(x, z)): number {
    const broad = this.fbm(x * 0.0011 + 81, z * 0.0011 - 57, 3) * 0.5 + 0.5;
    const drainage = 1 - MathUtils.smoothstep(height, 92, 205);
    return MathUtils.clamp(broad * 0.72 + drainage * 0.28, 0, 1);
  }

  public getNoise(x: number, z: number, scale: number, octaves = 3): number {
    return this.fbm(x * scale, z * scale, octaves);
  }

  private getWarpedCoordinates(x: number, z: number): { readonly x: number; readonly z: number } {
    const warpX = this.fbm(x * 0.00072 + 31, z * 0.00072 - 19, 3) * 215;
    const warpZ = this.fbm(x * 0.00072 - 47, z * 0.00072 + 23, 3) * 215;
    return { x: x + warpX, z: z + warpZ };
  }

  private getValleyDepth(x: number, z: number): number {
    const channel = Math.abs(this.fbm(x * 0.00105 + 103, z * 0.00105 - 71, 3));
    const valleyMask = 1 - MathUtils.smoothstep(channel, 0.02, 0.22);
    return valleyMask * 34;
  }

  private fbm(x: number, z: number, octaves: number): number {
    let amplitude = 0.55;
    let frequency = 1;
    let value = 0;
    let weight = 0;
    for (let octave = 0; octave < octaves; octave += 1) {
      value += this.sample(x * frequency, z * frequency) * amplitude;
      weight += amplitude;
      amplitude *= 0.5;
      frequency *= 2.03;
    }
    return value / weight;
  }

  private ridgedFbm(x: number, z: number, octaves: number): number {
    let amplitude = 0.58;
    let frequency = 1;
    let value = 0;
    let weight = 0;
    for (let octave = 0; octave < octaves; octave += 1) {
      value += (1 - Math.abs(this.sample(x * frequency, z * frequency))) * amplitude;
      weight += amplitude;
      amplitude *= 0.48;
      frequency *= 2.07;
    }
    return value / weight;
  }

  private sample(x: number, z: number): number {
    return this.noise.noise(x + this.offsetX, 0.37, z + this.offsetZ);
  }
}
