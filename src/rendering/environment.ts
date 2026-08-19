/**
 * Atmospheric sky and compact natural-lighting rig for the landscape.
 * The sky and directional shadow volume follow the camera without owning the render loop.
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  Object3D,
  PerspectiveCamera,
  Scene,
  Spherical,
  Vector3,
} from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RENDERING } from '../config';
import { DirectionalShadowSnapper } from './directional-shadow-snapper';

const SUN_POLAR_ANGLE = MathUtils.degToRad(68);
const SUN_AZIMUTH = MathUtils.degToRad(210);

export class Environment {
  private readonly group = new Group();
  private readonly sky = new Sky();
  private readonly sun = new DirectionalLight('#fff0cf', 4.5);
  private readonly target = new Object3D();
  private readonly sunDirection: Vector3;
  private readonly shadowCenter = new Vector3();
  private readonly shadowSnapper: DirectionalShadowSnapper;

  public constructor(scene: Scene) {
    this.sunDirection = new Vector3().setFromSpherical(new Spherical(1, SUN_POLAR_ANGLE, SUN_AZIMUTH));
    this.shadowSnapper = new DirectionalShadowSnapper(
      this.sunDirection,
      RENDERING.shadowDistance,
      RENDERING.shadowMapSize,
    );
    this.configureSky();
    this.configureSun();
    this.group.add(this.sky, this.sun, this.target);
    this.group.add(new HemisphereLight('#dcebf0', '#596848', 0.95));
    this.group.add(new AmbientLight('#b7c6be', 0.16));
    scene.background = new Color('#a9bec0');
    scene.add(this.group);
  }

  public update(camera: PerspectiveCamera): void {
    // Move one bounded shadow volume with the viewer instead of shadowing the entire streamed world.
    this.sky.position.copy(camera.position);
    this.shadowCenter.copy(camera.position);
    this.shadowCenter.y -= 80;
    this.shadowCenter.z -= 20;
    this.shadowSnapper.snap(this.shadowCenter, this.target.position);
    this.sun.position.copy(this.target.position).addScaledVector(this.sunDirection, 420);
    this.target.updateMatrixWorld();
  }

  public dispose(): void {
    this.sun.shadow.dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.group.removeFromParent();
  }

  private configureSky(): void {
    this.sky.scale.setScalar(450_000);
    const uniforms = this.sky.material.uniforms;
    uniforms.turbidity!.value = 7.2;
    uniforms.rayleigh!.value = 2.35;
    uniforms.mieCoefficient!.value = 0.006;
    uniforms.mieDirectionalG!.value = 0.83;
    uniforms.sunPosition!.value.copy(this.sunDirection);
  }

  private configureSun(): void {
    const shadow = this.sun.shadow;
    const camera = shadow.camera;
    this.sun.castShadow = true;
    this.sun.target = this.target;
    shadow.mapSize.setScalar(RENDERING.shadowMapSize);
    camera.left = -RENDERING.shadowDistance;
    camera.right = RENDERING.shadowDistance;
    camera.top = RENDERING.shadowDistance;
    camera.bottom = -RENDERING.shadowDistance;
    camera.near = 20;
    camera.far = 780;
    camera.updateProjectionMatrix();
    shadow.bias = -0.00002;
    shadow.normalBias = 0.04;
  }
}
