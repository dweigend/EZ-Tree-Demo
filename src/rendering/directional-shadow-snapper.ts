/**
 * Snaps a directional shadow volume to its texel grid while preserving depth along the light direction.
 * It owns only reusable vectors; light placement and shadow-camera configuration remain caller-owned.
 */

import { Vector3 } from 'three';

const WORLD_UP = new Vector3(0, 1, 0);
const FALLBACK_HORIZONTAL = new Vector3(1, 0, 0);

export class DirectionalShadowSnapper {
  private readonly horizontal = new Vector3();
  private readonly vertical = new Vector3();
  private readonly texelSize: number;

  public constructor(lightDirection: Vector3, extent: number, mapSize: number) {
    this.horizontal.crossVectors(WORLD_UP, lightDirection);
    if (this.horizontal.lengthSq() <= Number.EPSILON) this.horizontal.copy(FALLBACK_HORIZONTAL);
    else this.horizontal.normalize();
    this.vertical.crossVectors(lightDirection, this.horizontal).normalize();
    this.texelSize = (extent * 2) / mapSize;
  }

  public snap(position: Vector3, result: Vector3): Vector3 {
    const horizontalOffset = snap(position.dot(this.horizontal), this.texelSize) - position.dot(this.horizontal);
    const verticalOffset = snap(position.dot(this.vertical), this.texelSize) - position.dot(this.vertical);
    return result
      .copy(position)
      .addScaledVector(this.horizontal, horizontalOffset)
      .addScaledVector(this.vertical, verticalOffset);
  }
}

function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}
