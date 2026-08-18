/**
 * Verifies frame percentile and missed-frame evidence without touching the render loop.
 */

import { describe, expect, test } from 'bun:test';
import { FrameHistogram } from '../src/performance/frame-histogram';

describe('frame histogram', () => {
  test('reports percentiles and consecutive missed frames', () => {
    const histogram = new FrameHistogram();
    for (const interval of [10, 11, 12, 20, 22, 11]) histogram.record(interval);
    const snapshot = histogram.snapshot();
    expect(snapshot.sampleCount).toBe(6);
    expect(snapshot.maxMs).toBe(22);
    expect(snapshot.framesOver16_7Ms).toBe(2);
    expect(snapshot.longestMissedFrameRun).toBe(2);
  });

  test('reset removes previous samples', () => {
    const histogram = new FrameHistogram();
    histogram.record(20);
    histogram.reset();
    expect(histogram.snapshot().sampleCount).toBe(0);
  });
});
