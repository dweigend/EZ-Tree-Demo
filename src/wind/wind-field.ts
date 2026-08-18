/**
 * Shared deterministic wind state for every vegetation shader.
 * A low-frequency noise envelope adds gusts while spatial phase remains shader-driven.
 */

import { Vector2 } from 'three';
import { hashCoordinates, unitRandom } from '../core/random';

export interface WindUniforms {
  readonly time: { value: number };
  readonly direction: { value: Vector2 };
  readonly amplitude: { value: number };
  readonly gust: { value: number };
  readonly spatialScale: { value: number };
}

export function bindWindUniforms(
  uniforms: Record<string, { value: unknown }>,
  wind: WindUniforms,
): void {
  uniforms.uTime = wind.time;
  uniforms.uGlobalWindDirection = wind.direction;
  uniforms.uGlobalWindAmplitude = wind.amplitude;
  uniforms.uGlobalGust = wind.gust;
  uniforms.uGlobalWindScale = wind.spatialScale;
}

export class WindField {
  public readonly uniforms: WindUniforms = {
    time: { value: 0 },
    direction: { value: new Vector2(0.82, 0.57).normalize() },
    amplitude: { value: 0.58 },
    gust: { value: 0.72 },
    spatialScale: { value: 86 },
  };

  public update(elapsedSeconds: number): void {
    this.uniforms.time.value = elapsedSeconds;
    const slow = this.smoothNoise(elapsedSeconds * 0.075);
    const pulse = Math.sin(elapsedSeconds * 0.21 + Math.sin(elapsedSeconds * 0.037) * 2.1) * 0.5 + 0.5;
    this.uniforms.gust.value = 0.48 + slow * 0.34 + pulse * 0.18;
  }

  private smoothNoise(value: number): number {
    const index = Math.floor(value);
    const fraction = value - index;
    const eased = fraction * fraction * (3 - fraction * 2);
    const left = unitRandom(hashCoordinates(0x7f4a7c15, index, 0));
    const right = unitRandom(hashCoordinates(0x7f4a7c15, index + 1, 0));
    return left + (right - left) * eased;
  }
}
