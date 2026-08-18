/**
 * Fixed-capacity frame interval recorder for deterministic browser and headset benchmarks.
 * Per-frame recording performs no allocation; percentile work happens only when a snapshot is requested.
 */

const SAMPLE_CAPACITY = 60_000;
const MISSED_FRAME_THRESHOLD_MS = 16.7;

export interface FrameMetrics {
  readonly sampleCount: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly maxMs: number;
  readonly framesOver16_7Ms: number;
  readonly framesOver16_7Percent: number;
  readonly longestMissedFrameRun: number;
}

export class FrameHistogram {
  private readonly samples = new Float32Array(SAMPLE_CAPACITY);
  private sampleCount = 0;
  private writeIndex = 0;
  private missedFrames = 0;
  private currentMissedRun = 0;
  private longestMissedRun = 0;

  public record(intervalMs: number): void {
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;
    this.samples[this.writeIndex] = intervalMs;
    this.writeIndex = (this.writeIndex + 1) % SAMPLE_CAPACITY;
    this.sampleCount = Math.min(this.sampleCount + 1, SAMPLE_CAPACITY);
    this.recordMiss(intervalMs > MISSED_FRAME_THRESHOLD_MS);
  }

  public reset(): void {
    this.sampleCount = 0;
    this.writeIndex = 0;
    this.missedFrames = 0;
    this.currentMissedRun = 0;
    this.longestMissedRun = 0;
  }

  public snapshot(): FrameMetrics {
    if (this.sampleCount === 0) return emptyMetrics();
    const sorted = Array.from(this.samples.subarray(0, this.sampleCount)).sort((a, b) => a - b);
    const missedPercent = (this.missedFrames / this.sampleCount) * 100;
    return {
      sampleCount: this.sampleCount,
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      p99Ms: percentile(sorted, 0.99),
      maxMs: sorted.at(-1) ?? 0,
      framesOver16_7Ms: this.missedFrames,
      framesOver16_7Percent: Number(missedPercent.toFixed(3)),
      longestMissedFrameRun: this.longestMissedRun,
    };
  }

  private recordMiss(missed: boolean): void {
    if (!missed) {
      this.currentMissedRun = 0;
      return;
    }
    this.missedFrames += 1;
    this.currentMissedRun += 1;
    this.longestMissedRun = Math.max(this.longestMissedRun, this.currentMissedRun);
  }
}

function percentile(sorted: readonly number[], quantile: number): number {
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * quantile));
  return Number((sorted[index] ?? 0).toFixed(3));
}

function emptyMetrics(): FrameMetrics {
  return {
    sampleCount: 0,
    p50Ms: 0,
    p95Ms: 0,
    p99Ms: 0,
    maxMs: 0,
    framesOver16_7Ms: 0,
    framesOver16_7Percent: 0,
    longestMissedFrameRun: 0,
  };
}
