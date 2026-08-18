/**
 * Exercises shader compilation, streaming, and renderer budgets during a 12-second deterministic flight.
 */

import { expect, test } from '@playwright/test';

test('static dense forest stays inside the desktop geometry budget', async ({ page }) => {
  await page.goto('/?profile=desktop');
  await page.waitForFunction(() => (window.__LANDSCAPE_DIAGNOSTICS__?.grassBlades ?? 0) > 40_000);
  const diagnostics = await page.evaluate(() => window.__LANDSCAPE_DIAGNOSTICS__);
  expect(diagnostics?.trees).toBeGreaterThan(500);
  expect(diagnostics?.flowers).toBeGreaterThan(1_400);
  expect(diagnostics?.rocks).toBeGreaterThan(550);
  expect(diagnostics?.drawCalls).toBeLessThanOrEqual(55);
  expect(diagnostics?.triangles).toBeLessThanOrEqual(3_700_000);
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
  expect(snapshot?.diagnostics.drawCalls).toBeLessThanOrEqual(55);
  expect(snapshot?.diagnostics.triangles).toBeLessThanOrEqual(3_600_000);
  expect(snapshot?.p99Ms).toBeLessThanOrEqual(13);
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
  await page.waitForFunction(() => (window.__LANDSCAPE_DIAGNOSTICS__?.grassBlades ?? 0) > 14_000);
  const snapshot = await page.evaluate(() => window.__LANDSCAPE_BENCHMARK__?.snapshot());
  expect(snapshot?.profile).toBe('pico90');
  expect(snapshot?.diagnostics.trees).toBeGreaterThan(180);
  expect(snapshot?.diagnostics.flowers).toBeGreaterThan(800);
  expect(snapshot?.diagnostics.rocks).toBeGreaterThan(190);
  expect(snapshot?.diagnostics.drawCalls).toBeLessThanOrEqual(55);
  expect(snapshot?.diagnostics.triangles).toBeLessThanOrEqual(1_600_000);
});
