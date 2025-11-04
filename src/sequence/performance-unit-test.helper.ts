import { Wait } from 'helpers-lib';

export interface PerformanceUnitTestHelperOptions {
  readonly sampleCount: number;
  readonly repetationPerSample: number;
}

export class PerformanceUnitTestHelper {
  static async testPerformance(
    callback: () => void,
    partialOptions?: Partial<PerformanceUnitTestHelperOptions>
  ): Promise<number> {
    let options: PerformanceUnitTestHelperOptions = {
      sampleCount: 500,
      repetationPerSample: 1000,
      ...partialOptions
    };

    let start: number;
    let end: number;
    let durations: number[] = [];

    for (let v = 0; v < options.sampleCount; v++) {
      start = performance.now();
      for (let i = 0; i < options.repetationPerSample; i++) {
        callback();
      }
      end = performance.now();
      durations.push(end - start);

      await Wait();
      global.gc?.();
      await Wait();
    }

    durations = durations.sort((a, b) => a - b);
    let min = durations[0];

    console.info('Min: ', min);
    return min;
  }
}
