import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../../../../attachable/attachable';
import { ActionLibHardReset } from '../../../../helpers/hard-reset';
import { Action } from '../../../../observables/action/action';
import { Sequence } from '../../sequence';

describe('Sequence Skip', () => {
  beforeEach(() => {
    ActionLibHardReset.hardReset();
    UnitTestHelper.reset();
  });

  describe('Behavior', () => {
    test('sync triggers', () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
        resolve('b');
      })
        .skip(2)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('x');
      resolve('y');
      expect(heap).toEqual(['x', 'y']);
    });

    test('mixed triggers', async () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        r('a');
        r('b');
        resolve = r;
      })
        .skip(3)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('x');
      resolve('y');
      UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['y', 'k', 't']);
    });

    test('skipping more than triggers', () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      let sequence = Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
        resolve('b');
      })
        .skip(5)
        .read(data => heap.push(data))
        .attachToRoot();

      resolve('x');
      resolve('y');
      expect(heap).toEqual([]);
      expect(sequence.destroyed).toBeFalsy();
    });

    test('instantly resolving the sequence should not block the chain', () => {
      let heap: string[] = [];
      Sequence.create<string>(resolve => resolve('a'))
        .skip(0)
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a']);
    });

    test('skipping less than instant triggers', () => {
      let heap: string[] = [];
      Sequence.create<string>(resolve => {
        resolve('a');
        resolve('b');
        resolve('c');
      })
        .skip(1)
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['b', 'c']);
    });

    test('skip zero should pass all values', () => {
      let heap: string[] = [];
      Sequence.create<string>(resolve => {
        resolve('a');
        resolve('b');
        resolve('c');
      })
        .skip(0)
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a', 'b', 'c']);
    });
  });

  describe('Destruction', () => {
    test('destroying sequence', () => {
      let sequence = Sequence.create(resolve => resolve())
        .skip(0)
        .attachToRoot();

      expect(sequence.destroyed).toBeFalsy();
      sequence.destroy();
      expect(sequence.destroyed).toBeTruthy();
    });

    test('destroy sequence callback', () => {
      let triggered = false;
      let sequence = Sequence.create(resolve => {
        resolve();
        resolve();
        return () => {
          triggered = true;
        };
      });

      expect(triggered).toBeFalsy();
      sequence.skip(1).attachToRoot();
      expect(triggered).toBeFalsy();
      sequence.destroy();
      expect(triggered).toBeTruthy();
    });

    test('directly resolved sequence callback', () => {
      let heap: string[] = [];
      let sequence = Sequence.create(resolve => {
        resolve();
        resolve();
        return () => heap.push('destroyed');
      })
        .read(() => heap.push('read1'))
        .skip(1)
        .read(() => heap.push('read2'))
        .attachToRoot();

      expect(heap).toEqual(['read1', 'read1', 'read2']);
      sequence.destroy();
      expect(heap).toEqual(['read1', 'read1', 'read2', 'destroyed']);
    });

    test('destroying parent should destroy sequence', () => {
      let parent = new Attachable().attachToRoot();

      let sequence = Sequence.create(resolve => resolve())
        .skip(0)
        .attach(parent);

      expect(sequence.destroyed).toBeFalsy();
      parent.destroy();
      expect(sequence.destroyed).toBeTruthy();
    });

    test('skip does not auto-destroy the sequence', () => {
      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r;
      })
        .skip(2)
        .attachToRoot();

      expect(sequence.destroyed).toBeFalsy();
      resolve();
      expect(sequence.destroyed).toBeFalsy();
      resolve();
      expect(sequence.destroyed).toBeFalsy();
      resolve();
      expect(sequence.destroyed).toBeFalsy();
    });

    test('skip with orderedMap operations', () => {
      let action1 = new Action<string>();
      let actionlast = new Action<string>();

      let heap: string[] = [];
      let sequence = Sequence.create<number>(resolve => {
        resolve(1);
        resolve(2);
        resolve(3);
      })
        .asyncMapOrdered(data =>
          Sequence.create<string>((resolve, context) => {
            if (data === 1) {
              action1.subscribe(actionValue => resolve(data + actionValue)).attach(context.attachable);
            } else if (data === 2) {
              action1.subscribe(actionValue => resolve(data + actionValue)).attach(context.attachable);
            }
          })
        )
        .skip(1)
        .asyncMapOrdered(data =>
          Sequence.create<string>((resolve, context) => {
            actionlast.subscribe(actionValue => resolve(data + actionValue)).attach(context.attachable);
          })
        )
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(sequence.destroyed).toBeFalsy();
      expect(action1.listenerCount).toEqual(2);
      expect(actionlast.listenerCount).toEqual(0);

      action1.trigger('-a1');
      expect(heap).toEqual([]);
      expect(sequence.destroyed).toBeFalsy();
      expect(action1.listenerCount).toEqual(0);
      expect(actionlast.listenerCount).toEqual(1);

      actionlast.trigger('-al');
      expect(heap).toEqual(['2-a1-al']);
      expect(sequence.destroyed).toBeFalsy();
      expect(action1.listenerCount).toEqual(0);
      expect(actionlast.listenerCount).toEqual(0);
    });
  });
});
