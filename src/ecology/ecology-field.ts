/**
 * Shared deterministic ecology field for all CPU placement decisions.
 * It maps world-space terrain samples to coherent habitat masks; rendering stays in the owning systems.
 */

import { MathUtils } from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { hashCoordinates, hashString, signedRandom, unitRandom } from '../core/random';

export interface TerrainSite {
  readonly x: number;
  readonly z: number;
  readonly height: number;
  readonly slope: number;
  readonly moisture: number;
}

export interface EcologySample {
  forest: number;
  meadow: number;
  rock: number;
  hedge: number;
  lake: number;
}

export type MacroFeatureKind = 'none' | 'hedge' | 'lake';

export interface MacroFeatureSample {
  kind: MacroFeatureKind;
  influence: number;
  centerX: number;
  centerZ: number;
  rotation: number;
  length: number;
  width: number;
}

interface HabitatNoise {
  broadForest: number;
  forestDetail: number;
  broadMeadow: number;
  meadowDetail: number;
  rock: number;
}

const MACRO_CELL_SIZE = 800;
const FEATURE_INSET = 160;
const LAKE_PROBABILITY = 0.12;
const HEDGE_PROBABILITY = 0.34;

export class EcologyField {
  private readonly noise = new ImprovedNoise();
  private readonly seed: number;
  private readonly offsetX: number;
  private readonly offsetZ: number;
  private readonly featureSample = createMacroFeatureSample();
  private readonly habitatNoise: HabitatNoise = {
    broadForest: 0,
    forestDetail: 0,
    broadMeadow: 0,
    meadowDetail: 0,
    rock: 0,
  };

  public constructor(seed: string) {
    this.seed = hashString(`${seed}:ecology`);
    this.offsetX = (this.seed & 0xffff) * 0.31;
    this.offsetZ = ((this.seed >>> 16) & 0xffff) * 0.47;
  }

  public sample(site: TerrainSite, target: EcologySample): EcologySample {
    this.sampleContinuousHabitat(site, target);
    const feature = this.sampleMacroFeature(site.x, site.z, this.featureSample);
    const lakeExclusion = 1 - feature.influence * Number(feature.kind === 'lake');
    const hedgeExclusion = 1 - feature.influence * 0.82 * Number(feature.kind === 'hedge');
    target.forest *= lakeExclusion * hedgeExclusion;
    target.meadow *= lakeExclusion;
    target.rock *= lakeExclusion;
    target.hedge = feature.kind === 'hedge' ? feature.influence : 0;
    target.lake = feature.kind === 'lake' ? feature.influence : 0;
    return target;
  }

  public sampleMacroFeature(x: number, z: number, target: MacroFeatureSample): MacroFeatureSample {
    const cellX = Math.floor(x / MACRO_CELL_SIZE);
    const cellZ = Math.floor(z / MACRO_CELL_SIZE);
    const hash = hashCoordinates(this.seed, cellX, cellZ, 0x43a7);
    this.writeFeatureGeometry(cellX, cellZ, hash, target);
    target.kind = getFeatureKind(unitRandom(hash));
    target.influence = this.getFeatureInfluence(x, z, target);
    return target;
  }

  private sampleContinuousHabitat(site: TerrainSite, target: EcologySample): void {
    const noise = this.habitatNoise;
    noise.broadForest = remapNoise(this.fbm(site.x * 0.00125, site.z * 0.00125, 3));
    noise.forestDetail = remapNoise(this.fbm(site.x * 0.0048 + 37, site.z * 0.0048 - 19, 2));
    noise.broadMeadow = remapNoise(this.fbm(site.x * 0.0017 - 83, site.z * 0.0017 + 61, 3));
    noise.meadowDetail = remapNoise(this.fbm(site.x * 0.0064 + 13, site.z * 0.0064 + 47, 2));
    noise.rock = remapNoise(this.fbm(site.x * 0.0029 - 27, site.z * 0.0029 - 91, 3));
    this.combineHabitat(site, noise, target);
  }

