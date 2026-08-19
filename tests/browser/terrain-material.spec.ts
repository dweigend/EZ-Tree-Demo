/**
 * Boots both quality profiles and rejects shared terrain shader compilation diagnostics.
 */

import { expect, test } from '@playwright/test';

test('shared terrain material compiles for desktop and PICO profiles', async ({ page }) => {
  const shaderErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/shader|WebGLProgram/i.test(text)) shaderErrors.push(text);
  });

  for (const profile of ['desktop', 'pico90']) {
    await page.goto(`/?profile=${profile}`);
    await page.waitForTimeout(500);
  }

  expect(shaderErrors).toEqual([]);
});
