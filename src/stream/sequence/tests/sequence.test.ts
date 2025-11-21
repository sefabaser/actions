import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../../../attachable/attachable';
import { IDAttachable } from '../../../attachable/id-attachable';
import { Action } from '../../../observables/action/action';
import { ActionLib } from '../../../utilities/action-lib';
import { Sequence } from '../sequence';
import { ISequenceCreatorContext } from '../sequence-executor';

describe('Sequence', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Create', () => {
    test('plain sequence no trigger', () => {
      expect(Sequence.create<string>(() => {}).attachToRoot()).toBeDefined();
    });

    test('plain sequence sync triggers', () => {
      expect(Sequence.create<string>(resolve => resolve('a')).attachToRoot()).toBeDefined();
      expect(
        Sequence.create<string>(resolve => {
          resolve('a');
          resolve('b');
        }).attachToRoot()
      ).toBeDefined();
    });

    test('plain sequence async triggers', () => {
      expect(
        Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed(['1, 2'], value => resolve(value))).attachToRoot()
      ).toBeDefined();
    });

    test('plain sequence sync/async triggers', async () => {
      expect(
        Sequence.create<string>(resolve => {
          resolve('a');
          resolve('b');
          UnitTestHelper.callEachDelayed(['1, 2'], value => resolve(value));
        }).attachToRoot()
      ).toBeDefined();
      await UnitTestHelper.waitForAllOperations();
    });

    test('attach cannot be called before the end of the chain', async () => {
      let sequence = Sequence.create<string>(resolve => resolve('a'));
      expect(() =>
        sequence
          .tap(() => {})
          .attachToRoot()
          .tap(() => {})
      ).toThrow('Sequence: After attaching, you cannot add another operation.');
      await UnitTestHelper.waitForAllOperations();
    });
  });

  describe('Instant', () => {
    test('setup', () => {
      expect(Sequence.instant<string>().attachToRoot()).toBeDefined();
      expect(Sequence.instant<string>('a').attachToRoot()).toBeDefined();
      expect(Sequence.instant<string>('a', 'b').attachToRoot()).toBeDefined();
    });

    test('without data', () => {
      let heap: unknown[] = [];

      let sequence = Sequence.instant()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([undefined]);
      expect(sequence['_executor']._ongoingPackageCount).toEqual(0);
    });

    test('with data', () => {
      let heap: string[] = [];

      let sequence = Sequence.instant<string>('a', 'b', 'c')
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a', 'b', 'c']);
      expect(sequence['_executor']._ongoingPackageCount).toEqual(0);
    });
  });

  describe('Finalization', () => {
    test('when sequence is finalized it should destroy itself and its pipeline', async () => {
      let heap: unknown[] = [];

      let sequence = Sequence.create<number>((resolve, context) => {
        resolve(1);
        context.final();
      })
        .tap(value => heap.push(value))
        .attachToRoot();

      expect(heap).toEqual([1]);
      expect(sequence.destroyed).toBeTruthy();
      expect(sequence['_executor']['_pipeline']).toEqual(undefined);
    });

    test('after finalized no new resolution should take effect', () => {
      let heap: string[] = [];
      Sequence.create<string>((resolve, context) => {
        resolve('1');
        context.final();
        resolve('2');
      })
        .tap(value => heap.push(value))
        .attachToRoot();

      expect(heap).toEqual(['1']);
    });

    test('finalization should wait the calling package and the ones before it to complete', () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();

      let heap: string[] = [];
      let sequence = Sequence.create<number>(resolve => {
        resolve(1);
        resolve(2);
      })
        .asyncMapOrdered((data, mainExecutor) =>
          Sequence.create<string>((resolve, context) => {
            if (data === 1) {
              resolve(data + 'map1');
            } else {
              mainExecutor.final();
              action1.subscribe(actionValue => resolve(data + actionValue)).attach(context.attachable);
            }
          })
        )
        .asyncMapOrdered(data =>
          Sequence.create<string>((resolve, context) => {
            action2.subscribe(actionValue => resolve(data + actionValue)).attach(context.attachable);
          })
        )
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(sequence.destroyed).toBeFalsy();
      expect(action1.listenerCount).toEqual(1); // second package
      expect(action2.listenerCount).toEqual(1); // first package

      action2.trigger('map2');
      expect(heap).toEqual(['1map1map2']);
      expect(sequence.destroyed).toBeFalsy();
      expect(action1.listenerCount).toEqual(1);
      expect(action2.listenerCount).toEqual(0);

      action1.trigger('map1');
      expect(heap).toEqual(['1map1map2']);
      expect(sequence.destroyed).toBeFalsy();
      expect(action1.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(1);

      action2.trigger('map2');
      expect(heap).toEqual(['1map1map2', '2map1map2']);
      expect(sequence.destroyed).toBeTruthy();
      expect(action1.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);
    });

    test('finalization should cancel the packages that comes behind the calling package', () => {
      let action1 = new Action<void>();
      let action2 = new Action<void>();

      let heap: unknown[] = [];
      let sequence = Sequence.create<number>(resolve => {
        resolve(1);
        resolve(2);
      })
        .asyncMapOrdered(data =>
          Sequence.create<number>((resolve, context) => {
            action1.subscribe(() => resolve(data)).attach(context.attachable);
          })
        )
        .asyncMapOrdered((data, mainExecutor) =>
          Sequence.create<number>((resolve, context) => {
            if (data === 1) {
              mainExecutor.final();
            }
            action2.subscribe(() => resolve(data)).attach(context.attachable);
          })
        )
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(action1.listenerCount).toEqual(2);
      expect(action2.listenerCount).toEqual(0);
      expect(sequence.destroyed).toBeFalsy();

      action1.trigger();
      expect(heap).toEqual([]);
      expect(action1.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(1);
      expect(sequence.destroyed).toBeFalsy();

      action2.trigger();
      expect(heap).toEqual([1]);
      expect(action1.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);
      expect(sequence.destroyed).toBeTruthy();
    });

    test('finalization should cancel the subscriptions that comes behind the calling package', () => {
      let action1 = new Action<void>();
      let action2 = new Action<void>();
      let actionlast = new Action<void>();

      let heap: unknown[] = [];
      let sequence = Sequence.create<number>(resolve => {
        resolve(1);
        resolve(2);
      })
        .asyncMapOrdered(data =>
          Sequence.create<number>((resolve, context) => {
            if (data === 1) {
              action1.subscribe(() => resolve(data)).attach(context.attachable);
            } else {
              action2.subscribe(() => resolve(data)).attach(context.attachable);
            }
          })
        )
        .asyncMapOrdered((data, mainExecutor) =>
          Sequence.create<number>((resolve, context) => {
            if (data === 1) {
              mainExecutor.final();
            }
            actionlast.subscribe(() => resolve(data)).attach(context.attachable);
          })
        )
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(action1.listenerCount).toEqual(1);
      expect(action2.listenerCount).toEqual(1);
      expect(actionlast.listenerCount).toEqual(0);
      expect(sequence.destroyed).toBeFalsy();

      action1.trigger();
      expect(heap).toEqual([]);
      expect(action1.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);
      expect(actionlast.listenerCount).toEqual(1);
      expect(sequence.destroyed).toBeFalsy();

      actionlast.trigger();
      expect(heap).toEqual([1]);
      expect(action1.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);
      expect(actionlast.listenerCount).toEqual(0);
      expect(sequence.destroyed).toBeTruthy();
    });
  });

  describe('Destruction', () => {
    test('destroying sequence directly', () => {
      let sequence = Sequence.create(resolve => resolve()).attachToRoot();

      expect(sequence.destroyed).toBeFalsy();
      sequence.destroy();
      expect(sequence.destroyed).toBeTruthy();
      expect(sequence['_executor']['_pipeline']).toEqual(undefined);
    });

    test('destroying sequence via constructor context', () => {
      let sequence = Sequence.create((resolve, context) => {
        resolve();
        context.destroy();
      }).attachToRoot();

      expect(sequence.destroyed).toBeTruthy();
      expect(sequence['_executor']['_pipeline']).toEqual(undefined);
    });

    test('destroying sequence via iterator context', () => {
      let sequence = Sequence.create(resolve => {
        resolve();
      })
        .tap((_, context) => {
          context.destroy();
        })
        .attachToRoot();

      expect(sequence.destroyed).toBeTruthy();
      expect(sequence['_executor']['_pipeline']).toEqual(undefined);
    });

    test('destroying parent should destroy sequence', () => {
      let parent = new Attachable().attachToRoot();

      let sequence = Sequence.create(resolve => resolve()).attach(parent);

      expect(sequence.destroyed).toBeFalsy();
      parent.destroy();
      expect(sequence.destroyed).toBeTruthy();
    });

    test('destroy sequence callback', () => {
      let triggered = false;
      let sequence = Sequence.create(() => {
        return () => {
          triggered = true;
        };
      }).attachToRoot();

      expect(triggered).toBeFalsy();
      sequence.destroy();
      expect(triggered).toBeTruthy();
    });

    test('resolve after destruction should not throw error', () => {
      let triggerCount = 0;

      let resolve!: () => void;
      let context: ISequenceCreatorContext;

      let sequence = Sequence.create((r, c) => {
        resolve = r;
        context = c;
      })
        .tap(() => triggerCount++)
        .attachToRoot();

      expect(() => resolve()).not.toThrowError();
      expect(() => context.destroy()).not.toThrowError();
      expect(() => resolve()).not.toThrowError();

      expect(triggerCount).toEqual(1);
      expect(sequence.destroyed).toBeTruthy();
    });
  });

  describe('Attachment Errors', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    test('not attaching to anything should destroy the sequence', () => {
      let sequence = Sequence.create(resolve => resolve());
      vi.runAllTimers();

      expect(sequence.destroyed).toBeTruthy();
    });

    test('not attaching the chain to a target should throw error', () => {
      expect(() => {
        Sequence.create(resolve => resolve())
          .tap(() => {})
          .tap(() => {});

        vi.runAllTimers();
      }).toThrow('Attachable: The object is not attached to anything!');
    });

    test('attaching to a target should not throw error', () => {
      expect(() => {
        Sequence.create(resolve => resolve())
          .tap(() => {})
          .attach(new Attachable().attachToRoot());

        vi.runAllTimers();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('attaching to root should not throw error', () => {
      expect(() => {
        Sequence.create(resolve => resolve())
          .tap(() => {})
          .attachToRoot();

        vi.runAllTimers();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('attaching the chain to a target should not throw error', () => {
      expect(() => {
        Sequence.create(resolve => resolve())
          .tap(() => {})
          .tap(() => {})
          .attach(new Attachable().attachToRoot());

        vi.runAllTimers();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('attaching the chain to root should not throw error', () => {
      expect(() => {
        Sequence.create(resolve => resolve())
          .tap(() => {})
          .tap(() => {})
          .attachToRoot();

        vi.runAllTimers();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });
  });

  describe('Chain', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    describe('to root', () => {
      test('without doing further operations without resolve', () => {
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chainToRoot();

        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('without doing further operations with resolve', () => {
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chainToRoot();

        operation.trigger();
        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('using chain', () => {
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chainToRoot();

        let triggerCount = 0;
        chain
          .tap(() => {
            triggerCount++;
          })
          .attachToRoot();

        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggerCount).toEqual(0);

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggerCount).toEqual(1);

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggerCount).toEqual(2);
      });

      test('chain parent destroy before trigger', () => {
        let chainParent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chainToRoot();

        let triggered = false;
        chain
          .tap(() => {
            triggered = true;
          })
          .attach(chainParent);

        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();

        chainParent.destroy();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();
      });

      test('destroying sequence should finalize the chain', () => {
        let operation = new Action<number>();

        let heap: unknown[] = [];

        let sequence = operation
          .toSequence()
          .tap(value => heap.push(value))
          .map(value => value + 10);
        let chain = sequence
          .chainToRoot()
          .wait()
          .tap(value => heap.push(value))
          .attachToRoot();

        expect(heap).toEqual([]);
        expect(sequence.destroyed).toBeFalsy();
        expect(chain.destroyed).toBeFalsy();

        operation.trigger(1);
        expect(heap).toEqual([1]);
        expect(sequence.destroyed).toBeFalsy();
        expect(chain.destroyed).toBeFalsy();

        sequence.destroy();
        expect(heap).toEqual([1]);
        expect(sequence.destroyed).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();

        vi.runAllTimers();
        expect(heap).toEqual([1, 11]);
        expect(sequence.destroyed).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
      });

      test('multiple chain', () => {
        let operation = new Action();

        let triggerCount1 = 0;
        let triggerCount2 = 0;

        let firstEvent = operation.toSequence();
        let chain1 = firstEvent.chainToRoot();
        let chain2 = chain1
          .tap(() => {
            triggerCount1++;
          })
          .chainToRoot();

        chain2
          .tap(() => {
            triggerCount2++;
          })
          .attachToRoot();

        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain1.destroyed).toBeFalsy();
        expect(chain1.attachIsCalled).toBeTruthy();
        expect(chain2.destroyed).toBeFalsy();
        expect(chain2.attachIsCalled).toBeTruthy();
        expect(triggerCount1).toEqual(0);
        expect(triggerCount2).toEqual(0);

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain1.destroyed).toBeFalsy();
        expect(chain1.attachIsCalled).toBeTruthy();
        expect(chain2.destroyed).toBeFalsy();
        expect(chain2.attachIsCalled).toBeTruthy();
        expect(triggerCount1).toEqual(1);
        expect(triggerCount2).toEqual(1);

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain1.destroyed).toBeFalsy();
        expect(chain1.attachIsCalled).toBeTruthy();
        expect(chain2.destroyed).toBeFalsy();
        expect(chain2.attachIsCalled).toBeTruthy();
        expect(triggerCount1).toEqual(2);
        expect(triggerCount2).toEqual(2);
      });
    });

    describe('directly', () => {
      test('without doing further operations without resolve', () => {
        let parent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chain(parent);

        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('without doing further operations with resolve', () => {
        let parent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chain(parent);

        operation.trigger();
        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('using chain', () => {
        let parent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chain(parent);

        let triggerCount = 0;
        chain
          .tap(() => {
            triggerCount++;
          })
          .attachToRoot();

        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggerCount).toEqual(0);

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggerCount).toEqual(1);

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggerCount).toEqual(2);
      });

      test('chain parent destroy before trigger', () => {
        let parent = new Attachable().attachToRoot();
        let chainParent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chain(parent);

        let triggered = false;
        chain
          .tap(() => {
            triggered = true;
          })
          .attach(chainParent);

        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();

        chainParent.destroy();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();
      });

      test('operation attached parent destroy', () => {
        let parent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chain(parent);

        let triggered = false;
        chain
          .tap(() => {
            triggered = true;
          })
          .attachToRoot();

        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeTruthy();

        parent.destroy();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeTruthy();
      });

      test('multiple chain', () => {
        let parent = new Attachable().attachToRoot();
        let operation = new Action();

        let triggerCount1 = 0;
        let triggerCount2 = 0;

        let firstEvent = operation.toSequence();
        let chain1 = firstEvent.chain(parent);
        let chain2 = chain1
          .tap(() => {
            triggerCount1++;
          })
          .chain(parent);

        chain2
          .tap(() => {
            triggerCount2++;
          })
          .attachToRoot();

        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain1.destroyed).toBeFalsy();
        expect(chain1.attachIsCalled).toBeTruthy();
        expect(chain2.destroyed).toBeFalsy();
        expect(chain2.attachIsCalled).toBeTruthy();
        expect(triggerCount1).toEqual(0);
        expect(triggerCount2).toEqual(0);

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain1.destroyed).toBeFalsy();
        expect(chain1.attachIsCalled).toBeTruthy();
        expect(chain2.destroyed).toBeFalsy();
        expect(chain2.attachIsCalled).toBeTruthy();
        expect(triggerCount1).toEqual(1);
        expect(triggerCount2).toEqual(1);

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain1.destroyed).toBeFalsy();
        expect(chain1.attachIsCalled).toBeTruthy();
        expect(chain2.destroyed).toBeFalsy();
        expect(chain2.attachIsCalled).toBeTruthy();
        expect(triggerCount1).toEqual(2);
        expect(triggerCount2).toEqual(2);
      });
    });

    describe('by id', () => {
      test('without doing further operations without resolve', () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chainByID(parent.id);

        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('without doing further operations with resolve', () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chainByID(parent.id);

        operation.trigger();
        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('using chain', () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chainByID(parent.id);

        let triggerCount = 0;
        chain
          .tap(() => {
            triggerCount++;
          })
          .attachToRoot();

        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggerCount).toEqual(0);

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggerCount).toEqual(1);

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggerCount).toEqual(2);
      });

      test('chain parent destroy before trigger', () => {
        let parent = new IDAttachable().attachToRoot();
        let chainParent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chainByID(parent.id);

        let triggered = false;
        chain
          .tap(() => {
            triggered = true;
          })
          .attach(chainParent);

        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();

        chainParent.destroy();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();
      });

      test('operation attached parent destroy', () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chainByID(parent.id);

        let triggered = false;
        chain
          .tap(() => {
            triggered = true;
          })
          .attachToRoot();

        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();

        operation.trigger();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeFalsy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeTruthy();

        parent.destroy();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeTruthy();
      });

      test('multiple chain', () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action<number>();

        let heap: unknown[] = [];

        let firstEvent = operation.toSequence();
        let chain1 = firstEvent.chainByID(parent.id);
        let chain2 = chain1.tap(data => heap.push(data)).chainByID(parent.id);
        let final = chain2.tap(data => heap.push(data)).attachToRoot();

        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain1.destroyed).toBeFalsy();
        expect(chain1.attachIsCalled).toBeTruthy();
        expect(chain2.destroyed).toBeFalsy();
        expect(chain2.attachIsCalled).toBeTruthy();
        expect(final.destroyed).toBeFalsy();
        expect(final.attachIsCalled).toBeTruthy();
        expect(heap).toEqual([]);

        operation.trigger(1);
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain1.destroyed).toBeFalsy();
        expect(chain1.attachIsCalled).toBeTruthy();
        expect(chain2.destroyed).toBeFalsy();
        expect(chain2.attachIsCalled).toBeTruthy();
        expect(final.destroyed).toBeFalsy();
        expect(final.attachIsCalled).toBeTruthy();
        expect(heap).toEqual([1, 1]);

        operation.trigger(2);
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain1.destroyed).toBeFalsy();
        expect(chain1.attachIsCalled).toBeTruthy();
        expect(chain2.destroyed).toBeFalsy();
        expect(chain2.attachIsCalled).toBeTruthy();
        expect(final.destroyed).toBeFalsy();
        expect(final.attachIsCalled).toBeTruthy();
        expect(heap).toEqual([1, 1, 2, 2]);
      });
    });
  });

  describe('To Single Event', () => {
    test('simple case', () => {
      let heap: unknown[] = [];

      let sequence = Sequence.instant(1, 2, 3);
      let singleEvent = sequence
        .toSingleEvent()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([1]);
      expect(sequence.destroyed).toBeTruthy();
      expect(singleEvent.destroyed).toBeTruthy();
    });

    test('with async sequence', async () => {
      let heap: unknown[] = [];
      let resolve!: (data: number) => void;

      let sequence = Sequence.create<number>(r => {
        resolve = r;
      });

      let singleEvent = sequence
        .toSingleEvent()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(sequence.destroyed).toBeFalsy();
      expect(singleEvent.destroyed).toBeFalsy();

      resolve(99);

      expect(heap).toEqual([99]);
      expect(sequence.destroyed).toBeTruthy();
      expect(singleEvent.destroyed).toBeTruthy();
    });

    test('multiple values in async sequence takes only first', async () => {
      let heap: unknown[] = [];
      let resolve!: (data: number) => void;

      let sequence = Sequence.create<number>(r => {
        resolve = r;
      });

      let singleEvent = sequence
        .toSingleEvent()
        .tap(data => heap.push(data))
        .attachToRoot();

      UnitTestHelper.callEachDelayed([1, 2, 3], value => resolve(value));
      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual([1]);
      expect(sequence.destroyed).toBeTruthy();
      expect(singleEvent.destroyed).toBeTruthy();
    });

    test('destroying single event should destroy the sequence', () => {
      let heap: unknown[] = [];

      let sequence = Sequence.create(() => {});
      let singleEvent = sequence.toSingleEvent();
      let chained = singleEvent.tap(data => heap.push(data)).chainToRoot();

      expect(heap).toEqual([]);
      expect(sequence.destroyed).toBeFalsy();
      expect(singleEvent.destroyed).toBeFalsy();
      expect(chained.destroyed).toBeFalsy();

      singleEvent.destroy();
      expect(heap).toEqual([]);
      expect(sequence.destroyed).toBeTruthy();
      expect(singleEvent.destroyed).toBeTruthy();
      expect(chained.destroyed).toBeTruthy();
    });

    test('destroying sequence should destroy the single event', () => {
      let heap: unknown[] = [];

      let sequence = Sequence.create(() => {});
      let singleEvent = sequence.toSingleEvent();
      let chained = singleEvent.tap(data => heap.push(data)).chainToRoot();

      expect(heap).toEqual([]);
      expect(sequence.destroyed).toBeFalsy();
      expect(singleEvent.destroyed).toBeFalsy();
      expect(chained.destroyed).toBeFalsy();

      sequence.destroy();
      expect(heap).toEqual([]);
      expect(sequence.destroyed).toBeTruthy();
      expect(singleEvent.destroyed).toBeTruthy();
      expect(chained.destroyed).toBeTruthy();
    });

    test('chaining after to single event', () => {
      let heap: unknown[] = [];

      let sequence = Sequence.instant(1);
      let singleEvent = sequence.toSingleEvent();
      let chained = singleEvent
        .map(data => data + 1)
        .chainToRoot()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([2]);
      expect(sequence.destroyed).toBeTruthy();
      expect(singleEvent.destroyed).toBeTruthy();
      expect(chained.destroyed).toBeTruthy();
    });

    test('single event that consumes packages async', () => {
      vi.useFakeTimers();

      let heap: unknown[] = [];

      let sequence = Sequence.instant(1, 2, 3);
      let singleEvent = sequence
        .toSingleEvent()
        .wait()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(sequence.destroyed).toBeTruthy();
      expect(singleEvent.destroyed).toBeFalsy();

      vi.runAllTimers();

      expect(heap).toEqual([1]);
      expect(sequence.destroyed).toBeTruthy();
      expect(singleEvent.destroyed).toBeTruthy();
    });
  });

  describe('Single Chain', () => {
    describe('to root', () => {
      test('basic functionality', () => {
        let heap: unknown[] = [];

        let sequence = Sequence.instant(1, 2, 3);
        let singleEvent = sequence
          .singleChainToRoot()
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([1]);
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
      });

      test('with transformations before singleChainToRoot', () => {
        let heap: unknown[] = [];

        let sequence = Sequence.instant(1, 2, 3, 4, 5);
        let singleEvent = sequence
          .map(x => x * 10)
          .filter(x => x > 20)
          .singleChainToRoot()
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([30]);
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
      });

      test('with transformations after singleChainToRoot', () => {
        let heap: unknown[] = [];

        let sequence = Sequence.instant(5, 6, 7);
        let singleEvent = sequence
          .singleChainToRoot()
          .map(x => x * 100)
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([500]);
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
      });

      test('with async sequence', async () => {
        let heap: unknown[] = [];
        let resolve!: (data: number) => void;

        let sequence = Sequence.create<number>(r => {
          resolve = r;
        });

        let singleEvent = sequence
          .singleChainToRoot()
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([]);
        expect(sequence.destroyed).toBeFalsy();
        expect(singleEvent.destroyed).toBeFalsy();

        resolve(42);

        expect(heap).toEqual([42]);
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
      });

      test('takes only first value from async sequence', async () => {
        let heap: unknown[] = [];
        let resolve!: (data: number) => void;

        let sequence = Sequence.create<number>(r => {
          resolve = r;
        });

        let singleEvent = sequence
          .singleChainToRoot()
          .tap(data => heap.push(data))
          .attachToRoot();

        UnitTestHelper.callEachDelayed([10, 20, 30], value => resolve(value));
        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual([10]);
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
      });

      test('destroying single event destroys sequence', () => {
        let heap: unknown[] = [];

        let sequence = Sequence.create(() => {});
        let singleEvent = sequence.singleChainToRoot();
        let chained = singleEvent.tap(data => heap.push(data)).attachToRoot();

        expect(sequence.destroyed).toBeFalsy();
        expect(singleEvent.destroyed).toBeFalsy();
        expect(chained.destroyed).toBeFalsy();

        singleEvent.destroy();
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
        expect(chained.destroyed).toBeTruthy();
      });

      test('destroying sequence destroys single event', () => {
        let heap: unknown[] = [];

        let sequence = Sequence.create(() => {});
        let singleEvent = sequence.singleChainToRoot();
        let chained = singleEvent.tap(data => heap.push(data)).attachToRoot();

        expect(sequence.destroyed).toBeFalsy();
        expect(singleEvent.destroyed).toBeFalsy();
        expect(chained.destroyed).toBeFalsy();

        sequence.destroy();
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
        expect(chained.destroyed).toBeTruthy();
      });
    });

    describe('directly', () => {
      test('basic functionality', () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();

        let sequence = Sequence.instant(7, 8, 9);
        let singleEvent = sequence
          .singleChain(parent)
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([7]);
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
      });

      test('with transformations', () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();

        let sequence = Sequence.instant(1, 2, 3);
        let singleEvent = sequence
          .map(x => x + 10)
          .singleChain(parent)
          .map(x => x * 2)
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([22]); // (1 + 10) * 2
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
      });

      test('destroying parent destroys chain', () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();

        let sequence = Sequence.create(() => {});
        let singleEvent = sequence.singleChain(parent);
        let chained = singleEvent.tap(data => heap.push(data)).attachToRoot();

        expect(sequence.destroyed).toBeFalsy();
        expect(singleEvent.destroyed).toBeFalsy();
        expect(chained.destroyed).toBeFalsy();

        parent.destroy();
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
        expect(chained.destroyed).toBeTruthy();
      });

      test('with async sequence', async () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();
        let resolve!: (data: string) => void;

        let sequence = Sequence.create<string>(r => {
          resolve = r;
        });

        let singleEvent = sequence
          .singleChain(parent)
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([]);

        resolve('test');

        expect(heap).toEqual(['test']);
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
      });

      test('multiple sequences chained to same parent', async () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();

        let resolve1!: (data: number) => void;
        let resolve2!: (data: number) => void;

        let sequence1 = Sequence.create<number>(r => {
          resolve1 = r;
        });
        let sequence2 = Sequence.create<number>(r => {
          resolve2 = r;
        });

        let singleEvent1 = sequence1
          .singleChain(parent)
          .tap(data => heap.push(data))
          .attachToRoot();

        let singleEvent2 = sequence2
          .singleChain(parent)
          .tap(data => heap.push(data))
          .attachToRoot();

        resolve1(100);
        resolve2(200);

        expect(heap).toEqual([100, 200]);
        expect(sequence1.destroyed).toBeTruthy();
        expect(singleEvent1.destroyed).toBeTruthy();
        expect(sequence2.destroyed).toBeTruthy();
        expect(singleEvent2.destroyed).toBeTruthy();
      });
    });

    describe('by id', () => {
      test('basic functionality', () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();

        let sequence = Sequence.instant(15, 16, 17);
        let singleEvent = sequence
          .singleChainByID(parent.id)
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([15]);
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
      });

      test('with transformations', () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();

        let sequence = Sequence.instant(2, 4, 6);
        let singleEvent = sequence
          .map(x => x * 3)
          .singleChainByID(parent.id)
          .map(x => x + 5)
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([11]); // (2 * 3) + 5
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
      });

      test('destroying parent destroys chain', () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();

        let sequence = Sequence.create(() => {});
        let singleEvent = sequence.singleChainByID(parent.id);
        let chained = singleEvent.tap(data => heap.push(data)).attachToRoot();

        expect(sequence.destroyed).toBeFalsy();
        expect(singleEvent.destroyed).toBeFalsy();
        expect(chained.destroyed).toBeFalsy();

        parent.destroy();
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
        expect(chained.destroyed).toBeTruthy();
      });

      test('with async sequence', async () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();
        let resolve!: (data: number) => void;

        let sequence = Sequence.create<number>(r => {
          resolve = r;
        });

        let singleEvent = sequence
          .singleChainByID(parent.id)
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([]);

        resolve(999);

        expect(heap).toEqual([999]);
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
      });

      test('chaining multiple single events', () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();

        let sequence = Sequence.instant(5);
        let singleEvent1 = sequence.singleChainByID(parent.id);
        let singleEvent2 = singleEvent1.map(x => x * 2).chainByID(parent.id);
        let final = singleEvent2
          .map(x => x + 1)
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([11]); // (5 * 2) + 1
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent1.destroyed).toBeTruthy();
        expect(singleEvent2.destroyed).toBeTruthy();
        expect(final.destroyed).toBeTruthy();
      });

      test('invalid id throws or handles gracefully', () => {
        let sequence = Sequence.instant(1);
        let singleEvent = sequence.singleChainByID(99999);
        let chained = singleEvent.tap(() => {}).attachToRoot();

        // Should not crash, sequence should be destroyed
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
        expect(chained.destroyed).toBeTruthy();
      });
    });

    describe('mixed scenarios', () => {
      test('combining singleChain with regular chain', () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();

        let operation = new Action<number>();
        let sequence = operation
          .toSequence()
          .map(x => x + 1)
          .singleChain(parent);

        let final = sequence
          .map(x => x * 10)
          .tap(data => heap.push(data))
          .attachToRoot();

        operation.trigger(5);

        expect(heap).toEqual([60]); // (5 + 1) * 10
        expect(sequence.destroyed).toBeTruthy();
        expect(final.destroyed).toBeTruthy();
      });

      test('singleChainToRoot with filter that blocks values', async () => {
        let heap: unknown[] = [];
        let resolve!: (data: number) => void;

        let sequence = Sequence.create<number>(r => {
          resolve = r;
        });

        let singleEvent = sequence
          .filter(x => x > 10)
          .singleChainToRoot()
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([]);

        // First values are filtered out
        resolve(1);
        resolve(5);
        resolve(8);
        expect(heap).toEqual([]);
        expect(sequence.destroyed).toBeFalsy();

        // This one passes the filter
        resolve(15);
        expect(heap).toEqual([15]);
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();

        // Subsequent values should not be processed
        resolve(20);
        resolve(25);
        expect(heap).toEqual([15]);
      });

      test('singleChainByID with operation triggering multiple times', () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action<number>();

        let sequence = operation
          .toSequence()
          .singleChainByID(parent.id)
          .tap(data => heap.push(data))
          .attachToRoot();

        operation.trigger(1);
        expect(heap).toEqual([1]);
        expect(sequence.destroyed).toBeTruthy();

        // Further triggers should not affect destroyed sequence
        operation.trigger(2);
        operation.trigger(3);
        expect(heap).toEqual([1]);
      });
    });
  });

  describe('Edge Cases', () => {
    test('Each sequence can be linkable once', () => {
      expect(() => {
        let sequence = Sequence.create<string>(resolve => resolve('a'));
        sequence.tap(() => {}).attachToRoot();
        sequence.tap(() => {});
      }).toThrow('A sequence can only be linked once.');
    });
  });

  describe('Sample Operations', () => {
    test('wait until any of it completed', () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();

      let heap: string[] = [];
      let sequence = Sequence.merge(action1, action2)
        .take(1)
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);

      expect(sequence.destroyed).toBeFalsy();
      expect(action1.listenerCount).toEqual(1);
      expect(action2.listenerCount).toEqual(1);

      action1.trigger('a');
      expect(heap).toEqual(['a']);
      expect(sequence.destroyed).toBeTruthy();
      expect(action1.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);

      action2.trigger('b');
      expect(heap).toEqual(['a']);
    });

    test('wait until all completed', () => {
      let action1 = new Action<void>();
      let action2 = new Action<void>();

      let callCount = 0;

      let sequence = Sequence.combine({ a: action1, b: action2 })
        .take(1)
        .tap(() => callCount++)
        .attachToRoot();

      expect(sequence.destroyed).toBeFalsy();
      expect(action1.listenerCount).toEqual(1);
      expect(action2.listenerCount).toEqual(1);

      action1.trigger();
      action1.trigger();
      expect(callCount).toEqual(0);
      expect(sequence.destroyed).toBeFalsy();
      expect(action1.listenerCount).toEqual(1);
      expect(action2.listenerCount).toEqual(1);

      action2.trigger();
      action2.trigger();
      expect(callCount).toEqual(1);
      expect(sequence.destroyed).toBeTruthy();
      expect(action1.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);
    });

    test('wait until next', () => {
      let action = new Action<void>();

      let triggerCount = 0;
      let singleEvent = action
        .toSingleEvent()
        .tap(() => triggerCount++)
        .attachToRoot();

      expect(triggerCount).toEqual(0);
      expect(singleEvent.destroyed).toBeFalsy();

      action.trigger();
      expect(triggerCount).toEqual(1);
      expect(singleEvent.destroyed).toBeTruthy();

      action.trigger();
      expect(triggerCount).toEqual(1);
      expect(singleEvent.destroyed).toBeTruthy();
    });

    test('wait until', () => {
      let action = new Action<string>();

      let heap: unknown[] = [];
      let singleEvent = action
        .filter(value => value === 'yes')
        .toSingleEvent()
        .tap(value => heap.push(value))
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(singleEvent.destroyed).toBeFalsy();

      action.trigger('not');
      expect(heap).toEqual([]);
      expect(singleEvent.destroyed).toBeFalsy();

      action.trigger('yes');
      expect(heap).toEqual(['yes']);
      expect(singleEvent.destroyed).toBeTruthy();

      action.trigger('not');
      action.trigger('yes');
      action.trigger('not');
      action.trigger('yes');
      expect(heap).toEqual(['yes']);
      expect(singleEvent.destroyed).toBeTruthy();
    });
  });

  describe('Combinations', () => {
    test('sequence and action', async () => {
      let action = new Action<string>();

      let heap: string[] = [];
      action
        .asyncMapOrdered(data =>
          Sequence.create<string>(resolve => {
            UnitTestHelper.callEachDelayed(['a', 'b', 'c'], value => resolve(data + value));
          })
        )
        .tap(data => {
          heap.push(data);
        })
        .attachToRoot();

      UnitTestHelper.callEachDelayed(['1', '2', '3'], value => {
        action.trigger(value);
      });

      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual(['1a', '2a', '3a']);
    });

    test('complex merge and combine destroy after all complete', async () => {
      let sequence1 = Sequence.create<number>(resolve => {
        UnitTestHelper.callEachDelayed([10, 11], delayedValue => resolve(delayedValue));
      }).asyncMapOrdered(value =>
        Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed([value + 's1'], delayedValue => resolve(delayedValue)))
      );

      let sequence2 = Sequence.create<number>(resolve => {
        UnitTestHelper.callEachDelayed([20, 21], delayedValue => resolve(delayedValue));
      }).asyncMapOrdered(value => Sequence.create<string>(resolve => resolve(value + 's2')));

      let merged = Sequence.merge(sequence1, sequence2).asyncMapOrdered(value =>
        Sequence.create<string>(resolve => {
          UnitTestHelper.callEachDelayed([value + 'm'], delayedValue => resolve(delayedValue));
        })
      ); // 20s2m 10s1m 21s2m 11s1m

      let sequence3 = Sequence.create<string>(resolve => resolve('a')).map(value => value + 's3');
      let sequence4 = Sequence.create<string>(resolve => resolve('b')).asyncMapOrdered(value =>
        Sequence.create<string>(resolve => {
          UnitTestHelper.callEachDelayed([value + 's4'], delayedValue => resolve(delayedValue));
        })
      );

      let heap: unknown[] = [];
      let combined = Sequence.combine({
        m: merged,
        s3: sequence3,
        s4: sequence4
      })
        .tap(value => heap.push(value))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();

      expect(heap).toEqual([
        {
          m: '20s2m',
          s3: 'as3',
          s4: 'bs4'
        },
        {
          m: '10s1m',
          s3: 'as3',
          s4: 'bs4'
        },
        {
          m: '21s2m',
          s3: 'as3',
          s4: 'bs4'
        },
        {
          m: '11s1m',
          s3: 'as3',
          s4: 'bs4'
        }
      ]);

      combined.destroy();
      expect(sequence1.destroyed).toBeTruthy();
      expect(sequence2.destroyed).toBeTruthy();
      expect(sequence3.destroyed).toBeTruthy();
      expect(sequence4.destroyed).toBeTruthy();
      expect(merged.destroyed).toBeTruthy();
      expect(combined.destroyed).toBeTruthy();
    });

    test('complex merge and combine destroyed by sequences', async () => {
      let sequence1 = Sequence.create<number>((resolve, context) => {
        UnitTestHelper.callEachDelayed([10, 11], delayedValue => resolve(delayedValue), {
          allDone: () => context.final()
        });
      }).asyncMapOrdered(value =>
        Sequence.create<string>((resolve, context) =>
          UnitTestHelper.callEachDelayed([value + 's1'], delayedValue => resolve(delayedValue), {
            allDone: () => context.final()
          })
        )
      );

      let sequence2 = Sequence.create<number>((resolve, context) => {
        UnitTestHelper.callEachDelayed([20, 21], delayedValue => resolve(delayedValue), { allDone: () => context.final() });
      }).asyncMapOrdered(value =>
        Sequence.create<string>((resolve, context) => {
          resolve(value + 's2');
          context.final();
        })
      );

      let merged = Sequence.merge(sequence1, sequence2).asyncMapOrdered(value =>
        Sequence.create<string>(resolve => {
          UnitTestHelper.callEachDelayed([value + 'm'], delayedValue => resolve(delayedValue));
        })
      );

      let sequence3 = Sequence.create<string>((resolve, context) => {
        resolve('a');
        context.final();
      }).map(value => value + 's3');
      let sequence4 = Sequence.create<string>((resolve, context) => {
        resolve('b');
        context.final();
      }).asyncMapOrdered(value =>
        Sequence.create<string>((resolve, context) => {
          UnitTestHelper.callEachDelayed([value + 's4'], delayedValue => resolve(delayedValue), {
            allDone: () => context.final()
          });
        })
      );

      let heap: unknown[] = [];
      Sequence.combine({
        m: merged,
        s3: sequence3,
        s4: sequence4
      })
        .tap(value => heap.push(value))
        .attachToRoot();

      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual([
        {
          m: '20s2m',
          s3: 'as3',
          s4: 'bs4'
        },
        {
          m: '10s1m',
          s3: 'as3',
          s4: 'bs4'
        },
        {
          m: '21s2m',
          s3: 'as3',
          s4: 'bs4'
        },
        {
          m: '11s1m',
          s3: 'as3',
          s4: 'bs4'
        }
      ]);
    });

    test('complex merge and combine instantly finalized sequences', async () => {
      let sequence1 = Sequence.create<string>((resolve, context) => {
        resolve('1');
        context.final();
      }).map(value => value + '1');

      let sequence2 = Sequence.create<string>((resolve, context) => {
        resolve('2');
        context.final();
      }).asyncMapOrdered(value =>
        Sequence.create<string>((resolve, context) => {
          resolve(value + '2');
          context.final();
        })
      );

      let merged = Sequence.merge(sequence1, sequence2).asyncMapOrdered(value =>
        Sequence.create<string>((resolve, context) => {
          resolve(value + 'm');
          context.final();
        })
      );

      let sequence3 = Sequence.create<string>((resolve, context) => {
        resolve('a');
        context.final();
      }).map(value => value + 's3');

      let heap: unknown[] = [];
      let combined = Sequence.combine({
        s3: sequence3,
        m: merged
      })
        .tap(value => heap.push(value))
        .attachToRoot();

      combined.destroy();
      await UnitTestHelper.waitForAllOperations();

      sequence1 = undefined as any;
      sequence2 = undefined as any;
      sequence3 = undefined as any;
      combined = undefined as any;
      merged = undefined as any;

      expect(heap).toEqual([
        {
          m: '11m',
          s3: 'as3'
        },
        {
          m: '22m',
          s3: 'as3'
        }
      ]);
    });
  });
});
