import { Wait } from 'helpers-lib';

export interface UnitTestHelperPerformanceTestOptions {
  readonly sampleCount: number;
  readonly repetationPerSample: number;
  readonly printResult: boolean;
}

export class UnitTestHelper {
  private static allPromises: Promise<void>[] = [];
  private static allResolves = new Set<(value: void | PromiseLike<void>) => void>();

  static callEachDelayed<T>(values: T[], callback: (value: T) => void, allDone?: () => void, duration?: number): void {
    let promise = new Promise<void>((resolve, reject) => {
      this.allResolves.add(resolve);
      (async () => {
        for (let value of values) {
          await Wait(duration);
          try {
            callback(value);
          } catch (e) {
            this.allResolves.delete(resolve);
            reject(e);
            return;
          }
        }
        resolve();
        this.allResolves.delete(resolve);
      })();
    }).finally(allDone);
    this.allPromises.push(promise);
  }

  static async waitForAllOperations(): Promise<void> {
    let promises = [...this.allPromises];
    this.allPromises = [];

    await Promise.all(promises);
    if (this.allPromises.length > 0) {
      await this.waitForAllOperations();
    }
  }

  static reset() {
    this.allResolves.forEach(resolve => resolve());
    this.allResolves.clear();
  }

  static async testPerformance(
    callback: () => void,
    partialOptions?: Partial<UnitTestHelperPerformanceTestOptions>
  ): Promise<number> {
    let options: UnitTestHelperPerformanceTestOptions = {
      sampleCount: 500,
      repetationPerSample: 1000,
      printResult: true,
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
      if (global.gc) {
        global.gc();
        await Wait();
      }
    }

    durations = durations.sort((a, b) => a - b);
    let min = durations[0];

    if (options.printResult) {
      console.info('Min: ', min);
    }
    return min;
  }
}
