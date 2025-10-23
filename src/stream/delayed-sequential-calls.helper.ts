import { Wait } from 'helpers-lib';

export class DelayedSequentialCallsHelper {
  private allPromises: Promise<void>[] = [];

  callEachDelayed<T>(values: T[], callback: (value: T) => void): void {
    let promise = new Promise<void>(resolve => {
      (async () => {
        for (let value of values) {
          callback(value);
          await Wait();
        }
        resolve();
      })();
    });
    this.allPromises.push(promise);
  }

  async waitForAllPromises(): Promise<void> {
    await Promise.all(this.allPromises);
    this.allPromises = [];
  }
}
