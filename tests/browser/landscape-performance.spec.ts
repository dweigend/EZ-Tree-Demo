/**
 * Exercises shader compilation, streaming, and renderer budgets during a 12-second deterministic flight.
 */

import { expect, test } from '@playwright/test';

test('static landscape keeps high local density inside the desktop geometry budget', async ({ page }) => {
  await page.goto('/?profile=desktop');
  await page.waitForFunction(() => (window.__LANDSCAPE_DIAGNOSTICS__?.grassBlades ?? 0) > 55_000);
  const diagnostics = await page.evaluate(() => window.__LANDSCAPE_DIAGNOSTICS__);
  expect(diagnostics?.trees).toBeGreaterThan(620);
  expect(diagnostics?.grassBlades).toBeGreaterThan(55_000);
  expect(diagnostics?.flowers).toBeGreaterThan(1_350);
  expect(diagnostics?.rocks).toBeGreaterThan(650);
  expect(diagnostics?.drawCalls).toBeLessThanOrEqual(45);
  expect(diagnostics?.triangles).toBeLessThanOrEqual(2_400_000);
});

test('desktop flight stays inside the landscape render budget', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto('/?profile=desktop&benchmark=desktop-flight');
  await page.waitForFunction(() => (window.__LANDSCAPE_DIAGNOSTICS__?.drawCalls ?? 0) > 0);
  await page.evaluate(() => window.__LANDSCAPE_BENCHMARK__?.reset());
  await page.waitForTimeout(12_000);
  const snapshot = await page.evaluate(() => window.__LANDSCAPE_BENCHMARK__?.snapshot());
  expect(snapshot).toBeDefined();
  expect(snapshot?.profile).toBe('desktop');
  expect(snapshot?.diagnostics.fps).toBeGreaterThanOrEqual(118);
  expect(snapshot?.diagnostics.drawCalls).toBeLessThanOrEqual(40);
  expect(snapshot?.diagnostics.triangles).toBeLessThanOrEqual(1_200_000);
  expect(snapshot?.p50Ms).toBeLessThanOrEqual(8.4);
  expect(snapshot?.p99Ms).toBeLessThanOrEqual(10);
  expect(snapshot?.framesOver16_7Percent).toBeLessThanOrEqual(0.1);
  expect(snapshot?.longestMissedFrameRun).toBeLessThanOrEqual(1);
  expect(consoleErrors).toEqual([]);
  await testInfo.attach('landscape-desktop-flight', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

test('PICO profile keeps non-XR render work below headset ceilings', async ({ page }) => {
  await page.goto('/?profile=pico90');
  await page.waitForFunction(() => (window.__LANDSCAPE_DIAGNOSTICS__?.grassBlades ?? 0) > 19_000);
  const snapshot = await page.evaluate(() => window.__LANDSCAPE_BENCHMARK__?.snapshot());
  expect(snapshot?.profile).toBe('pico90');
  expect(snapshot?.diagnostics.trees).toBeGreaterThan(200);
  expect(snapshot?.diagnostics.flowers).toBeGreaterThan(680);
  expect(snapshot?.diagnostics.rocks).toBeGreaterThan(175);
  expect(snapshot?.diagnostics.drawCalls).toBeLessThanOrEqual(40);
  expect(snapshot?.diagnostics.triangles).toBeLessThanOrEqual(800_000);
});
