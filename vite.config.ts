/**
 * Keeps the procedural variant worker as an ES module so its dynamic EZ-Tree import can code-split.
 * All other Vite defaults remain unchanged.
 */

import { defineConfig } from 'vite';

export default defineConfig({
  worker: {
    format: 'es',
  },
});
