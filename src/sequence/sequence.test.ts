import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { ActionLibUnitTestHelper } from '../helpers/unit-test.helper';
import { Action } from '../observables/action/action';
import { Variable } from '../observables/variable/variable';
import { DelayedSequentialCallsHelper } from './delayed-sequential-calls.helper';
import { Sequence } from './sequence';

describe('Sequence', () => {
  let delayedCalls = new DelayedSequentialCallsHelper();

  beforeEach(() => {
    ActionLibUnitTestHelper.hardReset();
  });

  describe('Basics', () => {
    test('sync data chaining', () => {
      new Sequence<string>(resolve => resolve('a'))
        .map(data => {
          expect(data).toEqual('a');
          return 1;
        })
        .map(data => {
          expect(data).toEqual(1);
        })
        .map(data => {
          expect(data).toEqual(undefined);
        })
        .attachToRoot();
    });

    test('async resolve data chaining', () => {
      new Sequence<string>(resolve => setTimeout(() => resolve('a')))
        .map(data => {
          expect(data).toEqual('a');
          return 1;
        })
        .map(data => {
          expect(data).toEqual(1);
        })
        .attachToRoot();
    });

    test('map returning new sync sequence', () => {
      new Sequence<string>(resolve => resolve('a'))
        .map(data => {
          expect(data).toEqual('a');
          return new Sequence<number>(resolve => resolve(1));
        })
        .map(data => {
          expect(data).toEqual(1);
        })
        .attachToRoot();
    });

    test('map returning new async sequence', () => {
      new Sequence<string>(resolve => setTimeout(() => resolve('a')))
        .map(data => {
          expect(data).toEqual('a');
          return new Sequence<number>(resolve => setTimeout(() => resolve(1)));
        })
        .map(data => {
          expect(data).toEqual(1);
        })
        .attachToRoot();
    });
  });

  describe('Multiple triggered sequences', () => {
    test('simple continues sequence', async () => {
      let heap: any[] = [];
      let sequenceResolve!: (value: string) => void;
      new Sequence<string>(resolve => {
        sequenceResolve = resolve;
      })
        .map(data => {
          heap.push(data);
        })
        .attachToRoot();

      delayedCalls.callEachDelayed(['a', 'b', 'c'], value => sequenceResolve(value));

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('continues sequence chaining source', async () => {
      let heap: any[] = [];
      let sequenceResolve!: (value: string) => void;
      new Sequence<string>(resolve => {
        sequenceResolve = resolve;
      })
        .map(data => {
          heap.push(data);
          return data + '1';
        })
        .map(data => {
          heap.push(data);
        })
        .attachToRoot();

      delayedCalls.callEachDelayed(['a', 'b', 'c'], value => sequenceResolve(value));

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual(['a', 'a1', 'b', 'b1', 'c', 'c1']);
    });

    test('continues sequence chaining target', async () => {
      let heap: any[] = [];

      new Sequence<string>(resolve => resolve('a'))
        .map(data => {
          heap.push(data);
          return new Sequence<string>(resolve => {
            delayedCalls.callEachDelayed(['1', '2', '3'], value => {
              resolve(data + value);
            });
          });
        })
        .map(data => {
          heap.push(data);
        })
        .attachToRoot();

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual(['a', 'a1']);
    });

    test('continues sequence chaining source and target', async () => {
      let heap: any[] = [];

      new Sequence<string>(resolve => {
        delayedCalls.callEachDelayed(['a', 'b', 'c'], value => resolve(value));
      })
        .map(data => {
          heap.push(data);
          return new Sequence<string>(resolve => {
            delayedCalls.callEachDelayed(['1', '2', '3'], value => {
              resolve(data + value);
            });
          });
        })
        .map(data => {
          heap.push(data);
        })
        .attachToRoot();

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual(['a', 'a1', 'b', 'b1', 'c', 'c1']);
    });

    test('continues multiple sequences chaining source and target', async () => {
      let heap: any[] = [];

      let resolve: (data: string) => void;
      let resolveValues = ['a', 'b', 'c'];
      let resolveNext = () => {
        if (resolveValues.length > 0) {
          resolve(resolveValues.shift()!);
        }
      };

      new Sequence<string>(r => {
        resolve = r;
      })
        .map(data => {
          heap.push(data);
          return new Sequence<string>(resolve => {
            delayedCalls.callEachDelayed(['1', '2', '3'], value => {
              resolve(data + value);
            });
          });
        })
        .map(data => {
          heap.push(data);
          return new Sequence<string>(resolve => {
            delayedCalls.callEachDelayed(['x', 'y', 'z'], value => {
              resolve(data + value);
            });
          });
        })
        .map(data => {
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
    test('chaining with map action', async () => {
      let action = new Action<string>();

      let heap: any[] = [];
      action
        .map(data => {
          heap.push(data);
          return data + '1';
        })
        .map(data => {
          heap.push(data);
        })
        .attachToRoot();

      delayedCalls.callEachDelayed(['a', 'b', 'c'], value => {
        action.trigger(value);
      });

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual(['a', 'a1', 'b', 'b1', 'c', 'c1']);
    });

    test('map returning actions', async () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();

      let heap: any[] = [];
      action1
        .map(data => {
          heap.push(data);
          return data + '1';
        })
        .map(data => {
          heap.push(data);
          return action2;
        })
        .map(data => {
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

    test('chaining with map action unsubscribing', async () => {
      let action = new Action<string>();
      let action2 = new Action<string>();

      let triggered = false;
      let sequence = action
        .map(() => {
          return action2;
        })
        .map(() => {
          triggered = true;
        })
        .attachToRoot();

      expect(action.listenerCount).toEqual(1);

      action.trigger('');
      action2.trigger('');

      sequence.destroy();
      expect(action.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);

      expect(triggered).toEqual(true);
    });

    test('chaining variable should trigger current value', () => {
      let variable = new Variable<string>('a');

      let heap: string[] = [];
      let sequence = variable
        .map(data => {
          heap.push(data);
        })
        .attachToRoot();

      expect(heap).toEqual(['a']);
      expect(variable.listenerCount).toEqual(1);

      sequence.destroy();
      expect(variable.listenerCount).toEqual(0);
    });
  });

  describe('Combinations', () => {
    test('sequence and action', async () => {
      let action = new Action<string>();
      let foo = (data: string) => {
        return new Sequence<string>(resolve => {
          delayedCalls.callEachDelayed(['a', 'b', 'c'], value => resolve(data + value));
        });
      };

      let heap: string[] = [];
      action
        .map(data => foo(data))
        .map(data => {
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
        action.map(() => {});

        vi.runAllTimers();
      }).toThrow('LightweightAttachable: The object is not attached to anything!');
    });

    test('attaching to a target should not throw error', () => {
      expect(() => {
        let action = new Action<string>();
        action.map(() => {}).attach(new Attachable().attachToRoot());

        vi.runAllTimers();
      }).not.toThrow('LightweightAttachable: The object is not attached to anything!');
    });

    test('attaching to root should not throw error', () => {
      expect(() => {
        let action = new Action<string>();
        action.map(() => {}).attachToRoot();
        action.trigger('');

        vi.runAllTimers();
      }).not.toThrow('LightweightAttachable: The object is not attached to anything!');
    });

    test('not attaching the chain to a target should throw error', () => {
      expect(() => {
        let action1 = new Action<string>();
        let action2 = new Action<string>();
        action1.map(() => action2).map(() => {});

        action1.trigger('');

        vi.runAllTimers();
      }).toThrow('LightweightAttachable: The object is not attached to anything!');
    });

    test('attaching the chain to a target should not throw error', () => {
      expect(() => {
        let action1 = new Action<string>();
        let action2 = new Action<string>();
        action1
          .map(() => action2)
          .map(() => {})
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
          .map(() => action2)
          .map(() => {})
          .attachToRoot();

        action1.trigger('');

        vi.runAllTimers();
      }).not.toThrow('LightweightAttachable: The object is not attached to anything!');
    });
  });

  describe('Edge Cases', () => {
    test('resolve undefined should still trigger next map', () => {
      let triggered = false;
      new Sequence<void>(resolve => resolve())
        .map(() => {
          triggered = true;
        })
        .attachToRoot();

      expect(triggered).toBeTruthy();
    });

    test('execution should stop listening notifiers even it is in the middle on destruction', () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();

      let triggered = false;
      let sequence = action1
        .map(() => action2)
        .map(() => {
          triggered = true;
        })
        .attachToRoot();

      action1.trigger('');

      expect(triggered).toEqual(false);
      expect(action2.listenerCount).toEqual(1);

      sequence.destroy();
      expect(action2.listenerCount).toEqual(0);

      action2.trigger('');
      expect(triggered).toEqual(false);
    });

    test('execution should stop listening sequences even it is in the middle on destruction', async () => {
      let resolve1!: () => void;
      let resolve2!: () => void;

      let middleSequence!: Sequence<void>;

      let triggered = false;
      let sequence = new Sequence<void>(resolve => {
        resolve1 = resolve;
      })
        .map(() => {
          middleSequence = new Sequence<void>(resolve => {
            resolve2 = resolve;
          });
          return middleSequence;
        })
        .map(() => {
          triggered = true;
        })
        .attachToRoot();

      resolve1?.();
      expect(middleSequence['listener']).toBeDefined();

      sequence.destroy();
      expect(middleSequence['listener']).toBeUndefined();

      resolve2?.();
      expect(middleSequence['listener']).toBeUndefined();
      expect(triggered).toEqual(false);
    });

    test('multiple chain triggers should successfully unsubscribe on destruction', () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();
      let sequence = action1
        .map(() => action2)
        .map(() => {})
        .attachToRoot();

      action1.trigger('');
      action1.trigger('');

      expect(action1.listenerCount).toEqual(1);
      expect(action2.listenerCount).toEqual(2);

      sequence.destroy();
      expect(action1.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);
    });
  });
});
