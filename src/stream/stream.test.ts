import { Wait } from 'helpers-lib';
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

  tap<K>(callback: (data: T) => K | Stream<K>): Stream<K> {
    return new Stream<K>(resolve => {
      this.getData(data => {
        let result = callback(data);
        if (result instanceof Stream) {
          result.getData(resolve);
        } else {
          resolve(result);
        }
      });
    });
  }

  private getData<K>(callback: (data: T) => K | Stream<K>): void {
    if (this.data) {
      callback(this.data);
    }
    this.listener = data => callback(data);
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

  test('async resolve data chaining', () => {
    new Stream<string>(resolve => setTimeout(() => resolve('a')))
      .tap(data => {
        expect(data).toEqual('a');
        return 1;
      })
      .tap(data => {
        expect(data).toEqual(1);
      });
  });

  test('tap returning new sync stream', () => {
    new Stream<string>(resolve => resolve('a'))
      .tap(data => {
        expect(data).toEqual('a');
        return new Stream<number>(resolve => resolve(1));
      })
      .tap(data => {
        expect(data).toEqual(1);
      });
  });

  test('tap returning new async stream', () => {
    new Stream<string>(resolve => setTimeout(() => resolve('a')))
      .tap(data => {
        expect(data).toEqual('a');
        return new Stream<number>(resolve => setTimeout(() => resolve(1)));
      })
      .tap(data => {
        expect(data).toEqual(1);
      });
  });

  test('continues stream chaining source', async () => {
    let heap: any[] = [];
    new Stream<string>(resolve => {
      resolve('a');
      setTimeout(() => resolve('b'));
    })
      .tap(data => {
        heap.push(data);
        return data + '1';
      })
      .tap(data => {
        heap.push(data);
      });

    await Wait(10);
    expect(heap).toEqual(['a', 'a1', 'b', 'b1']);
  });

  test('continues stream chaining target', async () => {
    let heap: any[] = [];
    new Stream<string>(resolve => resolve('a'))
      .tap(data => {
        heap.push(data);
        return new Stream<string>(resolve => {
          resolve(data + '1');
          setTimeout(() => resolve(data + '2'));
        });
      })
      .tap(data => {
        heap.push(data);
      });

    await Wait(10);
    expect(heap).toEqual(['a', 'a1']);
  });

  test('continues stream chaining source and target', async () => {
    let heap: any[] = [];
    new Stream<string>(resolve => {
      resolve('a');
      setTimeout(() => resolve('b'));
    })
      .tap(data => {
        heap.push(data);
        return new Stream<string>(resolve => {
          resolve(data + '1');
          setTimeout(() => resolve(data + '2'));
        });
      })
      .tap(data => {
        heap.push(data);
      });

    await Wait(10);
    expect(heap).toEqual(['a', 'a1', 'b', 'b1']);
  });
});
