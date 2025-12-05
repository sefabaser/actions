import { UnitTestHelper, Wait } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../../../attachable/attachable';
import { IDAttachable } from '../../../attachable/id-attachable';
import { Action } from '../../../observables/action/action';
import { Variable } from '../../../observables/variable/variable';
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
    describe('Destroying Sequence', () => {
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

      test('destroy listeners should be called after destruction', () => {
        let sequence = Sequence.instant();

        let triggered = false;
        sequence['_executor']['_onDestroyListener'] = () => {
          triggered = true;
        };

        expect(triggered).toBeFalsy();
        sequence.destroy();
        expect(triggered).toBeTruthy();
      });
    });

    describe('Destroy Callback', () => {
      test('should be called when sequence is destroyed', () => {
        let triggered = false;
        let sequence = Sequence.create<void>(() => {
          return () => {
            triggered = true;
          };
        })
          .wait()
          .attachToRoot();

        expect(triggered).toBeFalsy();
        sequence.destroy();
        expect(triggered).toBeTruthy();
      });

      test('when finalized and then destroyed, it still should be called once', () => {
        let triggerCount = 0;
        let singleEvent = Sequence.create<void>((resolve, context) => {
          resolve();
          context.final();
          return () => {
            triggerCount++;
          };
        })
          .wait()
          .attachToRoot();

        expect(triggerCount).toEqual(1);
        singleEvent.destroy();
        expect(triggerCount).toEqual(1);
      });

      test('should be called when sequence is finalized', async () => {
        let triggered = false;
        let final!: () => void;

        let sequence = Sequence.create<void>((resolve, context) => {
          resolve();

          final = () => context.final();
          return () => {
            triggered = true;
          };
        })
          .wait()
          .attachToRoot();

        expect(triggered).toBeFalsy();
        expect(sequence.destroyed).toBeFalsy();

        final();
        expect(triggered).toBeTruthy();
        expect(sequence.destroyed).toBeFalsy();

        await Wait();
        expect(triggered).toBeTruthy();
        expect(sequence.destroyed).toBeTruthy();
      });
    });

    describe('Attaching To Creator Context', () => {
      test('attachments on the context attachable should be destroyed right after the iteration step', async () => {
        let action1 = new Action<void>();
        let action2 = new Action<void>();
        let triggered = false;

        let sequence = Sequence.create<void>((resolve, context) => {
          action1
            .subscribe(() => {
              triggered = true;
              resolve();
              context.final();
            })
            .attach(context.attachable);
        })
          .asyncMapDirect(() => action2)
          .attachToRoot();

        expect(sequence.destroyed).toBeFalsy();
        expect(action1.listenerCount).toEqual(1);
        expect(action2.listenerCount).toEqual(0);
        expect(triggered).toBeFalsy();

        action1.trigger();

        expect(sequence.destroyed).toBeFalsy();
        expect(action1.listenerCount).toEqual(0);
        expect(action2.listenerCount).toEqual(1);
        expect(triggered).toBeTruthy();

        sequence.destroy();

        expect(sequence.destroyed).toBeTruthy();
        expect(action1.listenerCount).toEqual(0);
        expect(action2.listenerCount).toEqual(0);
      });

      test('destroying subscriptions via attachment, instantly finalizing sequence, in map', async () => {
        let variable = new Variable<number>(1);

        let triggered = false;
        let subscriptionCountInside: number | undefined;

        Sequence.create<void>((resolve, context) => {
          variable
            .subscribe(() => {
              triggered = true;
            })
            .attach(context.attachable);
          subscriptionCountInside = variable.listenerCount;

          resolve();
          context.final();
        })
          .wait()
          .attachToRoot();

        expect(variable.listenerCount).toEqual(0);
        expect(subscriptionCountInside).toEqual(1);
        expect(triggered).toBeTruthy();
      });
    });

    describe('Attaching To Link Context', () => {
      test('attachments on the context attachable should be destroyed right after the iteration step', async () => {
        let action1 = new Action<void>();
        let action2 = new Action<void>();
        let triggered = false;

        let sequence = Sequence.create<void>(resolve => resolve())
          .asyncMapDirect((_, context) =>
            Sequence.create(r => {
              action1
                .subscribe(() => {
                  triggered = true;
                  r();
                })
                .attach(context.attachable);
            })
          )
          .asyncMapDirect(() => action2)
          .attachToRoot();

        expect(sequence.destroyed).toBeFalsy();
        expect(action1.listenerCount).toEqual(1);
        expect(action2.listenerCount).toEqual(0);
        expect(triggered).toBeFalsy();

        action1.trigger();

        expect(sequence.destroyed).toBeFalsy();
        expect(action1.listenerCount).toEqual(0);
        expect(action2.listenerCount).toEqual(1);
        expect(triggered).toBeTruthy();

        sequence.destroy();

        expect(sequence.destroyed).toBeTruthy();
        expect(action1.listenerCount).toEqual(0);
        expect(action2.listenerCount).toEqual(0);
      });

      test('destroying subscriptions via attachment, instantly finalizing sequence, in map', async () => {
        let variable = new Variable<number>(1);

        let triggered = false;
        let subscriptionCountInside: number | undefined;

        Sequence.create<void>(resolve => {
          resolve();
        })
          .map((_, context) => {
            variable
              .subscribe(() => {
                triggered = true;
              })
              .attach(context.attachable);
            subscriptionCountInside = variable.listenerCount;
          })
          .wait()
          .attachToRoot();

        expect(triggered).toBeTruthy();
        expect(subscriptionCountInside).toEqual(1);
        expect(variable.listenerCount).toEqual(0);
      });

      test('destroying subscriptions via attachment, in returned single event', async () => {
        let action = new Action();
        let triggered = false;

        Sequence.create<void>(resolve => {
          UnitTestHelper.callEachDelayed([undefined], () => resolve());
        })
          .asyncMapDirect((_, context) =>
            Sequence.create(r => {
              action
                .subscribe(() => {
                  triggered = true;
                  r();
                })
                .attach(context.attachable);
            })
          )
          .wait()
          .attachToRoot();

        expect(action.listenerCount).toEqual(0);
        expect(triggered).toBeFalsy();

        await UnitTestHelper.waitForAllOperations();

        expect(action.listenerCount).toEqual(1);
        expect(triggered).toBeFalsy();

        action.trigger();

        expect(action.listenerCount).toEqual(0);
        expect(triggered).toBeTruthy();
      });
    });
  });

  describe('Attachment Errors', () => {
    test('not attaching with destroyIfNotAttached should destroy the sequence', async () => {
      let sequence = Sequence.create(resolve => resolve()).destroyIfNotAttached();
      await Wait();

      expect(sequence.destroyed).toBeTruthy();
    });

    test('not attaching the sequence should throw error', async () => {
      let errorCapturer = UnitTestHelper.captureErrors();

      Sequence.create(resolve => resolve());

      await Wait();

      expect(() => errorCapturer.throwErrors()).toThrow('Attachable: The object is not attached to anything!');
      errorCapturer.destroy();
    });

    test('attaching to a target should not throw error', () => {
      expect(async () => {
        Sequence.create(resolve => resolve())
          .tap(() => {})
          .attach(new Attachable().attachToRoot());

        await Wait();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('attaching to root should not throw error', () => {
      expect(async () => {
        Sequence.create(resolve => resolve())
          .tap(() => {})
          .attachToRoot();

        await Wait();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('attaching the chain to a target should not throw error', () => {
      expect(async () => {
        Sequence.create(resolve => resolve())
          .tap(() => {})
          .tap(() => {})
          .attach(new Attachable().attachToRoot());

        await Wait();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('attaching the chain to root should not throw error', () => {
      expect(async () => {
        Sequence.create(resolve => resolve())
          .tap(() => {})
          .tap(() => {})
          .attachToRoot();

        await Wait();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });
  });

  describe('Chain', () => {
    describe('to root', () => {
      test('without doing further operations without resolve', async () => {
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chainToRoot();

        await Wait();
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

      test('without doing further operations with resolve', async () => {
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chainToRoot();

        operation.trigger();

        await Wait();
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

      test('chain parent destroy before trigger', async () => {
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

        await Wait();
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

      test('destroying sequence should finalize the chain', async () => {
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

        await Wait();
        expect(heap).toEqual([1, 11]);
        expect(sequence.destroyed).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
      });

      test('multiple chain', async () => {
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

        await Wait();
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
      test('without doing further operations without resolve', async () => {
        let parent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chain(parent);

        await Wait();
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

      test('without doing further operations with resolve', async () => {
        let parent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chain(parent);

        operation.trigger();

        await Wait();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('using chain', async () => {
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

        await Wait();
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

      test('chain parent destroy before trigger', async () => {
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

        await Wait();
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

      test('destroying sequence should finalize the chain', async () => {
        let operation = new Action<number>();
        let parent = new Attachable().attachToRoot();
        let chainParent = new Attachable().attachToRoot();

        let heap: unknown[] = [];

        let sequence = operation
          .toSequence()
          .tap(value => heap.push(value))
          .map(value => value + 10);
        let chain = sequence
          .chain(parent)
          .wait()
          .tap(value => heap.push(value))
          .attach(chainParent);

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

        await Wait();
        expect(heap).toEqual([1, 11]);
        expect(sequence.destroyed).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
      });

      test('multiple chain', async () => {
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

        await Wait();
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

      test('operation attached parent destroy', async () => {
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

        await Wait();
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
    });

    describe('by id', () => {
      test('without doing further operations without resolve', async () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chainByID(parent.id);

        await Wait();
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

      test('without doing further operations with resolve', async () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSequence();
        let chain = firstEvent.chainByID(parent.id);

        operation.trigger();

        await Wait();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('using chain', async () => {
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

        await Wait();
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

      test('chain parent destroy before trigger', async () => {
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

        await Wait();
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

      test('destroying sequence should finalize the chain', async () => {
        let operation = new Action<number>();
        let parent = new IDAttachable().attachToRoot();
        let chainParent = new IDAttachable().attachToRoot();

        let heap: unknown[] = [];

        let sequence = operation
          .toSequence()
          .tap(value => heap.push(value))
          .map(value => value + 10);
        let chain = sequence
          .chainByID(parent.id)
          .wait()
          .tap(value => heap.push(value))
          .chainByID(chainParent.id);

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

        await Wait();
        expect(heap).toEqual([1, 11]);
        expect(sequence.destroyed).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
      });

      test('multiple chain', async () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action<number>();

        let heap: unknown[] = [];

        let firstEvent = operation.toSequence();
        let chain1 = firstEvent.chainByID(parent.id);
        let chain2 = chain1.tap(data => heap.push(data)).chainByID(parent.id);
        let final = chain2.tap(data => heap.push(data)).attachToRoot();

        await Wait();
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

      test('operation attached parent destroy', async () => {
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

        await Wait();
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

    test('single event that consumes packages async', async () => {
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

      await Wait();

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

      test('with transformations', () => {
        let heap: unknown[] = [];

        let sequence = Sequence.instant(1, 2, 3);
        let singleEvent = sequence
          .map(x => x + 10)
          .singleChainToRoot()
          .map(x => x * 2)
          .tap(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([22]); // (1 + 10) * 2
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

      test('destroying single event should not effect sequence', () => {
        let heap: unknown[] = [];

        let sequence = Sequence.create(() => {});
        let singleEvent = sequence.singleChainToRoot();
        let chained = singleEvent.tap(data => heap.push(data)).attachToRoot();

        expect(sequence.destroyed).toBeFalsy();
        expect(singleEvent.destroyed).toBeFalsy();
        expect(chained.destroyed).toBeFalsy();

        singleEvent.destroy();
        expect(sequence.destroyed).toBeFalsy();
        expect(singleEvent.destroyed).toBeTruthy();
        expect(chained.destroyed).toBeTruthy();
      });

      test('chaining multiple single events', () => {
        let heap: unknown[] = [];

        let sequence = Sequence.instant(5);
        let singleEvent1 = sequence.singleChainToRoot();
        let singleEvent2 = singleEvent1.map(x => x * 2).chainToRoot();
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

      test('takes only first value from async sequence', async () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();
        let resolve!: (data: number) => void;

        let sequence = Sequence.create<number>(r => {
          resolve = r;
        });

        let singleEvent = sequence
          .singleChain(parent)
          .tap(data => heap.push(data))
          .attachToRoot();

        UnitTestHelper.callEachDelayed([10, 20, 30], value => resolve(value));
        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual([10]);
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
      });

      test('destroying sequence destroys single event', () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();

        let sequence = Sequence.create(() => {});
        let singleEvent = sequence.singleChain(parent);
        let chained = singleEvent.tap(data => heap.push(data)).attachToRoot();

        expect(sequence.destroyed).toBeFalsy();
        expect(singleEvent.destroyed).toBeFalsy();
        expect(chained.destroyed).toBeFalsy();

        sequence.destroy();
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
        expect(chained.destroyed).toBeTruthy();
      });

      test('destroying single event should not effect sequence', () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();

        let sequence = Sequence.create(() => {});
        let singleEvent = sequence.singleChain(parent);
        let chained = singleEvent.tap(data => heap.push(data)).attachToRoot();

        expect(sequence.destroyed).toBeFalsy();
        expect(singleEvent.destroyed).toBeFalsy();
        expect(chained.destroyed).toBeFalsy();

        singleEvent.destroy();
        expect(sequence.destroyed).toBeFalsy();
        expect(singleEvent.destroyed).toBeTruthy();
        expect(chained.destroyed).toBeTruthy();
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

        parent.destroy();

        resolve1(100);
        resolve2(200);

        expect(heap).toEqual([]);
        expect(sequence1.destroyed).toBeTruthy();
        expect(singleEvent1.destroyed).toBeTruthy();
        expect(sequence2.destroyed).toBeTruthy();
        expect(singleEvent2.destroyed).toBeTruthy();
      });

      test('chaining multiple single events', () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();

        let sequence = Sequence.instant(5);
        let singleEvent1 = sequence.singleChain(parent);
        let singleEvent2 = singleEvent1.map(x => x * 2).chain(parent);
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

      test('takes only first value from async sequence', async () => {
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

        UnitTestHelper.callEachDelayed([10, 20, 30], value => resolve(value));
        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual([10]);
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
      });

      test('destroying sequence destroys single event', () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();

        let sequence = Sequence.create(() => {});
        let singleEvent = sequence.singleChainByID(parent.id);
        let chained = singleEvent.tap(data => heap.push(data)).attachToRoot();

        expect(sequence.destroyed).toBeFalsy();
        expect(singleEvent.destroyed).toBeFalsy();
        expect(chained.destroyed).toBeFalsy();

        sequence.destroy();
        expect(sequence.destroyed).toBeTruthy();
        expect(singleEvent.destroyed).toBeTruthy();
        expect(chained.destroyed).toBeTruthy();
      });

      test('destroying single event should not effect sequence', () => {
        let heap: unknown[] = [];
        let parent = new IDAttachable().attachToRoot();

        let sequence = Sequence.create(() => {});
        let singleEvent = sequence.singleChainByID(parent.id);
        let chained = singleEvent.tap(data => heap.push(data)).attachToRoot();

        expect(sequence.destroyed).toBeFalsy();
        expect(singleEvent.destroyed).toBeFalsy();
        expect(chained.destroyed).toBeFalsy();

        singleEvent.destroy();
        expect(sequence.destroyed).toBeFalsy();
        expect(singleEvent.destroyed).toBeTruthy();
        expect(chained.destroyed).toBeTruthy();
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
          .singleChainByID(parent.id)
          .tap(data => heap.push(data))
          .attachToRoot();

        let singleEvent2 = sequence2
          .singleChainByID(parent.id)
          .tap(data => heap.push(data))
          .attachToRoot();

        parent.destroy();

        resolve1(100);
        resolve2(200);

        expect(heap).toEqual([]);
        expect(sequence1.destroyed).toBeTruthy();
        expect(singleEvent1.destroyed).toBeTruthy();
        expect(sequence2.destroyed).toBeTruthy();
        expect(singleEvent2.destroyed).toBeTruthy();
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

    test(`Race condition, sequences destroying another sequences' parent`, () => {
      let action = new Action();

      class Foo extends Attachable {
        foo = { x: 1 };

        destroy(): void {
          super.destroy();
          this.foo = undefined as any;
        }
      }

      let parent = new Foo().attachToRoot();
      let triggered1 = false;
      let triggered2 = false;

      action
        .toSequence()
        .tap(() => {
          triggered1 = true;
          if (parent.foo.x) {
            parent.destroy();
          }
        })
        .attach(parent);

      action
        .toSequence()
        .tap(() => {
          triggered2 = true;
          if (parent.foo.x) {
            parent.destroy();
          }
        })
        .attach(parent);

      expect(() => action.trigger()).not.throw();
      expect(triggered1).toBeTruthy();
      expect(triggered2).toBeFalsy();
    });

    test('using an attached sequence after timeout should throw error', async () => {
      let event = Sequence.create<void>(resolve => resolve()).attachToRoot();

      await expect(async () => {
        UnitTestHelper.callDelayed(() => {
          let sequence = Sequence.create<void>(resolve => resolve());
          try {
            sequence.asyncMapDirect(() => event).attachToRoot();
          } catch (e) {
            sequence['_executor']['_attachIsCalled'] = true; // silence the error
            throw e;
          }
        });

        await UnitTestHelper.waitForAllOperations();
      }).rejects.toThrow('Sequence: After attaching, you cannot add another operation.');
    });
  });
});
