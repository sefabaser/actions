import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { ActionLibUnitTestHelper } from '../helpers/unit-test.helper';
import { Action } from '../observables/action/action';
import { Variable } from '../observables/variable/variable';
import { DelayedSequentialCallsHelper } from './delayed-sequential-calls.helper';
import { Sequence2 as Sequence } from './sequence2';

describe('Sequence', () => {
  let delayedCalls = new DelayedSequentialCallsHelper();

  beforeEach(() => {
    ActionLibUnitTestHelper.hardReset();
  });

  describe('Setup', () => {
    test('simple sequence', () => {
      expect(new Sequence<string>(resolve => resolve('a')).attachToRoot()).toBeDefined();
    });

    test('linking twice should throw error with attach', () => {
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

    test('read chain', () => {
      let firstTrigger = 0;
      let secondTrigger = 0;
      let thirdTrigger = 0;

      new Sequence<void>(resolve => resolve())
        .read(() => {
          firstTrigger++;
        })
        .read(() => {
          secondTrigger++;
        })
        .read(() => {
          thirdTrigger++;
        })
        .attachToRoot();

      expect(firstTrigger).toEqual(1);
      expect(secondTrigger).toEqual(1);
      expect(thirdTrigger).toEqual(1);
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

  describe('Attachment', () => {
    beforeEach(() => {
      vi.useFakeTimers();
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
    test('resolve undefined should still trigger next link', () => {
      let triggered = false;
      new Sequence<void>(resolve => resolve())
        .read(() => {
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
