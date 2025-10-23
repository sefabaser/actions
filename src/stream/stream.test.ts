import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { ActionLibUnitTestHelper } from '../helpers/unit-test.helper';
import { Action } from '../observables/action/action';
import { DelayedSequentialCallsHelper } from './delayed-sequential-calls.helper';
import { Stream2 } from './stream';

describe('Stream', () => {
  let delayedCalls = new DelayedSequentialCallsHelper();

  beforeEach(() => {
    ActionLibUnitTestHelper.hardReset();
  });

  describe('Basics', () => {
    test('sync data chaining', () => {
      new Stream2<string>(resolve => resolve('a'))
        .tap(data => {
          expect(data).toEqual('a');
          return 1;
        })
        .tap(data => {
          expect(data).toEqual(1);
        })
        .tap(data => {
          expect(data).toEqual(undefined);
        })
        .attachToRoot();
    });

    test('async resolve data chaining', () => {
      new Stream2<string>(resolve => setTimeout(() => resolve('a')))
        .tap(data => {
          expect(data).toEqual('a');
          return 1;
        })
        .tap(data => {
          expect(data).toEqual(1);
        })
        .attachToRoot();
    });

    test('tap returning new sync stream', () => {
      new Stream2<string>(resolve => resolve('a'))
        .tap(data => {
          expect(data).toEqual('a');
          return new Stream2<number>(resolve => resolve(1));
        })
        .tap(data => {
          expect(data).toEqual(1);
        })
        .attachToRoot();
    });

    test('tap returning new async stream', () => {
      new Stream2<string>(resolve => setTimeout(() => resolve('a')))
        .tap(data => {
          expect(data).toEqual('a');
          return new Stream2<number>(resolve => setTimeout(() => resolve(1)));
        })
        .tap(data => {
          expect(data).toEqual(1);
        })
        .attachToRoot();
    });
  });

  describe('Multiple triggered streams', () => {
    test('simple continues stream', async () => {
      let heap: any[] = [];
      let streamResolve!: (value: string) => void;
      new Stream2<string>(resolve => {
        streamResolve = resolve;
      })
        .tap(data => {
          heap.push(data);
        })
        .attachToRoot();

      delayedCalls.callEachDelayed(['a', 'b', 'c'], value => streamResolve(value));

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('continues stream chaining source', async () => {
      let heap: any[] = [];
      let streamResolve!: (value: string) => void;
      new Stream2<string>(resolve => {
        streamResolve = resolve;
      })
        .tap(data => {
          heap.push(data);
          return data + '1';
        })
        .tap(data => {
          heap.push(data);
        })
        .attachToRoot();

      delayedCalls.callEachDelayed(['a', 'b', 'c'], value => streamResolve(value));

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual(['a', 'a1', 'b', 'b1', 'c', 'c1']);
    });

    test('continues stream chaining target', async () => {
      let heap: any[] = [];

      new Stream2<string>(resolve => resolve('a'))
        .tap(data => {
          heap.push(data);
          return new Stream2<string>(resolve => {
            delayedCalls.callEachDelayed(['1', '2', '3'], value => {
              resolve(data + value);
            });
          });
        })
        .tap(data => {
          heap.push(data);
        })
        .attachToRoot();

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual(['a', 'a1']);
    });

    test('continues stream chaining source and target', async () => {
      let heap: any[] = [];

      new Stream2<string>(resolve => {
        delayedCalls.callEachDelayed(['a', 'b', 'c'], value => resolve(value));
      })
        .tap(data => {
          heap.push(data);
          return new Stream2<string>(resolve => {
            delayedCalls.callEachDelayed(['1', '2', '3'], value => {
              resolve(data + value);
            });
          });
        })
        .tap(data => {
          heap.push(data);
        })
        .attachToRoot();

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual(['a', 'a1', 'b', 'b1', 'c', 'c1']);
    });

    test('continues multiple streams chaining source and target', async () => {
      let heap: any[] = [];

      let resolve: (data: string) => void;
      let resolveValues = ['a', 'b', 'c'];
      let resolveNext = () => {
        if (resolveValues.length > 0) {
          resolve(resolveValues.shift()!);
        }
      };

      new Stream2<string>(r => {
        resolve = r;
      })
        .tap(data => {
          heap.push(data);
          return new Stream2<string>(resolve => {
            delayedCalls.callEachDelayed(['1', '2', '3'], value => {
              resolve(data + value);
            });
          });
        })
        .tap(data => {
          heap.push(data);
          return new Stream2<string>(resolve => {
            delayedCalls.callEachDelayed(['x', 'y', 'z'], value => {
              resolve(data + value);
            });
          });
        })
        .tap(data => {
          heap.push(data);
          resolveNext();
        })
        .attachToRoot();

      resolveNext();

      await delayedCalls.waitForAllPromises();
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
        })
        .attachToRoot();

      delayedCalls.callEachDelayed(['a', 'b', 'c'], value => {
        action.trigger(value);
      });

      await delayedCalls.waitForAllPromises();
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
        })
        .attachToRoot();

      delayedCalls.callEachDelayed(['a', 'b', 'c'], value => {
        action1.trigger(value);
        action2.trigger(value + 'x');
      });

      await delayedCalls.waitForAllPromises();
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
        })
        .attachToRoot();

      expect(action.listenerCount).toEqual(1);

      action.trigger('');
      action2.trigger('');

      stream.destroy();
      expect(action.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);

      expect(triggered).toEqual(true);
    });
  });

  describe('Combinations', () => {
    test('stream and action', async () => {
      let action = new Action<string>();
      let foo = (data: string) => {
        return new Stream2<string>(resolve => {
          delayedCalls.callEachDelayed(['a', 'b', 'c'], value => resolve(data + value));
        });
      };

      let heap: string[] = [];
      action
        .tap(data => foo(data))
        .tap(data => {
          heap.push(data);
        })
        .attachToRoot();

      delayedCalls.callEachDelayed(['1', '2', '3'], value => {
        action.trigger(value);
      });

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual(['1a', '2a', '3a']);
    });
  });

  describe('Attachment', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('not attaching to anything should throw error', () => {
      expect(() => {
        let action = new Action<string>();
        action.tap(() => {});

        vi.runAllTimers();
      }).toThrow('LightweightAttachable: The object is not attached to anything!');
    });

    test('attaching to a target should not throw error', () => {
      expect(() => {
        let action = new Action<string>();
        action.tap(() => {}).attach(new Attachable().attachToRoot());

        vi.runAllTimers();
      }).not.toThrow('LightweightAttachable: The object is not attached to anything!');
    });

    test('attaching to root should not throw error', () => {
      expect(() => {
        let action = new Action<string>();
        action.tap(() => {}).attachToRoot();
        action.trigger('');

        vi.runAllTimers();
      }).not.toThrow('LightweightAttachable: The object is not attached to anything!');
    });

    test('not attaching the chain to a target should throw error', () => {
      expect(() => {
        let action1 = new Action<string>();
        let action2 = new Action<string>();
        action1.tap(() => action2).tap(() => {});

        action1.trigger('');

        vi.runAllTimers();
      }).toThrow('LightweightAttachable: The object is not attached to anything!');
    });

    test('attaching the chain to a target should not throw error', () => {
      expect(() => {
        let action1 = new Action<string>();
        let action2 = new Action<string>();
        action1
          .tap(() => action2)
          .tap(() => {})
          .attach(new Attachable().attachToRoot());

        action1.trigger('');

        vi.runAllTimers();
      }).not.toThrow('LightweightAttachable: The object is not attached to anything!');
    });

    test('attaching the chain to root should not throw error', () => {
      expect(() => {
        let action1 = new Action<string>();
        let action2 = new Action<string>();
        action1
          .tap(() => action2)
          .tap(() => {})
          .attachToRoot();

        action1.trigger('');

        vi.runAllTimers();
      }).not.toThrow('LightweightAttachable: The object is not attached to anything!');
    });
  });

  describe('Edge Cases', () => {
    test('execution should stop listening notifiers even it is in the middle on destruction', () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();

      let triggered = false;
      let stream = action1
        .tap(() => action2)
        .tap(() => {
          triggered = true;
        })
        .attachToRoot();

      action1.trigger('');

      expect(triggered).toEqual(false);
      expect(action2.listenerCount).toEqual(1);

      stream.destroy();
      expect(action2.listenerCount).toEqual(0);

      action2.trigger('');
      expect(triggered).toEqual(false);
    });

    test('execution should stop listening streams even it is in the middle on destruction', async () => {
      let resolve1!: () => void;
      let resolve2!: () => void;

      let middleStream!: Stream2<void>;

      let triggered = false;
      let stream = new Stream2<void>(resolve => {
        resolve1 = resolve;
      })
        .tap(() => {
          middleStream = new Stream2<void>(resolve => {
            resolve2 = resolve;
          });
          return middleStream;
        })
        .tap(() => {
          triggered = true;
        })
        .attachToRoot();

      resolve1?.();
      expect(middleStream['listener']).toBeDefined();

      stream.destroy();
      expect(middleStream['listener']).toBeUndefined();

      resolve2?.();
      expect(middleStream['listener']).toBeUndefined();
      expect(triggered).toEqual(false);
    });

    test('multiple chain triggers should successfully unsubscribe on destruction', () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();
      let stream = action1
        .tap(() => action2)
        .tap(() => {})
        .attachToRoot();

      action1.trigger('');
      action1.trigger('');

      expect(action1.listenerCount).toEqual(1);
      expect(action2.listenerCount).toEqual(2);

      stream.destroy();
      expect(action1.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);
    });
  });
});