  private combineHabitat(site: TerrainSite, noise: HabitatNoise, target: EcologySample): void {
    const gentle = 1 - MathUtils.smoothstep(site.slope, 0.34, 1.15);
    const highland = MathUtils.smoothstep(site.height, 90, 215);
    const rock = MathUtils.smoothstep(noise.rock * 0.58 + highland * 0.25 + site.slope * 0.32, 0.56, 0.82);
    const forestSource = noise.broadForest * 0.72 + noise.forestDetail * 0.28 + site.moisture * 0.16;
    const forest = MathUtils.smoothstep(forestSource, 0.43, 0.68) * gentle * (1 - rock * 0.8);
    const meadowSource = noise.broadMeadow * 0.7 + noise.meadowDetail * 0.3 + site.moisture * 0.12;
    const meadow = MathUtils.smoothstep(meadowSource, 0.5, 0.73) * gentle * (1 - forest * 0.72) * (1 - rock);
    target.forest = forest;
    target.meadow = meadow;
    target.rock = rock;
  }

  private writeFeatureGeometry(cellX: number, cellZ: number, hash: number, target: MacroFeatureSample): void {
    const centerHash = hashCoordinates(hash, cellX, cellZ, 0x96f1);
    target.centerX = (cellX + 0.5) * MACRO_CELL_SIZE + signedRandom(centerHash) * FEATURE_INSET;
    target.centerZ = (cellZ + 0.5) * MACRO_CELL_SIZE + signedRandom(hashCoordinates(centerHash, 7, 11)) * FEATURE_INSET;
    target.rotation = unitRandom(hashCoordinates(hash, 13, 17)) * Math.PI;
    target.length = 155 + unitRandom(hashCoordinates(hash, 19, 23)) * 105;
    target.width = 7 + unitRandom(hashCoordinates(hash, 29, 31)) * 5;
  }

  private getFeatureInfluence(x: number, z: number, feature: MacroFeatureSample): number {
    const offsetX = x - feature.centerX;
    const offsetZ = z - feature.centerZ;
    const cosine = Math.cos(feature.rotation);
    const sine = Math.sin(feature.rotation);
    const localX = offsetX * cosine + offsetZ * sine;
    const localZ = -offsetX * sine + offsetZ * cosine;
    if (feature.kind === 'lake') return getLakeInfluence(localX, localZ, feature);
    if (feature.kind === 'hedge') return getHedgeInfluence(localX, localZ, feature);
    return 0;
  }

  private fbm(x: number, z: number, octaves: number): number {
    let amplitude = 0.55;
    let frequency = 1;
    let value = 0;
    let weight = 0;
    for (let octave = 0; octave < octaves; octave += 1) {
      value += this.noise.noise(x * frequency + this.offsetX, 0.61, z * frequency + this.offsetZ) * amplitude;
      weight += amplitude;
      amplitude *= 0.5;
      frequency *= 2.03;
    }
    return value / weight;
  }
}

export function createEcologySample(): EcologySample {
  return { forest: 0, meadow: 0, rock: 0, hedge: 0, lake: 0 };
}

export function createMacroFeatureSample(): MacroFeatureSample {
  return { kind: 'none', influence: 0, centerX: 0, centerZ: 0, rotation: 0, length: 0, width: 0 };
}

function getFeatureKind(rank: number): MacroFeatureKind {
  if (rank < LAKE_PROBABILITY) return 'lake';
  if (rank < HEDGE_PROBABILITY) return 'hedge';
  return 'none';
}

function getLakeInfluence(x: number, z: number, feature: MacroFeatureSample): number {
  const radiusX = feature.length * 0.46;
  const radiusZ = feature.length * 0.3;
  const irregularity = 1 + Math.sin(Math.atan2(z, x) * 5) * 0.055;
  const distance = Math.hypot(x / radiusX, z / radiusZ) / irregularity;
  return 1 - MathUtils.smoothstep(distance, 0.78, 1.04);
}

function getHedgeInfluence(x: number, z: number, feature: MacroFeatureSample): number {
  const cappedX = Math.max(-feature.length * 0.5, Math.min(feature.length * 0.5, x));
  const distance = Math.hypot(x - cappedX, z);
  return 1 - MathUtils.smoothstep(distance, feature.width, feature.width * 2.4);
}

function remapNoise(value: number): number {
  return value * 0.5 + 0.5;
}
