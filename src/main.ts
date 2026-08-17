/**
 * Browser entrypoint for the endless landscape prototype.
 * Owns only DOM bootstrap and delegates scene lifetime to the world runtime.
 */

import './styles.css';
import { loadLandscapeAssets } from './assets/landscape-assets';
import { WorldRuntime } from './world/world-runtime';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root element.');
}

app.innerHTML = `
  <main id="world" aria-label="Prozedural erzeugte 3D-Landschaft"></main>
  <div class="vignette" aria-hidden="true"></div>
  <div class="crosshair" aria-hidden="true"></div>
  <section class="instructions" aria-live="polite">
    <p class="eyebrow">ENDLESS WILDS</p>
    <h1>Klicken, um zu fliegen</h1>
    <p>WASD · Maus · Space / Shift · Mausrad</p>
  </section>
  <output class="diagnostics" aria-label="Renderdiagnostik"></output>
`;

const world = app.querySelector<HTMLElement>('#world');
const diagnostics = app.querySelector<HTMLOutputElement>('.diagnostics');

if (!world || !diagnostics) {
  throw new Error('Landscape shell could not be created.');
}

try {
  const assets = await loadLandscapeAssets();
  const runtime = new WorldRuntime(world, diagnostics, assets);
  runtime.start();
  window.addEventListener('pagehide', () => runtime.dispose(), { once: true });
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  app.innerHTML = `<p class="fatal-error">Die Landschaft konnte nicht gestartet werden.<br>${message}</p>`;
  throw error;
}
