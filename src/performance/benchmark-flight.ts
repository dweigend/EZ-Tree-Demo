/**
 * Deterministic camera route used only by explicit desktop and immersive benchmark modes.
 * It replaces interactive flight input without introducing runtime quality adaptation.
 */

import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { BenchmarkMode } from '../config';
import type { HeightField } from '../core/height-field';

const BENCHMARK_SPEED = 320;
const FLIGHT_HEIGHT = 62;

export class BenchmarkFlight {
  public readonly speed = BENCHMARK_SPEED;
  private readonly origin: Vector3;
  private readonly target = new Vector3();
  private distance = 0;

  public constructor(
    private readonly mode: BenchmarkMode,
    private readonly camera: PerspectiveCamera,
    private readonly heightField: HeightField,
  ) {
    this.origin = camera.position.clone();
  }

  public get enabled(): boolean {
    return this.mode !== null;
  }

  public update(deltaSeconds: number, xrPresenting: boolean): boolean {
    if (!this.shouldFly(xrPresenting)) return false;
    this.distance += BENCHMARK_SPEED * deltaSeconds;
    const x = this.origin.x + Math.sin(this.distance / 280) * 120;
    const z = this.origin.z - this.distance;
    const groundHeight = this.heightField.getHeight(x, z);
    const y = MathUtils.damp(this.camera.position.y, groundHeight + FLIGHT_HEIGHT, 4, deltaSeconds);
    this.camera.position.set(x, y, z);
    if (!xrPresenting) this.lookForward(x, z);
    return true;
  }

  private shouldFly(xrPresenting: boolean): boolean {
    if (!this.mode) return false;
    return this.mode !== 'xr-flight' || xrPresenting;
  }

  private lookForward(x: number, z: number): void {
    const targetZ = z - 80;
    const targetX = x + Math.cos(this.distance / 280) * 34;
    this.target.set(targetX, this.heightField.getHeight(targetX, targetZ) + 20, targetZ);
    this.camera.lookAt(this.target);
  }
}
