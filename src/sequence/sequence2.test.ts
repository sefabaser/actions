import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { ActionLibUnitTestHelper } from '../helpers/unit-test.helper';
import { Action } from '../observables/action/action';
import { Sequence2 as Sequence } from './sequence2';

describe('Sequence', () => {
  beforeEach(() => {
    ActionLibUnitTestHelper.hardReset();
  });

  describe('Setup', () => {
    test('simple sequence', () => {
      expect(Sequence.create<string>(resolve => resolve('a')).attachToRoot()).toBeDefined();
    });

    test('attach cannot be called before the end of the chain', () => {
      let sequence = Sequence.create<string>(resolve => resolve('a'));
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
      Sequence.create<string>(resolve => resolve('a'))
        .read(data => expect(data).toEqual('a'))
        .attachToRoot();
    });

    test('read should not change the data', () => {
      let heap: string[] = [];
      Sequence.create<string>(resolve => resolve('a'))
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

      Sequence.create<void>(resolve => resolve())
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

  describe('Attachment', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    test('not attaching to anything should throw error', () => {
      expect(() => {
        Sequence.create<void>(resolve => resolve());
        vi.runAllTimers();
      }).toThrow('LightweightAttachable: The object is not attached to anything!');
    });

    test('attaching to a target should not throw error', () => {
      expect(() => {
        Sequence.create<void>(resolve => resolve())
          .read(() => {})
          .attach(new Attachable().attachToRoot());

        vi.runAllTimers();
      }).not.toThrow('LightweightAttachable: The object is not attached to anything!');
    });

    test('attaching to root should not throw error', () => {
      expect(() => {
        Sequence.create<void>(resolve => resolve())
          .read(() => {})
          .attachToRoot();

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
      Sequence.create<void>(resolve => resolve())
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
