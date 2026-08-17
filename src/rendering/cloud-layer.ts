/**
 * Camera-following cloud sheet rendered by one transparent GPU draw.
 * World-space noise keeps cloud motion continuous while the bounded plane follows an endless world.
 */

import {
  BackSide,
  Color,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  type PerspectiveCamera,
} from 'three';
import type { WindUniforms } from '../wind/wind-field';
import { WIND_NOISE_GLSL } from '../wind/shader-chunks';

const CLOUD_RADIUS = 1_250;

export class CloudLayer {
  public readonly mesh: Mesh<SphereGeometry, ShaderMaterial>;

  public constructor(wind: WindUniforms) {
    const geometry = new SphereGeometry(CLOUD_RADIUS, 32, 16);
    const material = new ShaderMaterial({
      uniforms: {
        uTime: wind.time,
        uWindDirection: wind.direction,
        uCloudShadow: { value: new Color('#aebbb8') },
        uCloudLight: { value: new Color('#fffaf0') },
      },
      vertexShader: cloudVertexShader,
      fragmentShader: cloudFragmentShader,
      transparent: true,
      depthWrite: false,
      side: BackSide,
    });
    this.mesh = new Mesh(geometry, material);
    this.mesh.renderOrder = -1;
  }

  public update(camera: PerspectiveCamera): void {
    this.mesh.position.copy(camera.position);
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.removeFromParent();
  }
}

const cloudVertexShader = /* glsl */ `
varying vec3 vCloudDirection;

void main() {
  vCloudDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const cloudFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec2 uWindDirection;
uniform vec3 uCloudShadow;
uniform vec3 uCloudLight;
varying vec3 vCloudDirection;

${WIND_NOISE_GLSL}

void main() {
  vec2 drift = uWindDirection * uTime;
  vec2 skyPosition = vCloudDirection.xz / max(vCloudDirection.y + 0.36, 0.24);
  float broad = windNoise(skyPosition * 1.55 - drift * 0.011);
  float middle = windNoise(skyPosition * 3.8 - drift * 0.024 + vec2(7.1, 3.4));
  float detail = windNoise(skyPosition * 9.5 - drift * 0.041 + vec2(13.7, 9.2));
  float cloudShape = broad * 0.62 + middle * 0.28 + detail * 0.1;
  float erosion = middle * 0.7 + detail * 0.3;
  float density = smoothstep(0.5, 0.67, cloudShape) * smoothstep(0.35, 0.58, erosion);
  float skyMask = smoothstep(0.02, 0.16, vCloudDirection.y);
  float light = smoothstep(0.46, 0.72, cloudShape + detail * 0.08);
  vec3 color = mix(uCloudShadow, uCloudLight, light);
  gl_FragColor = vec4(color, density * skyMask * 0.3);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
