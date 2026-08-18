/**
 * Browser-global diagnostics contract for automated and manual performance checks.
 * It exposes read-only runtime evidence and intentionally no mutation hooks.
 */

import type { LandscapeDiagnostics } from './world/landscape-diagnostics';

declare global {
  interface Window {
    __LANDSCAPE_DIAGNOSTICS__?: LandscapeDiagnostics;
  }
}

export {};
