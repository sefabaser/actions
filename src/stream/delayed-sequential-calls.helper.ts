import { Wait } from 'helpers-lib';

export class DelayedSequentialCallsHelper {
  private allPromises: Promise<void>[] = [];

  callEachDelayed<T>(values: T[], callback: (value: T) => void): void {
    let promise = new Promise<void>(resolve => {
      (async () => {
        for (let value of values) {
          await Wait();
          callback(value);
        }
        resolve();
      })();
    });
    this.allPromises.push(promise);
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
