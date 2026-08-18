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

const SUN_POLAR_ANGLE = MathUtils.degToRad(68);
const SUN_AZIMUTH = MathUtils.degToRad(210);

export class Environment {
  private readonly group = new Group();
  private readonly sky = new Sky();
  private readonly sun = new DirectionalLight('#fff0cf', 4.5);
  private readonly target = new Object3D();
  private readonly sunDirection: Vector3;

  public constructor(scene: Scene) {
    this.sunDirection = new Vector3().setFromSpherical(new Spherical(1, SUN_POLAR_ANGLE, SUN_AZIMUTH));
    this.configureSky();
    this.configureSun();
    this.group.add(this.sky, this.sun, this.target);
    this.group.add(new HemisphereLight('#dcebf0', '#596848', 0.95));
    this.group.add(new AmbientLight('#b7c6be', 0.16));
    scene.background = new Color('#a9bec0');
    scene.add(this.group);
  }

  public update(camera: PerspectiveCamera): void {
    this.sky.position.copy(camera.position);
    this.target.position.copy(camera.position);
    this.target.position.y -= 80;
    this.target.position.z -= 20;
    this.sun.position.copy(camera.position).addScaledVector(this.sunDirection, 420);
    this.target.updateMatrixWorld();
  }

  public dispose(): void {
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
    shadow.bias = -0.00018;
    shadow.normalBias = 0.035;
  }
}
