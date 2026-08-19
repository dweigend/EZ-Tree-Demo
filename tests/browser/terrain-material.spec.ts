/**
 * Boots the desktop terrain once and rejects Three.js/WebGL shader compilation diagnostics.
 */

import { expect, test } from '@playwright/test';

test('terrain material compiles with the packed surface atlas', async ({ page }) => {
  const shaderErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/shader|WebGLProgram/i.test(text)) shaderErrors.push(text);
  });

  await page.goto('/?profile=desktop');
  await page.waitForTimeout(500);

  expect(shaderErrors).toEqual([]);
});
