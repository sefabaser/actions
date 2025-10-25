import { Wait } from 'helpers-lib';
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

  describe('Setup', () => {
    test('simple sequence', () => {
      expect(new Sequence<string>(resolve => resolve('a')).attachToRoot()).toBeDefined();
    });

    test('linking twice should throw error', () => {
      let sequence = new Sequence<string>(resolve => resolve('a'));
      sequence.read(() => {}).attachToRoot();
      expect(() => sequence.read(() => {}).attachToRoot()).toThrow('A sequence can only be linked once.');
    });

    test('attach cannot be called before the end of the chain', () => {
      let sequence = new Sequence<string>(resolve => resolve('a'));
      expect(() =>
        sequence
          .read(() => {})
          .attachToRoot()
          .read(() => {})
      ).toThrow('After attaching a sequence you cannot add another operation.');
    });
  });

  describe('Read', () => {
    test('simple sequence', () => {
      new Sequence<string>(resolve => resolve('a')).read(data => expect(data).toEqual('a')).attachToRoot();
    });

    test('read should not change the data', () => {
      let heap: string[] = [];
      new Sequence<string>(resolve => resolve('a'))
        .read(data => {
          heap.push(data);
          return 2;
        })
        .read(data => {
          heap.push(data);
        })
        .attachToRoot();

      expect(heap).toEqual(['a', 'a']);
    });
  });

  describe('Map', () => {
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

  describe('Filter', () => {
    test('simple filter', () => {
      new Sequence<string>(resolve => resolve('a'))
        .filter(data => data === 'a')
        .read(data => expect(data).toEqual('a'))
        .attachToRoot();
    });

    test('filtering unwanted data', async () => {
      let heap: string[] = [];
      new Sequence<string>(resolve => delayedCalls.callEachDelayed(['a', 'b', 'c'], resolve))
        .filter(data => data === 'b')
        .read(data => heap.push(data))
        .attachToRoot();

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual(['b']);
    });
  });

  describe('Take', () => {
    test('simple take', async () => {
      let sequence = new Sequence<string>(resolve => resolve('a')).take(1).attachToRoot();
      await Wait();
      expect(sequence.destroyed).toBeTruthy();
    });

    test('delayed sequence take', async () => {
      let heap: string[] = [];
      new Sequence<string>(resolve => delayedCalls.callEachDelayed(['a', 'b', 'c'], resolve))
        .take(1)
        .read(data => heap.push(data))
        .attachToRoot();

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual(['a']);
    });

    test('taking more data than available', async () => {
      let heap: string[] = [];
      new Sequence<string>(resolve => delayedCalls.callEachDelayed(['a', 'b', 'c'], resolve))
        .take(4)
        .read(data => heap.push(data))
        .attachToRoot();

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('finishing take should destroy the sequence', async () => {
      let heap: string[] = [];
      let s1 = new Sequence<string>(resolve => delayedCalls.callEachDelayed(['a', 'b'], resolve));
      let s2 = s1
        .take(1)
        .read(data => heap.push(data))
        .attachToRoot();

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual(['a']);
      expect(s1.destroyed).toBeTruthy();
      expect(s2.destroyed).toBeTruthy();
    });

    test('instantly finishing the sequence should not block the chain', () => {
      let heap: string[] = [];
      new Sequence<string>(resolve => resolve('a'))
        .take(1)
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a']);
    });
  });

  describe('To Notifier', () => {
    test('setup', () => {
      let notifier = new Sequence<string>(() => {}).attachToRoot().toNotifier();
      expect(notifier.listenerCount).toEqual(0);
    });

    test('converting notifier before attaching should not throw error', () => {
      vi.useFakeTimers();
      expect(() => {
        new Sequence<string>(() => {}).toNotifier();

        vi.runAllTimers();
      }).toThrow('Before converting a sequence to notifier, it must be attached to something!');
      vi.useRealTimers();
    });

    test('converted notifier can be subscribed by many', () => {
      let notifier = new Sequence<string>(resolve => resolve('a')).attachToRoot().toNotifier();
      notifier.subscribe(data => expect(data).toEqual('a')).attachToRoot();
      notifier.subscribe(data => expect(data).toEqual('a')).attachToRoot();
      expect(notifier.listenerCount).toEqual(2);
    });
  });

  describe('Merge', () => {
    test('simple merge', async () => {
      let heap: string[] = [];

      Sequence.merge(
        new Sequence<string>(resolve => resolve('a')),
        new Sequence<string>(resolve => resolve('b')),
        new Sequence<string>(resolve => resolve('c'))
      )
        .read(data => heap.push(data))
        .attachToRoot();

      await delayedCalls.waitForAllPromises();

      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('merging instantly getting destroyed sequences', async () => {
      let heap: string[] = [];

      let s1 = new Sequence<string>(resolve => resolve('a')).take(1);
      let s2 = new Sequence<string>(resolve => resolve('b')).take(1);

      let merged = Sequence.merge(s1, s2);
      let read = merged.read(data => heap.push(data)).attachToRoot();

      await delayedCalls.waitForAllPromises();

      expect(heap).toEqual(['a', 'b']);
      expect(s1.destroyed).toBeTruthy();
      expect(s2.destroyed).toBeTruthy();
      expect(merged.destroyed).toBeTruthy();
      expect(read.destroyed).toBeTruthy();
    });

    test('merge with delayed sequences', async () => {
      let heap: string[] = [];
      Sequence.merge(
        new Sequence<string>(resolve => delayedCalls.callEachDelayed(['1', '2'], resolve)),
        new Sequence<string>(resolve => delayedCalls.callEachDelayed(['a', 'b'], resolve)),
        new Sequence<string>(resolve => delayedCalls.callEachDelayed(['x', 'y'], resolve))
      )
        .read(data => heap.push(data))
        .attachToRoot();

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual(['1', 'a', 'x', '2', 'b', 'y']);
    });

    test('destroyed merged sequence should destroy children sequences', async () => {
      let sequence1 = new Sequence(() => {});
      let sequence2 = new Sequence(() => {});
      let merged = Sequence.merge(sequence1, sequence2).attachToRoot();

      expect(sequence1.destroyed).toBeFalsy();
      expect(sequence2.destroyed).toBeFalsy();
      merged.destroy();
      expect(sequence1.destroyed).toBeTruthy();
      expect(sequence2.destroyed).toBeTruthy();
    });

    test('destroyed children sequences should destroy merged sequence', async () => {
      let sequence1 = new Sequence(() => {});
      let sequence2 = new Sequence(() => {});
      let merged = Sequence.merge(sequence1, sequence2).attachToRoot();

      expect(merged.destroyed).toBeFalsy();
      sequence1.destroy();
      expect(merged.destroyed).toBeFalsy();
      sequence2.destroy();
      expect(merged.destroyed).toBeTruthy();
    });

    test('merged sequances should not need to be attached manually', () => {
      vi.useFakeTimers();
      expect(() => {
        let sequence1 = new Sequence(() => {});
        let sequence2 = new Sequence(() => {});
        Sequence.merge(sequence1, sequence2).attachToRoot();

        vi.runAllTimers();
      }).not.toThrow('LightweightAttachable: The object is not attached to anything!');
      vi.useRealTimers();
    });

    test('merging same sequence should throw error', () => {
      let sequence = new Sequence(() => {});
      expect(() => Sequence.merge(sequence, sequence).attachToRoot()).toThrow(
        'Each given sequence to merge or combine has to be diferent.'
      );
    });
  });

  describe('Combine', () => {
    test('simple combine', () => {
      let sequence1 = new Sequence<string>(resolve => resolve('a'));
      let sequence2 = new Sequence<number>(resolve => resolve(1));

      let heap: { a: string; b: number }[] = [];
      Sequence.combine({ a: sequence1, b: sequence2 })
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([{ a: 'a', b: 1 }]);
    });

    test('combine instantly getting destroyed sequences', async () => {
      let heap: { a: string; b: number }[] = [];

      let s1 = new Sequence<string>(resolve => resolve('a')).take(1);
      let s2 = new Sequence<number>(resolve => resolve(1)).take(1);

      let combined = Sequence.combine({ a: s1, b: s2 });
      let read = combined.read(data => heap.push(data)).attachToRoot();

      await delayedCalls.waitForAllPromises();

      expect(heap).toEqual([{ a: 'a', b: 1 }]);
      expect(s1.destroyed).toBeTruthy();
      expect(s2.destroyed).toBeTruthy();
      expect(combined.destroyed).toBeTruthy();
      expect(read.destroyed).toBeTruthy();
    });

    test('combine with delayed sequences', async () => {
      let heap: { a: string; b: number }[] = [];
      Sequence.combine({
        a: new Sequence<string>(resolve => delayedCalls.callEachDelayed(['a', 'b'], resolve)),
        b: new Sequence<number>(resolve => delayedCalls.callEachDelayed([1, 2], resolve))
      })
        .read(data => heap.push(data))
        .attachToRoot();

      await delayedCalls.waitForAllPromises();
      expect(heap).toEqual([
        { a: 'a', b: 1 },
        { a: 'b', b: 1 },
        { a: 'b', b: 2 }
      ]);
    });

    test('destroyed combined sequence should destroy children sequences', async () => {
      let sequence1 = new Sequence<string>(() => {});
      let sequence2 = new Sequence<string>(() => {});
      let combined = Sequence.combine({ a: sequence1, b: sequence2 }).attachToRoot();

      expect(sequence1.destroyed).toBeFalsy();
      expect(sequence2.destroyed).toBeFalsy();
      combined.destroy();
      expect(sequence1.destroyed).toBeTruthy();
      expect(sequence2.destroyed).toBeTruthy();
    });

    test('destroyed children sequences should destroy combined sequence', async () => {
      let sequence1 = new Sequence<string>(() => {});
      let sequence2 = new Sequence<string>(() => {});
      let combined = Sequence.combine({ a: sequence1, b: sequence2 }).attachToRoot();

      expect(combined.destroyed).toBeFalsy();
      sequence1.destroy();
      expect(combined.destroyed).toBeFalsy();
      sequence2.destroy();
      expect(combined.destroyed).toBeTruthy();
    });

    test('combined sequances should not need to be attached manually', () => {
      vi.useFakeTimers();
      expect(() => {
        let sequence1 = new Sequence<string>(() => {});
        let sequence2 = new Sequence<string>(() => {});
        Sequence.combine({ a: sequence1, b: sequence2 }).attachToRoot();

        vi.runAllTimers();
      }).not.toThrow('LightweightAttachable: The object is not attached to anything!');
      vi.useRealTimers();
    });

    test('combining same sequence should throw error', () => {
      let sequence = new Sequence(() => {});
      expect(() => Sequence.combine({ a: sequence, b: sequence }).attachToRoot()).toThrow(
        'Each given sequence to merge or combine has to be diferent.'
      );
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
      expect(middleSequence['_listener']).toBeDefined();

      sequence.destroy();
      expect(middleSequence['_listener']).toBeUndefined();

      resolve2?.();
      expect(middleSequence['_listener']).toBeUndefined();
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
