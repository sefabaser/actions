import { describe, expect, test } from 'vitest';

class Stream<T> {
  private data: T | undefined;
  private listener: ((data: T) => void) | undefined;

  constructor(executor: (resolve: (data: T) => void) => void) {
    executor(data => {
      if (this.listener) {
        this.listener(data);
      } else {
        this.data = data;
      }
    });
  }

  tap<K>(callback: (data: T) => K): Stream<K> {
    return new Stream<K>(resolve => {
      if (this.data) {
        let result = callback(this.data);
        resolve(result);
      } else {
        this.listener = data => {
          let result = callback(data);
          resolve(result);
        };
      }
    });
  }
}

describe('Stream', () => {
  test('sync data chaining', () => {
    new Stream<string>(resolve => resolve('a'))
      .tap(data => {
        expect(data).toEqual('a');
        return 1;
      })
      .tap(data => {
        expect(data).toEqual(1);
      })
      .tap(data => {
        expect(data).toEqual(undefined);
      });
  });
});
