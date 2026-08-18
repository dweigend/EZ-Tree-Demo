/**
 * Browser-global diagnostics contract for automated and manual performance checks.
 * It exposes read-only runtime evidence and intentionally no mutation hooks.
 */

import type { LandscapeDiagnostics } from './world/world-runtime';
import type { LandscapeBenchmark } from './performance/benchmark-contract';

declare global {
  interface Window {
    __LANDSCAPE_BENCHMARK__?: LandscapeBenchmark;
    __LANDSCAPE_DIAGNOSTICS__?: LandscapeDiagnostics;
  }
}

export {};
