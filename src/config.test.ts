/** Verifies that public landscape parameters are bounded and feature toggles are explicit. */

import { describe, expect, test } from 'bun:test';
import { createLandscapeConfig } from './config';

describe('createLandscapeConfig', () => {
  test('clamps numeric tuning parameters', () => {
    const config = createLandscapeConfig(new URLSearchParams('distance=9999&relief=0&forestDensity=1.25'));
    expect(config.view.distance).toBe(1_500);
    expect(config.view.relief).toBe(0.7);
    expect(config.vegetation.forestDensity).toBe(1.25);
  });

  test('only zero disables a feature', () => {
    const config = createLandscapeConfig(new URLSearchParams('grass=0&trees=1&lakes=false'));
    expect(config.features.grass).toBe(false);
    expect(config.features.trees).toBe(true);
    expect(config.features.lakes).toBe(true);
  });
});
