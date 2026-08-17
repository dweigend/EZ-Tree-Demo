/**
 * Composition root and explicit frame-order owner for the endless landscape.
 * Coordinates input, streaming, vegetation, atmosphere, diagnostics, and rendering without hiding subsystem lifecycles.
 */

import { Clock, FogExp2, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { disposeLandscapeAssets, type LandscapeAssets } from '../assets/landscape-assets';
import { RENDERING, WORLD_SEED } from '../config';
import { FlightControls } from '../controls/flight-controls';
import { hashString } from '../core/random';
import { GrassSystem } from '../grass/grass-system';
import { createRenderer } from '../rendering/create-renderer';
import { Environment } from '../rendering/environment';
import { HeightField } from '../terrain/height-field';
import { TerrainSystem } from '../terrain/terrain-system';
import { createTreeVariants } from '../trees/tree-factory';
import { TreeSystem } from '../trees/tree-system';
import { ForestDistribution } from '../vegetation/forest-distribution';
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
  grassBlades: number;
  flowers: number;
  rocks: number;
  activeChunks: number;
  geometries: number;
  textures: number;
  position: readonly [number, number, number];
  speed: number;
  seed: string;
}

export class WorldRuntime {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, RENDERING.cameraFar);
  private readonly renderer: WebGLRenderer = createRenderer();
  private readonly clock = new Clock();
  private readonly heightField = new HeightField(WORLD_SEED);
  private readonly wind = new WindField();
  private readonly terrain: TerrainSystem;
  private readonly environment = new Environment(this.scene);
  private readonly controls: FlightControls;
  private readonly grass: GrassSystem;
  private readonly trees: TreeSystem;
  private readonly groundCover: GroundCoverSystem;
  private readonly diagnostics: LandscapeDiagnostics;
  private averageFrameTime = 16.7;
  private peakFrameTime = 0;
  private lastDiagnosticsUpdate = Number.NEGATIVE_INFINITY;

  public constructor(
    mount: HTMLElement,
    private readonly diagnosticsElement: HTMLElement,
    private readonly assets: LandscapeAssets,
  ) {
    this.scene.fog = new FogExp2('#b8c8c0', RENDERING.fogDensity);
    this.positionCamera();
    mount.append(this.renderer.domElement);
    this.terrain = new TerrainSystem(this.heightField, assets.ground);
    this.controls = new FlightControls(this.camera, this.renderer.domElement);
    this.grass = new GrassSystem(this.heightField, hashString(`${WORLD_SEED}:grass`), this.wind.uniforms, assets.grass);
    const variants = createTreeVariants(this.wind.uniforms);
    const forest = new ForestDistribution(this.heightField, hashString(`${WORLD_SEED}:forest`), variants.length);
    this.trees = new TreeSystem(variants, forest);
    const groundCoverDistribution = new GroundCoverDistribution(this.heightField, hashString(`${WORLD_SEED}:ground-cover`));
    this.groundCover = new GroundCoverSystem(assets, groundCoverDistribution, this.wind.uniforms);
    this.scene.add(this.terrain.group, this.trees.group, this.grass.mesh, this.groundCover.group);
    this.diagnostics = createInitialDiagnostics();
    window.__LANDSCAPE_DIAGNOSTICS__ = this.diagnostics;
    window.addEventListener('resize', this.resize);
  }

  public start(): void {
    this.terrain.update(this.camera.position);
    this.trees.rebuild(this.camera.position);
    this.grass.update(this.camera.position);
    this.groundCover.rebuild(this.camera.position);
    this.environment.update(this.camera);
    this.clock.start();
    this.renderer.setAnimationLoop(this.renderFrame);
  }

  public dispose(): void {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.resize);
    this.controls.dispose();
    this.terrain.dispose();
    this.trees.dispose();
    this.grass.dispose();
    this.groundCover.dispose();
    this.environment.dispose();
    disposeLandscapeAssets(this.assets);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    delete window.__LANDSCAPE_DIAGNOSTICS__;
  }

  private readonly renderFrame = (): void => {
    const rawDeltaSeconds = this.clock.getDelta();
    const simulationDeltaSeconds = Math.min(rawDeltaSeconds, 0.05);
    const elapsedSeconds = this.clock.elapsedTime;
    this.controls.update(simulationDeltaSeconds);
    this.trees.prepareStreaming(this.camera.position);
    const terrainChanged = this.terrain.update(this.camera.position);
    if (terrainChanged) {
      this.trees.rebuild(this.camera.position);
      this.groundCover.rebuild(this.camera.position);
    }
    this.terrain.processStreaming();
    this.grass.update(this.camera.position);
    this.wind.update(elapsedSeconds);
    this.environment.update(this.camera);
    this.renderer.render(this.scene, this.camera);
    this.updateDiagnostics(rawDeltaSeconds, elapsedSeconds);
  };

  private positionCamera(): void {
    const startZ = 120;
    const ground = this.heightField.getHeight(0, startZ);
    this.camera.position.set(0, ground + 62, startZ);
    const targetHeight = this.heightField.getHeight(0, -80) + 20;
    this.camera.lookAt(new Vector3(0, targetHeight, -80));
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
      grassBlades: this.grass.visibleBladeCount,
      flowers: this.groundCover.visibleFlowerCount,
      rocks: this.groundCover.visibleRockCount,
      activeChunks: this.terrain.activeChunkCount,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      position: this.camera.position.toArray(),
      speed: Math.round(this.controls.speed),
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
}

function createInitialDiagnostics(): LandscapeDiagnostics {
  return {
    fps: 0,
    frameTimeMs: 0,
    peakFrameTimeMs: 0,
    drawCalls: 0,
    triangles: 0,
    trees: 0,
    grassBlades: 0,
    flowers: 0,
    rocks: 0,
    activeChunks: 0,
    geometries: 0,
    textures: 0,
    position: [0, 0, 0],
    speed: 0,
    seed: WORLD_SEED,
  };
}

function formatDiagnostics(value: LandscapeDiagnostics): string {
  const triangles = Math.round(value.triangles / 1_000);
  return `${value.fps} FPS · ${value.frameTimeMs}/${value.peakFrameTimeMs} ms · ${value.drawCalls} calls · ${triangles}k tris\n${value.trees} trees · ${value.grassBlades.toLocaleString()} grass · ${value.flowers} flowers · ${value.rocks} rocks · ${value.speed} m/s`;
}
