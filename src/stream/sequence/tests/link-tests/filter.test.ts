import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../../../../attachable/attachable';
import { ActionLib } from '../../../../utilities/action-lib';
import { Sequence } from '../../sequence';

describe('Sequence Filter', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Triggers', () => {
    test('sync triggers', () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
        resolve('b');
      })
        .filter(data => {
          heap.push(data);
          return true;
        })
        .attachToRoot();

      resolve('x');
      resolve('y');
      expect(heap).toEqual(['a', 'b', 'x', 'y']);
    });

    test('mixed triggers', async () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        r('a');
        r('b');
        resolve = r;
      })
        .filter(data => {
          heap.push(data);
          return true;
        })
        .attachToRoot();

      resolve('x');
      resolve('y');
      UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a', 'b', 'x', 'y', 'k', 't']);
    });
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
        .filter(data => data !== 'b' && data !== 'y')
        .tap(data => heap.push(data))
        .attachToRoot();

      resolve('x');
      resolve('y');
      expect(heap).toEqual(['a', 'x']);
    });

    test('mixed triggers', async () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
        resolve('b');
      })
        .filter(data => data !== 'b' && data !== 'y' && data !== 't')
        .tap(data => heap.push(data))
        .attachToRoot();

      resolve('x');
      resolve('y');
      UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a', 'x', 'k']);
    });

    test('previous value calls', async () => {
      let heap: unknown[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
        resolve('b');
      })
        .filter((data, previousData) => {
          heap.push(previousData);
          return true;
        })
        .attachToRoot();

      resolve('x');
      resolve('y');
      UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual([undefined, 'a', 'b', 'x', 'y', 'k']);
    });

    test('filter on change', async () => {
      let heap: unknown[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
        resolve('a');
      })
        .filter((data, previousData) => data !== previousData)
        .tap(data => heap.push(data))
        .attachToRoot();

      resolve('x');
      resolve('x');
      UnitTestHelper.callEachDelayed(['k', 'k'], data => resolve(data));

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual(['a', 'x', 'k']);
    });
  });

  describe('Destruction', () => {
    test('destroying sequence', () => {
      let sequence = Sequence.create(resolve => resolve())
        .filter(() => true)
        .filter(() => true)
        .filter(() => true)
        .attachToRoot();

      expect(sequence.destroyed).toBeFalsy();
      sequence.destroy();
      expect(sequence.destroyed).toBeTruthy();
    });

    test('destroying parent should destroy sequence', () => {
      let parent = new Attachable().attachToRoot();

      let sequence = Sequence.create(resolve => resolve())
        .filter(() => true)
        .filter(() => true)
        .filter(() => true)
        .attach(parent);

      expect(sequence.destroyed).toBeFalsy();
      parent.destroy();
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
        .filter(() => true)
        .filter(() => true)
        .filter(() => true)
        .attachToRoot();

      expect(triggered).toBeFalsy();
      sequence.destroy();
      expect(triggered).toBeTruthy();
    });
  });
});
