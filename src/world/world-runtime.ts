/**
 * Composition root and explicit frame-order owner for the endless landscape.
 * Coordinates input, streaming, vegetation, atmosphere, diagnostics, and rendering without hiding subsystem lifecycles.
 */

import { Clock, FogExp2, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { disposeLandscapeAssets, type LandscapeAssets } from '../assets/landscape-assets';
import { BENCHMARK_MODE, LANDSCAPE_VIEW, QUALITY_PROFILE, RENDERING, WORLD_SEED } from '../config';
import { FlightControls } from '../controls/flight-controls';
import { hashString } from '../core/random';
import { GrassSystem } from '../grass/grass-system';
import { createRenderer } from '../rendering/create-renderer';
import { Environment } from '../rendering/environment';
import { configureXr } from '../rendering/xr-runtime';
import type { BenchmarkSnapshot } from '../performance/benchmark-contract';
import { BenchmarkFlight } from '../performance/benchmark-flight';
import { FrameHistogram } from '../performance/frame-histogram';
import { HeightField } from '../core/height-field';
import { TerrainSystem } from '../terrain/terrain-system';
import { createTreeVariants } from '../trees/tree-factory';
import { TreeSystem } from '../trees/tree-system';
import { ForestDistribution } from '../trees/forest-distribution';
import { GroundCoverDistribution } from '../vegetation/ground-cover-distribution';
import { GroundCoverSystem } from '../vegetation/ground-cover-system';
import { WindField } from '../wind/wind-field';

export interface LandscapeDiagnostics {
  fps: number;
  frameTimeMs: number;
  peakFrameTimeMs: number;
  drawCalls: number;
  triangles: number;
  trees: number;
  grassPatches: number;
  grassTufts: number;
  rocks: number;
  activeChunks: number;
  detailedChunks: number;
  geometries: number;
  textures: number;
  position: readonly [number, number, number];
  speed: number;
  viewDistance: number;
  relief: number;
  seed: string;
}

export class WorldRuntime {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, RENDERING.cameraFar);
  private readonly renderer: WebGLRenderer = createRenderer();
  private readonly xr = configureXr(this.renderer);
  private readonly clock = new Clock();
  private readonly heightField = new HeightField(WORLD_SEED, LANDSCAPE_VIEW.relief);
  private readonly benchmarkFlight = new BenchmarkFlight(BENCHMARK_MODE, this.camera, this.heightField);
  private readonly frameHistogram = new FrameHistogram();
  private readonly wind = new WindField();
  private readonly terrain: TerrainSystem;
  private readonly environment: Environment;
  private readonly controls: FlightControls;
  private readonly grass: GrassSystem;
  private readonly trees: TreeSystem;
  private readonly groundCover: GroundCoverSystem;
  private readonly diagnostics: LandscapeDiagnostics;
  private readonly viewDirection = new Vector3();
  private readonly vegetationDirection = new Vector3();
  private groundCoverRefreshPending = false;
  private backgroundStep = 0;
  private averageFrameTime = 16.7;
  private peakFrameTime = 0;
  private lastDiagnosticsUpdate = Number.NEGATIVE_INFINITY;

  public constructor(
    mount: HTMLElement,
    private readonly diagnosticsElement: HTMLElement,
    private readonly assets: LandscapeAssets,
  ) {
    this.scene.fog = new FogExp2('#b8c8c0', RENDERING.fogDensity);
    this.environment = new Environment(this.scene);
    this.positionCamera();
    mount.append(this.renderer.domElement);
    this.terrain = new TerrainSystem(this.heightField, assets.ground);
    this.controls = new FlightControls(this.camera, this.renderer.domElement);
    this.grass = new GrassSystem({
      heightField: this.heightField,
      seed: hashString(`${WORLD_SEED}:grass`),
      wind: this.wind.uniforms,
      meadowPatch: assets.meadowPatch,
      grassTuft: assets.grassTuft,
    });
    const variants = createTreeVariants(this.wind.uniforms, hashString(`${WORLD_SEED}:tree-templates`));
    const forest = new ForestDistribution(this.heightField, hashString(`${WORLD_SEED}:forest`), variants);
    this.trees = new TreeSystem(variants, forest);
    const groundCoverDistribution = new GroundCoverDistribution(this.heightField, hashString(`${WORLD_SEED}:ground-cover`));
    this.groundCover = new GroundCoverSystem(assets, groundCoverDistribution);
    this.scene.add(this.terrain.group, this.trees.group, this.grass.group, this.groundCover.group);
    this.diagnostics = createInitialDiagnostics();
    window.__LANDSCAPE_DIAGNOSTICS__ = this.diagnostics;
    window.__LANDSCAPE_BENCHMARK__ = {
      reset: (): void => this.frameHistogram.reset(),
      snapshot: (): BenchmarkSnapshot => this.createBenchmarkSnapshot(),
    };
    window.addEventListener('resize', this.resize);
  }

  public async start(): Promise<void> {
    this.camera.getWorldDirection(this.viewDirection);
    this.terrain.updateChunkWindow(this.camera.position, this.viewDirection);
    this.trees.rebuild(this.camera.position, this.viewDirection);
    this.grass.update(this.camera.position);
    this.groundCover.rebuild(this.camera.position, this.viewDirection);
    this.vegetationDirection.copy(this.viewDirection);
    this.environment.update(this.camera);
    await this.renderer.compileAsync(this.scene, this.camera);
    this.clock.start();
    this.renderer.setAnimationLoop(this.renderFrame);
  }

  public dispose(): void {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.resize);
    this.xr.dispose();
    this.controls.dispose();
    this.terrain.dispose();
    this.trees.dispose();
    this.grass.dispose();
    this.groundCover.dispose();
    this.environment.dispose();
    disposeLandscapeAssets(this.assets);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    delete window.__LANDSCAPE_BENCHMARK__;
    delete window.__LANDSCAPE_DIAGNOSTICS__;
  }

  private readonly renderFrame = (): void => {
    const rawDeltaSeconds = this.clock.getDelta();
    const simulationDeltaSeconds = Math.min(rawDeltaSeconds, 0.05);
    const elapsedSeconds = this.clock.elapsedTime;
    this.updateCamera(simulationDeltaSeconds);
    this.camera.getWorldDirection(this.viewDirection);
    const chunkWindowChanged = this.terrain.updateChunkWindow(this.camera.position, this.viewDirection);
    const vegetationRefreshed = this.refreshVegetation(chunkWindowChanged);
    this.processBackgroundWork(chunkWindowChanged, vegetationRefreshed);
    this.grass.update(this.camera.position);
    this.wind.update(elapsedSeconds);
    this.environment.update(this.camera);
    this.renderer.render(this.scene, this.camera);
    this.frameHistogram.record(rawDeltaSeconds * 1_000);
    this.updateDiagnostics(rawDeltaSeconds, elapsedSeconds);
  };

  private updateCamera(deltaSeconds: number): void {
    this.benchmarkFlight.update(deltaSeconds, this.renderer.xr.isPresenting);
    const interactiveFlight = !(this.benchmarkFlight.enabled || this.renderer.xr.isPresenting);
    this.controls.setEnabled(interactiveFlight);
    this.controls.update(deltaSeconds);
  }

  private processBackgroundWork(chunkWindowChanged: boolean, vegetationRefreshed: boolean): void {
    if (chunkWindowChanged || vegetationRefreshed) return;
    this.processBackgroundStep();
  }

  private positionCamera(): void {
    const startZ = 120;
    const ground = this.heightField.getHeight(0, startZ);
    this.camera.position.set(0, ground + 62, startZ);
    const targetHeight = this.heightField.getHeight(0, -80) + 20;
    this.camera.lookAt(new Vector3(0, targetHeight, -80));
  }

  private refreshVegetation(chunkWindowChanged: boolean): boolean {
    if (chunkWindowChanged || this.hasTurnedPastVegetationWindow()) {
      this.trees.rebuild(this.camera.position, this.viewDirection);
      this.vegetationDirection.copy(this.viewDirection);
      this.groundCoverRefreshPending = true;
      return true;
    }
    if (!this.groundCoverRefreshPending) return false;
    this.groundCover.rebuild(this.camera.position, this.viewDirection);
    this.groundCoverRefreshPending = false;
    return true;
  }

  private hasTurnedPastVegetationWindow(): boolean {
    const currentLength = Math.hypot(this.viewDirection.x, this.viewDirection.z);
    const previousLength = Math.hypot(this.vegetationDirection.x, this.vegetationDirection.z);
    if (currentLength === 0 || previousLength === 0) return false;
    const dot = this.viewDirection.x * this.vegetationDirection.x + this.viewDirection.z * this.vegetationDirection.z;
    return dot / (currentLength * previousLength) < 0.94;
  }

  private processBackgroundStep(): void {
    if (this.backgroundStep === 0) this.trees.prefetchNextChunk(this.camera.position, this.viewDirection);
    if (this.backgroundStep === 1) this.groundCover.prefetchNextChunk(this.camera.position, this.viewDirection);
    if (this.backgroundStep === 2) this.terrain.processNextChunk();
    this.backgroundStep = (this.backgroundStep + 1) % 3;
  }

  private updateDiagnostics(deltaSeconds: number, elapsedSeconds: number): void {
    const frameTime = deltaSeconds * 1_000;
    this.averageFrameTime += (frameTime - this.averageFrameTime) * 0.05;
    this.peakFrameTime = Math.max(this.peakFrameTime, frameTime);
    if (elapsedSeconds - this.lastDiagnosticsUpdate < 0.25) return;
    this.lastDiagnosticsUpdate = elapsedSeconds;
    const info = this.renderer.info;
    Object.assign(this.diagnostics, {
      fps: Math.round(1_000 / this.averageFrameTime),
      frameTimeMs: Number(this.averageFrameTime.toFixed(1)),
      peakFrameTimeMs: Number(this.peakFrameTime.toFixed(1)),
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      trees: this.trees.visibleTreeCount,
      grassPatches: this.grass.visiblePatchCount,
      grassTufts: this.grass.visibleTuftCount,
      rocks: this.groundCover.visibleRockCount,
      activeChunks: this.terrain.activeChunkCount,
      detailedChunks: this.trees.activeChunkCount,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      position: this.camera.position.toArray(),
      speed: Math.round(this.benchmarkFlight.enabled ? this.benchmarkFlight.speed : this.controls.speed),
      viewDistance: LANDSCAPE_VIEW.distance,
      relief: LANDSCAPE_VIEW.relief,
    });
    this.peakFrameTime = 0;
    this.diagnosticsElement.textContent = formatDiagnostics(this.diagnostics);
  }

  private readonly resize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDERING.pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private createBenchmarkSnapshot(): BenchmarkSnapshot {
    return {
      ...this.frameHistogram.snapshot(),
      profile: QUALITY_PROFILE.name,
      mode: BENCHMARK_MODE,
      diagnostics: { ...this.diagnostics },
      xr: { ...this.xr.status },
    };
  }
}

function createInitialDiagnostics(): LandscapeDiagnostics {
  return {
    fps: 0,
    frameTimeMs: 0,
    peakFrameTimeMs: 0,
    drawCalls: 0,
    triangles: 0,
    trees: 0,
    grassPatches: 0,
    grassTufts: 0,
    rocks: 0,
    activeChunks: 0,
    detailedChunks: 0,
    geometries: 0,
    textures: 0,
    position: [0, 0, 0],
    speed: 0,
    viewDistance: LANDSCAPE_VIEW.distance,
    relief: LANDSCAPE_VIEW.relief,
    seed: WORLD_SEED,
  };
}

function formatDiagnostics(value: LandscapeDiagnostics): string {
  const triangles = Math.round(value.triangles / 1_000);
  return `${value.fps} FPS · ${value.frameTimeMs}/${value.peakFrameTimeMs} ms · ${value.drawCalls} calls · ${triangles}k tris\n${value.trees} trees · ${value.grassPatches} meadows · ${value.grassTufts} tufts · ${value.rocks} rocks · ${value.activeChunks}/${value.detailedChunks} chunks · ${value.viewDistance} m · r${value.relief.toFixed(2)}`;
}
