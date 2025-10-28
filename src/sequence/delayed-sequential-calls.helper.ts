import { Wait } from 'helpers-lib';

export class DelayedSequentialCallsHelper {
  private allPromises: Promise<void>[] = [];
  private allResolves = new Set<(value: void | PromiseLike<void>) => void>();

  callEachDelayed<T>(values: T[], callback: (value: T) => void): void {
    let promise = new Promise<void>(resolve => {
      this.allResolves.add(resolve);
      (async () => {
        for (let value of values) {
          await Wait();
          try {
            callback(value);
          } catch (e) {
            resolve();
            this.allResolves.delete(resolve);
            throw e;
          }
        }
        resolve();
        this.allResolves.delete(resolve);
      })();
    });
    this.allPromises.push(promise);
  }

  reset() {
    this.allResolves.forEach(resolve => resolve());
    this.allResolves.clear();
  }

  async waitForAllPromises(): Promise<void> {
    let promises = [...this.allPromises];
    this.allPromises = [];

    await Promise.all(promises);
    if (this.allPromises.length > 0) {
      await this.waitForAllPromises();
    }
  }
}
