/**
 * Shared GLSL helpers for spatially coherent vegetation wind.
 * This compact value-noise function supplements EZ-Tree's built-in simplex implementation.
 */

export const WIND_NOISE_GLSL = /* glsl */ `
float windHash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}

float windNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  vec2 eased = local * local * (3.0 - 2.0 * local);
  float a = windHash(cell);
  float b = windHash(cell + vec2(1.0, 0.0));
  float c = windHash(cell + vec2(0.0, 1.0));
  float d = windHash(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, eased.x), mix(c, d, eased.x), eased.y);
}
`;
