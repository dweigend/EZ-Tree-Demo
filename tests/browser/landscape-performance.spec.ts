/**
 * Exercises shader compilation, streaming, and bounded renderer work without treating CI timing as a frame-rate gate.
 */

import { expect, test } from '@playwright/test';

test('static landscape fills the desktop view without runaway renderer work', async ({ page }) => {
  await page.goto('/?profile=desktop');
  await page.waitForFunction(() => (window.__LANDSCAPE_DIAGNOSTICS__?.grassPatches ?? 0) >= 30);
  const diagnostics = await page.evaluate(() => window.__LANDSCAPE_DIAGNOSTICS__);
  expect(diagnostics?.trees).toBeGreaterThanOrEqual(400);
  expect(diagnostics?.grassPatches).toBeGreaterThanOrEqual(30);
  expect(diagnostics?.grassTufts).toBeGreaterThan(80);
  expect(diagnostics?.rocks).toBeGreaterThan(400);
  expect(diagnostics?.drawCalls).toBeLessThanOrEqual(100);
  expect(diagnostics?.triangles).toBeLessThanOrEqual(10_000_000);
});

test('desktop flight streams the landscape without render or console failures', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto('/?profile=desktop&benchmark=desktop-flight');
  await page.waitForFunction(() => (window.__LANDSCAPE_DIAGNOSTICS__?.drawCalls ?? 0) > 0);
  await page.evaluate(() => window.__LANDSCAPE_BENCHMARK__?.reset());
  await page.waitForTimeout(4_000);
  const snapshot = await page.evaluate(() => window.__LANDSCAPE_BENCHMARK__?.snapshot());
  expect(snapshot).toBeDefined();
  expect(snapshot?.profile).toBe('desktop');
  expect(snapshot?.sampleCount).toBeGreaterThan(30);
  expect(snapshot?.diagnostics.drawCalls).toBeLessThanOrEqual(100);
  expect(snapshot?.diagnostics.triangles).toBeLessThanOrEqual(10_000_000);
  expect(consoleErrors).toEqual([]);
  await testInfo.attach('landscape-desktop-flight', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

test('PICO profile keeps non-XR render work below headset ceilings', async ({ page }) => {
  await page.goto('/?profile=pico90');
  await page.waitForFunction(() => (window.__LANDSCAPE_DIAGNOSTICS__?.grassPatches ?? 0) >= 12);
  const snapshot = await page.evaluate(() => window.__LANDSCAPE_BENCHMARK__?.snapshot());
  expect(snapshot?.profile).toBe('pico90');
  expect(snapshot?.diagnostics.trees).toBeGreaterThan(160);
  expect(snapshot?.diagnostics.grassPatches).toBeGreaterThanOrEqual(12);
  expect(snapshot?.diagnostics.grassTufts).toBeGreaterThan(25);
  expect(snapshot?.diagnostics.rocks).toBeGreaterThan(100);
  expect(snapshot?.diagnostics.drawCalls).toBeLessThanOrEqual(80);
  expect(snapshot?.diagnostics.triangles).toBeLessThanOrEqual(1_500_000);
});

test('background preset generation stays single-job and error-free', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto('/?profile=desktop&benchmark=desktop-flight&variantStress=1');
  await page.waitForFunction(() => (window.__LANDSCAPE_DIAGNOSTICS__?.drawCalls ?? 0) > 0);
  await page.evaluate(() => window.__LANDSCAPE_BENCHMARK__?.reset());
  await page.waitForFunction(() => (window.__LANDSCAPE_DIAGNOSTICS__?.generatedVariants ?? 0) >= 3, null, {
    timeout: 20_000,
  });
  const snapshot = await page.evaluate(() => window.__LANDSCAPE_BENCHMARK__?.snapshot());
  expect(snapshot?.diagnostics.generatedVariants).toBeGreaterThanOrEqual(3);
  expect(snapshot?.diagnostics.pendingVariantJobs).toBeLessThanOrEqual(1);
  expect(snapshot?.diagnostics.lastVariantGenerationMs).toBeGreaterThan(0);
  expect(snapshot?.sampleCount).toBeGreaterThan(0);
  expect(consoleErrors).toEqual([]);
  await page.goto('about:blank');
  expect(consoleErrors).toEqual([]);
});
