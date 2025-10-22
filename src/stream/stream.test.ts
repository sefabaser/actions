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
    test('chaining with tap action', async () => {
      let action = new Action<string>();

      let heap: any[] = [];
      action
        .tap(data => {
          heap.push(data);
          return data + '1';
        })
        .tap(data => {
          heap.push(data);
        });

      callEachDelayed(['a', 'b', 'c'], value => {
        action.trigger(value);
      });

      await Wait(100);

      expect(heap).toEqual(['a', 'a1', 'b', 'b1', 'c', 'c1']);
    });

    test('tap returning actions', async () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();

      let heap: any[] = [];
      action1
        .tap(data => {
          heap.push(data);
          return data + '1';
        })
        .tap(data => {
          heap.push(data);
          return action2;
        })
        .tap(data => {
          heap.push(data);
        });

      callEachDelayed(['a', 'b', 'c'], value => {
        action1.trigger(value);
        action2.trigger(value + 'x');
      });

      await Wait(100);

      expect(heap).toEqual(['a', 'a1', 'ax', 'b', 'b1', 'bx', 'c', 'c1', 'cx']);
    });

    test('chaining with tap action unsubscribing', async () => {
      let action = new Action<string>();
      let action2 = new Action<string>();

      let triggered = false;
      let stream = action
        .tap(() => {
          return action2;
        })
        .tap(() => {
          triggered = true;
        });

      expect(action.listenerCount).toEqual(1);

      action.trigger('');
      action2.trigger('');

      await Wait(100);

      stream.destroy();
      expect(action.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);

      expect(triggered).toEqual(true);
    });
  });
});
