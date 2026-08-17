/**
 * Deterministic, continuous landscape height and biome sampling.
 * Domain-warped multi-scale Three.js noise creates macro landforms without owning any meshes.
 */

import { MathUtils, Vector3 } from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { hashString } from '../core/random';

const SURFACE_SAMPLE_DISTANCE = 3;

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
    const warpX = this.fbm(x * 0.00072 + 31, z * 0.00072 - 19, 3) * 215;
    const warpZ = this.fbm(x * 0.00072 - 47, z * 0.00072 + 23, 3) * 215;
    const warpedX = x + warpX;
    const warpedZ = z + warpZ;
    const continental = this.fbm(warpedX * 0.00062, warpedZ * 0.00062, 4);
    const mountainMask = MathUtils.smoothstep(continental, -0.18, 0.48);
    const ridges = this.ridgedFbm(warpedX * 0.00145, warpedZ * 0.00145, 4);
    const plains = MathUtils.smoothstep(this.fbm(x * 0.00038, z * 0.00038, 3), 0.18, 0.64);
    const hills = this.fbm(warpedX * 0.0034, warpedZ * 0.0034, 4) * 31;
    const valley = this.getValleyDepth(warpedX, warpedZ);
    return continental * 24 + mountainMask * ridges ** 2.25 * 178 + hills * (1 - plains * 0.72) - valley;
  }

  public getSlope(x: number, z: number): number {
    const step = SURFACE_SAMPLE_DISTANCE;
    const dx = this.getHeight(x + step, z) - this.getHeight(x - step, z);
    const dz = this.getHeight(x, z + step) - this.getHeight(x, z - step);
    return Math.hypot(dx, dz) / (step * 2);
  }

  public getNormal(x: number, z: number, target: Vector3): Vector3 {
    const step = SURFACE_SAMPLE_DISTANCE;
    const dx = this.getHeight(x + step, z) - this.getHeight(x - step, z);
    const dz = this.getHeight(x, z + step) - this.getHeight(x, z - step);
    return target.set(-dx, step * 2, -dz).normalize();
  }

  public getMoisture(x: number, z: number, height = this.getHeight(x, z)): number {
    const broad = this.fbm(x * 0.0011 + 81, z * 0.0011 - 57, 3) * 0.5 + 0.5;
    const drainage = 1 - MathUtils.smoothstep(height, 92, 205);
    return MathUtils.clamp(broad * 0.72 + drainage * 0.28, 0, 1);
  }

  public getGroundCover(x: number, z: number, moisture: number): number {
    const meadow = this.fbm((x - 210) * 0.0052, (z + 80) * 0.0052, 2) * 0.5 + 0.5;
    return MathUtils.clamp(meadow * 0.66 + moisture * 0.34, 0, 1);
  }

  public getNoise(x: number, z: number, scale: number, octaves = 3): number {
    return this.fbm(x * scale, z * scale, octaves);
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
