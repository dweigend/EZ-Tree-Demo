/**
 * Shared GLSL helper for spatially coherent vegetation wind.
 * Travelling harmonics align all vegetation without per-vertex procedural noise.
 */

export const WIND_INSTANCE_GLSL = /* glsl */ `
attribute float aWindPhase;
attribute float aWindStrength;
uniform float uTime;
uniform vec2 uGlobalWindDirection;
uniform float uGlobalWindAmplitude;
uniform float uGlobalGust;
uniform float uGlobalWindScale;
`;

export const WIND_WAVE_GLSL = /* glsl */ `
float windWaveAt(vec2 worldPosition, float time, float scale, vec2 direction, float phase) {
  float travel = dot(worldPosition, direction) / scale * 6.2831 - time * 0.55 + phase;
  return 0.65 * sin(travel)
    + 0.25 * sin(travel * 1.9 + time * 0.23 + phase * 0.7)
    + 0.10 * sin(travel * 0.43 - time * 0.17);
}
`;
