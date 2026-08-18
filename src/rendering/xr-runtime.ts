/**
 * Minimal PICO-first WebXR adapter for entering VR and requesting the fixed 90 Hz target.
 * It owns only Three.js XR setup, button lifetime, and observable session-rate evidence.
 */

import type { WebGLRenderer } from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { RENDERING } from '../config';

export interface XrStatus {
  active: boolean;
  frameRate: number | null;
  readonly targetFrameRate: number;
  supportedFrameRates: readonly number[];
  targetRequestSucceeded: boolean;
  error: string | null;
}

export interface XrRuntime {
  readonly status: XrStatus;
  dispose(): void;
}

export function configureXr(renderer: WebGLRenderer): XrRuntime {
  const status = createStatus();
  if (!RENDERING.xrEnabled) return { status, dispose() {} };
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFramebufferScaleFactor(RENDERING.xrFramebufferScale);
  renderer.xr.setFoveation(RENDERING.xrFoveation);
  const button = VRButton.createButton(renderer, { optionalFeatures: ['local-floor'] });
  document.body.append(button);
  const sessionStart = (): void => void updateSessionStatus(renderer, status);
  const sessionEnd = (): void => {
    status.active = false;
    status.frameRate = null;
  };
  renderer.xr.addEventListener('sessionstart', sessionStart);
  renderer.xr.addEventListener('sessionend', sessionEnd);
  return {
    status,
    dispose(): void {
      renderer.xr.removeEventListener('sessionstart', sessionStart);
      renderer.xr.removeEventListener('sessionend', sessionEnd);
      button.remove();
    },
  };
}

async function updateSessionStatus(renderer: WebGLRenderer, status: XrStatus): Promise<void> {
  const session = renderer.xr.getSession();
  if (!session) return;
  writeSessionEvidence(session, status);
  if (!status.supportedFrameRates.includes(RENDERING.xrTargetFrameRate)) return;
  await requestTargetFrameRate(session, status);
}

function writeSessionEvidence(session: XRSession, status: XrStatus): void {
  status.active = true;
  status.frameRate = session.frameRate ?? null;
  status.supportedFrameRates = Array.from(session.supportedFrameRates ?? []);
}

async function requestTargetFrameRate(session: XRSession, status: XrStatus): Promise<void> {
  try {
    await session.updateTargetFrameRate(RENDERING.xrTargetFrameRate);
    status.targetRequestSucceeded = true;
    status.frameRate = session.frameRate ?? RENDERING.xrTargetFrameRate;
  } catch (error) {
    status.error = error instanceof Error ? error.message : 'Could not request the XR target frame rate.';
  }
}

function createStatus(): XrStatus {
  return {
    active: false,
    frameRate: null,
    targetFrameRate: RENDERING.xrTargetFrameRate,
    supportedFrameRates: [],
    targetRequestSucceeded: false,
    error: null,
  };
}
