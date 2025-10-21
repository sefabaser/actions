import { Wait } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { ActionLibUnitTestHelper } from '../helpers/unit-test.helper';
import { Action } from '../observables/action/action';
import { Stream } from './stream';

describe('Stream', () => {
  function callEachDelayed(values: any[], callback: (value: any) => void): void {
    (async () => {
      for (let value of values) {
        callback(value);
        await Wait();
      }
    })();
  }

  beforeEach(() => {
    ActionLibUnitTestHelper.hardReset();
  });

  describe('Basics', () => {
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
  });

  describe('Multiple triggered streams', () => {
    test('continues stream chaining source', async () => {
      let heap: any[] = [];
      new Stream<string>(resolve => {
        callEachDelayed(['a', 'b', 'c'], value => resolve(value));
      })
        .tap(data => {
          heap.push(data);
          return data + '1';
        })
        .tap(data => {
          heap.push(data);
        });

      await Wait(100);
      expect(heap).toEqual(['a', 'a1', 'b', 'b1', 'c', 'c1']);
    });

    test('continues stream chaining target', async () => {
      let heap: any[] = [];
      new Stream<string>(resolve => resolve('a'))
        .tap(data => {
          heap.push(data);
          return new Stream<string>(resolve => {
            callEachDelayed(['1', '2', '3'], value => {
              resolve(data + value);
            });
          });
        })
        .tap(data => {
          heap.push(data);
        });

      await Wait(100);
      expect(heap).toEqual(['a', 'a1']);
    });

    test('continues stream chaining source and target', async () => {
      let heap: any[] = [];
      new Stream<string>(resolve => {
        callEachDelayed(['a', 'b', 'c'], value => resolve(value));
      })
        .tap(data => {
          heap.push(data);
          return new Stream<string>(resolve => {
            callEachDelayed(['1', '2', '3'], value => {
              resolve(data + value);
            });
          });
        })
        .tap(data => {
          heap.push(data);
        });

      await Wait(100);
      expect(heap).toEqual(['a', 'a1', 'b', 'b1', 'c', 'c1']);
    });

    test('continues multiple streams chaining source and target', async () => {
      let heap: any[] = [];
      new Stream<string>(resolve => {
        callEachDelayed(['a', 'b', 'c'], value => resolve(value));
      })
        .tap(data => {
          heap.push(data);
          return new Stream<string>(resolve => {
            callEachDelayed(['1', '2', '3'], value => {
              resolve(data + value);
            });
          });
        })
        .tap(data => {
          heap.push(data);
          return new Stream<string>(resolve => {
            callEachDelayed(['x', 'y', 'z'], value => {
              resolve(data + value);
            });
          });
        })
        .tap(data => {
          heap.push(data);
        });

      await Wait(100);
      expect(heap).toEqual(['a', 'a1', 'a1x', 'b', 'b1', 'b1x', 'c', 'c1', 'c1x']);
    });
  });

  describe('Actions', () => {
    test('continues stream chaining source', async () => {
      let action = new Action<string>();

      let heap: any[] = [];
      let stream = action
        .tap(data => {
          heap.push(data);
          return data + '1';
        })
        .tap(data => {
          heap.push(data);
        });

      expect(action.listenerCount).toEqual(1);

      callEachDelayed(['a', 'b', 'c'], value => action.trigger(value));

      await Wait(100);
      stream.destroy();
      expect(action.listenerCount).toEqual(0);

      expect(heap).toEqual(['a', 'a1', 'b', 'b1', 'c', 'c1']);
    });
  });
});
