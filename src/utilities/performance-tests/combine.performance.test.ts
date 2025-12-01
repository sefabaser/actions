import { ArrayHelper, UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, test } from 'vitest';

import type { ActionLib as ActionLibType, Sequence as SequenceType } from '../../index';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  let Sequence: typeof SequenceType;
  let ActionLib: typeof ActionLibType;

  beforeEach(async () => {
    let imports = await import('../../../dist/index');
    Sequence = imports.Sequence as any;
    ActionLib = imports.ActionLib as any;
  });

  test('build test', async () => {
    let sequence = Sequence.instant()
      .tap(() => console.info('okay'))
      .attachToRoot();
    sequence.destroy();
  });

  test('combine new object', async () => {
    await UnitTestHelper.testPerformance(() => {
      let combination = ActionLib.combine(
        ArrayHelper.createIntegerArray(10).reduce((acc, i) => {
          acc[i] = Sequence.create<string>(resolve => resolve('a'));
          return acc;
        }, {} as any)
      )
        .tap(() => {})
        .attachToRoot();
      combination.destroy();
      // Min:  13.876399993896484
      // default attachable: 11.232700109481812
      // queueMicrotask: 10.21969985961914
      // read single changes: 10.207499980926514
      // context functions: 9.99370002746582
      // pending change: 8.077600002288818
    });
  }, 60000);

  test('combine single new object', async () => {
    await UnitTestHelper.testPerformance(() => {
      let combination = ActionLib.all(
        ArrayHelper.createIntegerArray(10).reduce((acc, i) => {
          acc[i] = Sequence.create<string>(resolve => resolve('a'));
          return acc;
        }, {} as any)
      )
        .tap(() => {})
        .attachToRoot();
      combination.destroy();
      // Min:  13.876399993896484
      // default attachable: 11.232700109481812
      // queueMicrotask: 10.21969985961914
      // read single changes: 10.207499980926514
      // context functions: 9.99370002746582
      // pending change: 8.077600002288818
    });
  }, 60000);

  test('combine new array', async () => {
    await UnitTestHelper.testPerformance(() => {
      let combination = ActionLib.combine(
        ArrayHelper.createEmptyArray(10).map(() => Sequence.create<string>(resolve => resolve('a')))
      )
        .tap(() => {})
        .attachToRoot();
      combination.destroy();
      // Min:  12.509200096130371
      // default attachable: 11.661400079727173
      // queueMicrotask: 9.956599950790405
      // 9.698499917984009
      // read single changes: 9.804400205612183
      // context functions: 9.666399955749512
      // pending change: 8.014800071716309
    });
  }, 60000);
});
