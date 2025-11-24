import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../../../../attachable/attachable';
import { Variable } from '../../../../observables/variable/variable';
import { ActionLib } from '../../../../utilities/action-lib';
import { Sequence } from '../../sequence';

describe('Sequence MapToVoid', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Triggers', () => {
    test('simple sequence sync triggers', () => {
      let heap: unknown[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
      })
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      resolve('b');
      expect(heap).toEqual([undefined, undefined]);
    });

    test('multiple instant resolution', () => {
      let heap: unknown[] = [];
      Sequence.create<string>(resolve => {
        resolve('a');
        resolve('b');
        resolve('c');
      })
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([undefined, undefined, undefined]);
    });

    test('simple sequence mixed triggers', async () => {
      let heap: unknown[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
        resolve('b');
      })
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      resolve('x');
      resolve('y');
      UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
    });
  });

  describe('Behavior', () => {
    test('transforms string data to void', () => {
      let heap: unknown[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
      })
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      resolve('test');
      resolve('another');

      expect(heap).toEqual([undefined, undefined]);
    });

    test('transforms number data to void', () => {
      let heap: unknown[] = [];

      let resolve!: (data: number) => void;
      Sequence.create<number>(r => {
        resolve = r;
      })
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      resolve(42);
      resolve(100);

      expect(heap).toEqual([undefined, undefined]);
    });

    test('transforms object data to void', () => {
      let heap: unknown[] = [];

      let resolve!: (data: { value: string }) => void;
      Sequence.create<{ value: string }>(r => {
        resolve = r;
      })
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      resolve({ value: 'a' });
      resolve({ value: 'b' });

      expect(heap).toEqual([undefined, undefined]);
    });

    test('data chaining after mapToVoid', () => {
      let heap: unknown[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
      })
        .mapToVoid()
        .map(data => {
          heap.push(data);
          return 'mapped';
        })
        .tap(data => heap.push(data))
        .attachToRoot();

      resolve('original');

      expect(heap).toEqual([undefined, 'mapped']);
    });

    test('multiple mapToVoid calls', () => {
      let heap: unknown[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
      })
        .mapToVoid()
        .mapToVoid()
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      resolve('test');

      expect(heap).toEqual([undefined]);
    });
  });

  describe('Destruction', () => {
    test('destroying sequence', () => {
      let sequence = Sequence.create(resolve => resolve())
        .mapToVoid()
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
        .mapToVoid()
        .map(() => {})
        .attachToRoot();

      expect(triggered).toBeFalsy();
      sequence.destroy();
      expect(triggered).toBeTruthy();
    });

    test('destroying parent should destroy sequence', () => {
      let parent = new Attachable().attachToRoot();

      let sequence = Sequence.create(resolve => resolve())
        .mapToVoid()
        .map(() => {})
        .attach(parent);

      expect(sequence.destroyed).toBeFalsy();
      parent.destroy();
      expect(sequence.destroyed).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    test('mapToVoid with undefined input', () => {
      let heap: unknown[] = [];

      let resolve!: (data: undefined) => void;
      Sequence.create<undefined>(r => {
        resolve = r;
      })
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      resolve(undefined);

      expect(heap).toEqual([undefined]);
    });

    test('mapToVoid with void input', () => {
      let heap: unknown[] = [];

      let resolve!: () => void;
      Sequence.create<void>(r => {
        resolve = r;
      })
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      resolve();

      expect(heap).toEqual([undefined]);
    });

    test('destroying subscriptions via attachment', () => {
      let variable = new Variable<number>(1);
      let triggered = false;

      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r;
      })
        .mapToVoid()
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

    test('mapToVoid preserves sequence behavior with finalization', () => {
      let heap: unknown[] = [];

      Sequence.create<string>((resolve, context) => {
        resolve('first');
        resolve('second');
        context.final();
      })
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([undefined, undefined]);
    });

    test('async triggers after mapToVoid', async () => {
      let heap: unknown[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
      })
        .mapToVoid()
        .tap(data => heap.push(data))
        .attachToRoot();

      UnitTestHelper.callEachDelayed(['a', 'b', 'c'], data => resolve(data));

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual([undefined, undefined, undefined]);
    });
  });
});
