/**
 * Read-only browser contract for collecting repeatable landscape benchmark evidence.
 * It combines frame statistics with the latest renderer diagnostics and WebXR session state.
 */

import type { BenchmarkMode, QualityProfileName } from '../config';
import type { XrStatus } from '../rendering/xr-runtime';
import type { LandscapeDiagnostics } from '../world/world-runtime';
import type { FrameMetrics } from './frame-histogram';

export interface BenchmarkSnapshot extends FrameMetrics {
  readonly profile: QualityProfileName;
  readonly mode: BenchmarkMode;
  readonly diagnostics: LandscapeDiagnostics;
  readonly xr: XrStatus;
}

export interface LandscapeBenchmark {
  reset(): void;
  snapshot(): BenchmarkSnapshot;
}
