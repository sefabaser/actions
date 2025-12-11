import { takeNodeMinimalHeap } from '@memlab/core';
import { UnitTestHelper, Wait } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Action } from '../../../observables/action/action';
import { ActionLib } from '../../../utilities/action-lib';
import { SingleEvent } from '../single-event';

const SingleEventClassNames = [SingleEvent.name, 'SingleEventExecutor', 'SingleEventContext'];

describe.skipIf(process.env.QUICK)('Memory Leak', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  async function checkMemoryLeaks(destroyReferences: () => void = () => {}) {
    await UnitTestHelper.waitForAllOperations();

    destroyReferences();
    let snapshot = await takeNodeMinimalHeap();
    SingleEventClassNames.forEach(name => {
      if (snapshot.hasObjectWithClassName(name)) {
        throw new Error(`"${name}" has at least one instance in the memory.`);
      }
    });
  }

  describe('_ongoingContext cleared in destroy()', () => {
    test('destroying executor while waiting for async callback should not leak _ongoingContext', async () => {
      let action = new Action<void>();

      let singleEvent = SingleEvent.create<void>(resolve => {
        UnitTestHelper.callDelayed(() => resolve());
      })
        .asyncMap(() => action)
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();
      expect(singleEvent.destroyed).toBeFalsy();

      singleEvent.destroy();
      expect(singleEvent.destroyed).toBeTruthy();

      await expect(
        checkMemoryLeaks(() => {
          singleEvent = undefined as any;
          action = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);

    test('destroy during pipeline iteration should clear _ongoingContext', async () => {
      let resolveCallback!: () => void;

      let singleEvent = SingleEvent.create<void>(resolve => resolve())
        .asyncMap(() =>
          SingleEvent.create<void>(r => {
            resolveCallback = r;
          })
        )
        .attachToRoot();

      await Wait();
      expect(singleEvent.destroyed).toBeFalsy();
      expect(resolveCallback).toBeDefined();

      singleEvent.destroy();
      expect(singleEvent.destroyed).toBeTruthy();

      await expect(
        checkMemoryLeaks(() => {
          singleEvent = undefined as any;
          resolveCallback = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);
  });

  describe('Arrow function _resolve capturing this', () => {
    test('external code holding _resolve callback after destroy should not leak executor', async () => {
      let capturedResolve: ((data: void) => void) | undefined;

      let singleEvent = SingleEvent.create<void>(resolve => resolve())
        .map((_, context) => {
          SingleEvent.create<void>(r => {
            capturedResolve = r;
          }).attach(context.attachable);
        })
        .attachToRoot();

      await Wait();
      expect(capturedResolve).toBeDefined();

      singleEvent.destroy();
      expect(singleEvent.destroyed).toBeTruthy();

      await expect(
        checkMemoryLeaks(() => {
          singleEvent = undefined as any;
          capturedResolve = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);

    test('callback stored in never-resolving async operation should not leak', async () => {
      let neverResolvingAction = new Action<void>();

      let singleEvent = SingleEvent.create<void>(resolve => resolve())
        .asyncMap(() => neverResolvingAction)
        .attachToRoot();

      await Wait();
      expect(singleEvent.destroyed).toBeFalsy();

      singleEvent.destroy();
      expect(singleEvent.destroyed).toBeTruthy();

      await expect(
        checkMemoryLeaks(() => {
          singleEvent = undefined as any;
          neverResolvingAction = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);
  });

  describe('Circular references', () => {
    test('SingleEventContext._executor reference should be cleared on destroy', async () => {
      let contextRef: unknown;

      let singleEvent = SingleEvent.create<void>(resolve => resolve())
        .tap((_, context) => {
          contextRef = context;
        })
        .attachToRoot();

      expect(contextRef).toBeDefined();
      expect(singleEvent.destroyed).toBeTruthy();

      await expect(
        checkMemoryLeaks(() => {
          singleEvent = undefined as any;
          contextRef = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);

    test('circular reference between executor and context should be broken on destroy', async () => {
      let capturedContext: unknown;

      let singleEvent = SingleEvent.create<void>(resolve => resolve())
        .asyncMap((_, context) => {
          capturedContext = context;
          return SingleEvent.create<void>(r => {
            UnitTestHelper.callDelayed(() => r());
          });
        })
        .attachToRoot();

      await Wait();
      expect(capturedContext).toBeDefined();

      singleEvent.destroy();
      expect(singleEvent.destroyed).toBeTruthy();

      await expect(
        checkMemoryLeaks(() => {
          singleEvent = undefined as any;
          capturedContext = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);
  });

  describe('Combined scenarios', () => {
    test('chained single events with async operations destroyed mid-chain', async () => {
      let action1 = new Action<void>();
      let action2 = new Action<void>();

      let singleEvent = SingleEvent.create<void>(resolve => resolve())
        .asyncMap(() => action1)
        .asyncMap(() => action2)
        .attachToRoot();

      await Wait();
      expect(singleEvent.destroyed).toBeFalsy();

      singleEvent.destroy();
      expect(singleEvent.destroyed).toBeTruthy();

      await expect(
        checkMemoryLeaks(() => {
          singleEvent = undefined as any;
          action1 = undefined as any;
          action2 = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);

    test('nested single events with captured contexts destroyed', async () => {
      let innerResolve!: () => void;
      let outerContext: unknown;
      let innerContext: unknown;

      let singleEvent = SingleEvent.create<void>(resolve => resolve())
        .asyncMap((_data, outerCtx) => {
          outerContext = outerCtx;
          return SingleEvent.create<void>(r1 => r1()).asyncMap((_innerData, innerCtx) => {
            innerContext = innerCtx;
            return SingleEvent.create<void>(innerR => {
              innerResolve = innerR;
            });
          });
        })
        .attachToRoot();

      await Wait();
      expect(innerResolve).toBeDefined();
      expect(outerContext).toBeDefined();
      expect(innerContext).toBeDefined();

      singleEvent.destroy();

      await expect(
        checkMemoryLeaks(() => {
          singleEvent = undefined as any;
          innerResolve = undefined as any;
          outerContext = undefined as any;
          innerContext = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);

    test('single event waiting for action that is never triggered', async () => {
      let neverTriggeredAction = new Action<string>();

      let singleEvent = neverTriggeredAction
        .toSingleEvent()
        .tap(() => {})
        .attachToRoot();

      await Wait();
      expect(singleEvent.destroyed).toBeFalsy();

      singleEvent.destroy();
      expect(singleEvent.destroyed).toBeTruthy();

      await expect(
        checkMemoryLeaks(() => {
          singleEvent = undefined as any;
          neverTriggeredAction = undefined as any;
        })
      ).resolves.not.toThrow();
    }, 30000);
  });
});
