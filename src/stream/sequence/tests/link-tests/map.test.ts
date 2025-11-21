import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../../../../attachable/attachable';
import { Variable } from '../../../../observables/variable/variable';
import { ActionLib } from '../../../../utilities/action-lib';
import { Sequence } from '../../sequence';

describe('Sequence Map', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Triggers', () => {
    test('simple sequence sync triggers', () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
      })
        .map(data => heap.push(data))
        .attachToRoot();

      resolve('b');
      expect(heap).toEqual(['a', 'b']);
    });

    test('multiple instant resolution', () => {
      let heap: string[] = [];
      Sequence.create<string>(resolve => {
        resolve('a');
        resolve('b');
        resolve('c');
      })
        .map(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a', 'b', 'c']);
    });

    test('simple sequence mixed triggers', async () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
        resolve('b');
      })
        .map(data => heap.push(data))
        .attachToRoot();

      resolve('x');
      resolve('y');
      UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a', 'b', 'x', 'y', 'k', 't']);
    });
  });

  describe('Behavior', () => {
    test('sync data chaining', () => {
      let heap: unknown[] = [];

      Sequence.create<string>(resolve => resolve('a'))
        .map(data => {
          heap.push(data);
          return 1;
        })
        .map(data => {
          heap.push(data);
        })
        .map(data => {
          heap.push(data);
        })
        .attachToRoot();

      expect(heap).toEqual(['a', 1, undefined]);
    });
  });

  describe('Destruction', () => {
    test('destroying sequence', () => {
      let sequence = Sequence.create(resolve => resolve())
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .attachToRoot();

      expect(sequence.destroyed).toBeFalsy();
      sequence.destroy();
      expect(sequence.destroyed).toBeTruthy();
    });

    test('destroy sequence callback', () => {
      let triggered = false;
      let sequence = Sequence.create(resolve => {
        resolve();
        return () => {
          triggered = true;
        };
      })
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .attachToRoot();

      expect(triggered).toBeFalsy();
      sequence.destroy();
      expect(triggered).toBeTruthy();
    });

    test('destroying parent should destroy sequence', () => {
      let parent = new Attachable().attachToRoot();

      let sequence = Sequence.create(resolve => resolve())
        .map(() => {})
        .map(() => {})
        .map(() => {})
        .attach(parent);

      expect(sequence.destroyed).toBeFalsy();
      parent.destroy();
      expect(sequence.destroyed).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    test('object with subscribe property should not fool the map', () => {
      let heap: unknown[] = [];
      let fakeStream = { subscribe: 'hello' };

      Sequence.create(resolve => resolve())
        .map(() => fakeStream)
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([fakeStream]);
    });

    test('object with subscribe function should not fool the map', () => {
      let heap: unknown[] = [];
      let fakeStream = { subscribe: () => {} };

      Sequence.create(resolve => resolve())
        .map(() => fakeStream)
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([fakeStream]);
    });

    test('destroying subscriptions via attachment, instantly finalizing sequence', () => {
      let variable = new Variable<number>(1);
      let triggered = false;

      let sequence = Sequence.create((resolve, context) => {
        resolve();
        context.final();
      })
        .map((_, context) => {
          variable
            .subscribe(() => {
              triggered = true;
            })
            .attach(context.attachable);
        })
        .attachToRoot();

      expect(sequence.destroyed).toBeTruthy();
      expect(variable.listenerCount).toEqual(0);
      expect(triggered).toBeTruthy();
    });

    test('attachments on the context attachable should be destroyed right after the package iteration step', () => {
      let variable = new Variable<number>(1);
      let triggered = false;

      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r;
      })
        .map((_, context) => {
          variable
            .subscribe(() => {
              triggered = true;
            })
            .attach(context.attachable);
        })
        .attachToRoot();

      expect(sequence.destroyed).toBeFalsy();
      expect(variable.listenerCount).toEqual(0);
      expect(triggered).toBeFalsy();

      resolve();

      expect(sequence.destroyed).toBeFalsy();
      expect(variable.listenerCount).toEqual(0);
      expect(triggered).toBeTruthy();

      sequence.destroy();

      expect(sequence.destroyed).toBeTruthy();
      expect(variable.listenerCount).toEqual(0);
    });
  });
});
