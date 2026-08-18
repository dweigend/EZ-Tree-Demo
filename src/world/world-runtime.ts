/**
 * Composition root and explicit frame-order owner for the endless landscape.
 * Coordinates input, streaming, vegetation, atmosphere, diagnostics, and rendering without hiding subsystem lifecycles.
 */

import { Clock, FogExp2, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { disposeLandscapeAssets, type LandscapeAssets } from '../assets/landscape-assets';
import { CONFIG, LANDSCAPE_VIEW, RENDERING, WORLD_SEED } from '../config';
import { FlightControls } from '../controls/flight-controls';
import { hashString } from '../core/random';
import { EcologyField } from '../ecology/ecology-field';
import { GrassSystem } from '../grass/grass-system';
import { createRenderer } from '../rendering/create-renderer';
import { Environment } from '../rendering/environment';
import { HeightField } from '../terrain/height-field';
import { LakeLayer } from '../terrain/lake-layer';
import { TerrainSystem } from '../terrain/terrain-system';
import { createTreeVariants } from '../trees/tree-factory';
import { TreeSystem } from '../trees/tree-system';
import { ForestDistribution } from '../vegetation/forest-distribution';
import { GroundCoverDistribution } from '../vegetation/ground-cover-distribution';
import { GroundCoverSystem } from '../vegetation/ground-cover-system';
import { WindField } from '../wind/wind-field';
import {
  createLandscapeDiagnostics,
  formatLandscapeDiagnostics,
  type LandscapeDiagnostics,
} from './landscape-diagnostics';

export type { LandscapeDiagnostics } from './landscape-diagnostics';

export class WorldRuntime {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, RENDERING.cameraFar);
  private readonly renderer: WebGLRenderer = createRenderer();
  private readonly clock = new Clock();
  private readonly ecologyField = new EcologyField(WORLD_SEED);
  private readonly heightField = new HeightField(
    WORLD_SEED,
    LANDSCAPE_VIEW.relief,
    CONFIG.features.lakes ? this.ecologyField : undefined,
  );
  private readonly wind = new WindField();
  private readonly terrain: TerrainSystem;
  private readonly environment: Environment;
  private readonly controls: FlightControls;
  private readonly grass: GrassSystem;
  private readonly trees: TreeSystem;
  private readonly groundCover: GroundCoverSystem;
  private readonly lakes: LakeLayer | null;
  private readonly diagnostics: LandscapeDiagnostics;
  private readonly viewDirection = new Vector3();
  private readonly vegetationDirection = new Vector3();
  private groundCoverRefreshPending = false;
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
    this.terrain = new TerrainSystem(this.heightField, this.ecologyField, assets.ground);
    this.controls = new FlightControls(this.camera, this.renderer.domElement);
    this.grass = new GrassSystem({
      heightField: this.heightField,
      ecologyField: this.ecologyField,
      seed: hashString(`${WORLD_SEED}:grass`),
      wind: this.wind.uniforms,
      asset: assets.grass,
    });
    const variants = createTreeVariants(this.wind.uniforms, hashString(`${WORLD_SEED}:tree-templates`));
    const forest = new ForestDistribution(
      this.heightField,
      this.ecologyField,
      hashString(`${WORLD_SEED}:forest`),
      variants,
    );
    this.trees = new TreeSystem(variants, forest);
    const groundCoverDistribution = new GroundCoverDistribution(
      this.heightField,
      this.ecologyField,
      hashString(`${WORLD_SEED}:ground-cover`),
    );
    this.groundCover = new GroundCoverSystem(assets, groundCoverDistribution, this.wind.uniforms);
    this.lakes = CONFIG.features.lakes ? new LakeLayer(this.heightField, this.ecologyField) : null;
    this.grass.mesh.visible = CONFIG.features.grass;
    this.scene.add(this.terrain.group, this.trees.group, this.grass.mesh, this.groundCover.group);
    if (this.lakes) this.scene.add(this.lakes.mesh);
    this.diagnostics = createLandscapeDiagnostics(CONFIG);
    window.__LANDSCAPE_DIAGNOSTICS__ = this.diagnostics;
    window.addEventListener('resize', this.resize);
  }

  public start(): void {
    this.camera.getWorldDirection(this.viewDirection);
    this.terrain.update(this.camera.position, this.viewDirection);
    this.trees.rebuild(this.camera.position, this.viewDirection);
    this.grass.update(this.camera.position);
    this.groundCover.rebuild(this.camera.position, this.viewDirection);
    this.lakes?.rebuild(this.camera.position, this.viewDirection);
    this.vegetationDirection.copy(this.viewDirection);
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
    this.lakes?.dispose();
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
    this.camera.getWorldDirection(this.viewDirection);
    this.trees.prepareStreaming(this.camera.position, this.viewDirection);
    this.groundCover.prepareStreaming(this.camera.position, this.viewDirection);
    const terrainChanged = this.terrain.update(this.camera.position, this.viewDirection);
    if (terrainChanged) this.lakes?.rebuild(this.camera.position, this.viewDirection);
    const vegetationRefreshed = this.refreshVegetation(terrainChanged);
    if (!terrainChanged && !vegetationRefreshed) this.terrain.processStreaming();
    if (CONFIG.features.grass) this.grass.update(this.camera.position);
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

  private refreshVegetation(terrainChanged: boolean): boolean {
    if (terrainChanged) {
      this.trees.rebuild(this.camera.position, this.viewDirection);
      this.vegetationDirection.copy(this.viewDirection);
      this.groundCoverRefreshPending = true;
      return true;
    }
    if (this.hasTurnedPastVegetationWindow()) {
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
    return dot / (currentLength * previousLength) < 0.5;
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
      hedgeShrubs: this.trees.visibleShrubCount,
      grassBlades: this.grass.visibleBladeCount,
      flowers: this.groundCover.visibleFlowerCount,
      rocks: this.groundCover.visibleRockCount,
      lakes: this.lakes?.visibleLakeCount ?? 0,
      activeChunks: this.terrain.activeChunkCount,
      detailedChunks: this.trees.activeChunkCount,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      position: this.camera.position.toArray(),
      speed: Math.round(this.controls.speed),
      viewDistance: LANDSCAPE_VIEW.distance,
      relief: LANDSCAPE_VIEW.relief,
    });
    this.peakFrameTime = 0;
    this.diagnosticsElement.textContent = formatLandscapeDiagnostics(this.diagnostics);
  }

  private readonly resize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDERING.pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
