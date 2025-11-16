import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../../../attachable/attachable';
import { IDAttachable } from '../../../attachable/id-attachable';
import { ActionLibHardReset } from '../../../helpers/hard-reset';
import { Action } from '../../../observables/action/action';
import { Variable } from '../../../observables/variable/variable';
import { Sequence } from '../sequence';
import { ISequenceCreatorContext } from '../sequence-executor';

describe('Sequence', () => {
  beforeEach(() => {
    ActionLibHardReset.hardReset();
    UnitTestHelper.reset();
  });

  describe('Setup - sequence without links', () => {
    describe('Triggers', () => {
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
            .read(() => {})
            .attachToRoot()
            .read(() => {})
        ).toThrow('Sequence: After attaching, you cannot add another operation.');
        await UnitTestHelper.waitForAllOperations();
      });
    });

    describe('Finalization', () => {
      test('when sequence is finalized it should destroy itself and its pipeline', async () => {
        let heap: unknown[] = [];

        let sequence = Sequence.create<number>((resolve, context) => {
          resolve(1);
          context.final();
        })
          .read(value => heap.push(value))
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
          .read(value => heap.push(value))
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
          .read(data => heap.push(data))
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
          .read(data => heap.push(data))
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
          .read(data => heap.push(data))
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
          .read((_, context) => {
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
          .read(() => triggerCount++)
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
            .read(() => {})
            .read(() => {});

          vi.runAllTimers();
        }).toThrow('Attachable: The object is not attached to anything!');
      });

      test('attaching to a target should not throw error', () => {
        expect(() => {
          Sequence.create(resolve => resolve())
            .read(() => {})
            .attach(new Attachable().attachToRoot());

          vi.runAllTimers();
        }).not.toThrow('Attachable: The object is not attached to anything!');
      });

      test('attaching to root should not throw error', () => {
        expect(() => {
          Sequence.create(resolve => resolve())
            .read(() => {})
            .attachToRoot();

          vi.runAllTimers();
        }).not.toThrow('Attachable: The object is not attached to anything!');
      });

      test('attaching the chain to a target should not throw error', () => {
        expect(() => {
          Sequence.create(resolve => resolve())
            .read(() => {})
            .read(() => {})
            .attach(new Attachable().attachToRoot());

          vi.runAllTimers();
        }).not.toThrow('Attachable: The object is not attached to anything!');
      });

      test('attaching the chain to root should not throw error', () => {
        expect(() => {
          Sequence.create(resolve => resolve())
            .read(() => {})
            .read(() => {})
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
            .read(() => {
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
          let chainParent = new Attachable().attachToRoot();
          let operation = new Action();

          let firstEvent = operation.toSequence();
          let chain = firstEvent.chainToRoot();

          let triggered = false;
          chain
            .read(() => {
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
            .read(() => {
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
            .read(() => {
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
            .read(() => {
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
            .read(() => {
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
            .read(() => {
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
            .read(() => {
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
      });
    });

    describe('Edge Cases', () => {
      test('Each sequence can be linkable once', () => {
        expect(() => {
          let sequence = Sequence.create<string>(resolve => resolve('a'));
          sequence.read(() => {}).attachToRoot();
          sequence.read(() => {});
        }).toThrow('A sequence can only be linked once.');
      });
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
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([undefined]);
      expect(sequence['_executor']._ongoingPackageCount).toEqual(0);
    });

    test('with data', () => {
      let heap: string[] = [];

      let sequence = Sequence.instant<string>('a', 'b', 'c')
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a', 'b', 'c']);
      expect(sequence['_executor']._ongoingPackageCount).toEqual(0);
    });
  });

  describe('Read', () => {
    describe('Triggers', () => {
      test('simple sequence sync triggers', () => {
        let heap: string[] = [];

        let resolve!: (data: string) => void;
        Sequence.create<string>(r => {
          resolve = r;
          resolve('a');
        })
          .read(data => heap.push(data))
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
          .read(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual(['a', 'b', 'c']);
      });

      test('simple sequence mixed triggers', async () => {
        let heap: string[] = [];

        let resolve!: (data: string) => void;
        Sequence.create<string>(r => {
          r('a');
          r('b');
          resolve = r;
        })
          .read(data => heap.push(data))
          .attachToRoot();

        resolve('x');
        resolve('y');
        UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual(['a', 'b', 'x', 'y', 'k', 't']);
      });
    });

    describe('Behavior', () => {
      test('sync read chain', () => {
        let heap: string[] = [];

        Sequence.create(resolve => resolve())
          .read(() => {
            heap.push('a');
          })
          .read(() => {
            heap.push('b');
          })
          .read(() => {
            heap.push('c');
          })
          .attachToRoot();

        expect(heap).toEqual(['a', 'b', 'c']);
      });

      test('instantly finalizing sequence chain', () => {
        let heap: string[] = [];

        Sequence.create((resolve, context) => {
          resolve();
          context.final();
        })
          .read(() => {
            heap.push('a');
          })
          .read(() => {
            heap.push('b');
          })
          .read(() => {
            heap.push('c');
          })
          .attachToRoot();

        expect(heap).toEqual(['a', 'b', 'c']);
      });

      test('mixed read chain', async () => {
        let heap: string[] = [];

        let resolve!: (data: string) => void;
        Sequence.create<string>(r => {
          r('a');
          r('b');
          resolve = r;
        })
          .read(data => {
            heap.push('1' + data);
          })
          .read(data => {
            heap.push('2' + data);
          })
          .read(data => {
            heap.push('3' + data);
          })
          .attachToRoot();

        resolve('x');
        resolve('y');
        UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual([
          '1a',
          '2a',
          '3a',
          '1b',
          '2b',
          '3b',
          '1x',
          '2x',
          '3x',
          '1y',
          '2y',
          '3y',
          '1k',
          '2k',
          '3k',
          '1t',
          '2t',
          '3t'
        ]);
      });

      test('read should not change the data', () => {
        let heap: string[] = [];
        Sequence.create<string>(resolve => resolve('a'))
          .read(data => {
            heap.push('1' + data);
            return 2;
          })
          .read(data => {
            heap.push('2' + data);
          })
          .attachToRoot();

        expect(heap).toEqual(['1a', '2a']);
      });

      test('resolve undefined should still trigger next link', () => {
        let heap: unknown[] = [];
        Sequence.create(resolve => resolve())
          .read(data => {
            heap.push(data);
          })
          .attachToRoot();

        expect(heap).toEqual([undefined]);
      });
    });

    describe('Destruction', () => {
      test('destroying sequence', () => {
        let sequence = Sequence.create(resolve => resolve())
          .read(() => {})
          .read(() => {})
          .read(() => {})
          .attachToRoot();

        expect(sequence.destroyed).toBeFalsy();
        sequence.destroy();
        expect(sequence.destroyed).toBeTruthy();
      });

      test('destroying parent should destroy sequence', () => {
        let parent = new Attachable().attachToRoot();

        let sequence = Sequence.create(resolve => resolve())
          .read(() => {})
          .read(() => {})
          .read(() => {})
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
          .read(() => {})
          .read(() => {})
          .read(() => {})
          .attachToRoot();

        expect(triggered).toBeFalsy();
        sequence.destroy();
        expect(triggered).toBeTruthy();
      });
    });
  });

  describe('Map', () => {
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

  describe('Filter', () => {
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
          .read(data => heap.push(data))
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
          .read(data => heap.push(data))
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
          .read(data => heap.push(data))
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

  describe('Take', () => {
    describe('Behavior', () => {
      test('sync triggers', () => {
        let heap: string[] = [];

        let resolve!: (data: string) => void;
        Sequence.create<string>(r => {
          resolve = r;
          resolve('a');
          resolve('b');
        })
          .take(3)
          .read(data => heap.push(data))
          .attachToRoot();

        resolve('x');
        resolve('y');
        expect(heap).toEqual(['a', 'b', 'x']);
      });

      test('mixed triggers', async () => {
        let heap: string[] = [];

        let resolve!: (data: string) => void;
        Sequence.create<string>(r => {
          r('a');
          r('b');
          resolve = r;
        })
          .take(5)
          .read(data => heap.push(data))
          .attachToRoot();

        resolve('x');
        resolve('y');
        UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual(['a', 'b', 'x', 'y', 'k']);
      });

      test('taking more than triggers', () => {
        let heap: string[] = [];

        let resolve!: (data: string) => void;
        let sequence = Sequence.create<string>(r => {
          resolve = r;
          resolve('a');
          resolve('b');
        })
          .take(5)
          .read(data => heap.push(data))
          .attachToRoot();

        resolve('x');
        resolve('y');
        expect(heap).toEqual(['a', 'b', 'x', 'y']);
        expect(sequence.destroyed).toBeFalsy();
      });

      test('instantly resolving the sequence should not block the chain', () => {
        let heap: string[] = [];
        Sequence.create<string>(resolve => resolve('a'))
          .take(1)
          .read(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual(['a']);
      });

      test('taking less then instant triggers', () => {
        let heap: string[] = [];
        Sequence.create<string>(resolve => {
          resolve('a');
          resolve('b');
          resolve('c');
        })
          .take(2)
          .read(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual(['a', 'b']);
      });
    });

    describe('Destruction', () => {
      test('destroying sequence', () => {
        let sequence = Sequence.create(resolve => resolve())
          .take(2)
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
        });

        expect(triggered).toBeFalsy();
        sequence.take(1).attachToRoot();
        expect(triggered).toBeTruthy();
      });

      test('directly resolved sequence callback', () => {
        let heap: string[] = [];
        Sequence.create(resolve => {
          resolve();
          return () => heap.push('destroyed');
        })
          .read(() => heap.push('read1'))
          .take(1)
          .read(() => heap.push('read2'))
          .attachToRoot();

        expect(heap).toEqual(['read1', 'read2', 'destroyed']);
      });

      test('destroying parent should destroy sequence', () => {
        let parent = new Attachable().attachToRoot();

        let sequence = Sequence.create(resolve => resolve())
          .take(2)
          .attach(parent);

        expect(sequence.destroyed).toBeFalsy();
        parent.destroy();
        expect(sequence.destroyed).toBeTruthy();
      });

      test('completing takes should destroy the sequence', () => {
        let resolve!: () => void;
        let sequence = Sequence.create(r => {
          resolve = r;
        })
          .take(1)
          .attachToRoot();

        expect(sequence.destroyed).toBeFalsy();
        resolve();
        expect(sequence.destroyed).toBeTruthy();
      });

      test('take should destroy the sequence after all ongoing operations completed and cancel all packages coming behind', () => {
        let action1 = new Action<string>();
        let action2 = new Action<string>();
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
              } else {
                action2.subscribe(actionValue => resolve(data + actionValue)).attach(context.attachable);
              }
            })
          )
          .take(1)
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
        expect(action2.listenerCount).toEqual(1);
        expect(actionlast.listenerCount).toEqual(0);

        action1.trigger('-a1');
        expect(heap).toEqual([]);
        expect(sequence.destroyed).toBeFalsy();
        expect(action1.listenerCount).toEqual(0);
        expect(action2.listenerCount).toEqual(0);
        expect(actionlast.listenerCount).toEqual(1);

        actionlast.trigger('-al');
        expect(heap).toEqual(['1-a1-al']);
        expect(sequence.destroyed).toBeTruthy();
        expect(action1.listenerCount).toEqual(0);
        expect(action2.listenerCount).toEqual(0);
        expect(actionlast.listenerCount).toEqual(0);
      });
    });
  });

  describe('Skip', () => {
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

  describe('Wait', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    describe('Behavior', () => {
      test('basic wait with single value', async () => {
        let heap: string[] = [];

        Sequence.create<string>(resolve => resolve('a'))
          .wait(100)
          .read(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([]);

        vi.advanceTimersByTime(100);
        expect(heap).toEqual(['a']);
      });

      test('wait with multiple sync values', async () => {
        let heap: string[] = [];

        Sequence.create<string>(resolve => {
          resolve('a');
          resolve('b');
          resolve('c');
        })
          .wait(50)
          .read(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([]);

        vi.advanceTimersByTime(50);
        expect(heap).toEqual(['a', 'b', 'c']);
      });

      test('wait preserves data', async () => {
        let heap: unknown[] = [];

        Sequence.create<unknown>(resolve => {
          resolve('string');
          resolve(123);
          resolve({ key: 'value' });
          resolve([1, 2, 3]);
        })
          .wait(10)
          .read(data => heap.push(data))
          .attachToRoot();

        vi.advanceTimersByTime(40);
        expect(heap).toEqual(['string', 123, { key: 'value' }, [1, 2, 3]]);
      });

      test('wait with mixed sync and async triggers', async () => {
        let heap: string[] = [];

        let resolve!: (data: string) => void;
        Sequence.create<string>(r => {
          resolve = r;
          resolve('a');
          resolve('b');
        })
          .wait(30)
          .read(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([]);

        resolve('x');
        UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

        await vi.advanceTimersByTimeAsync(150);
        await UnitTestHelper.waitForAllOperations();
        expect(heap).toEqual(['a', 'b', 'x', 'k', 't']);
      });

      test('wait maintains execution order', async () => {
        let heap: string[] = [];
        let resolve!: (data: string) => void;

        Sequence.create<string>(r => {
          resolve = r;
          resolve('1');
          resolve('2');
        })
          .wait(50)
          .read(data => heap.push(data))
          .attachToRoot();

        setTimeout(() => resolve('3'), 10);
        setTimeout(() => resolve('4'), 20);

        vi.advanceTimersByTime(70);
        await UnitTestHelper.waitForAllOperations();
        expect(heap).toEqual(['1', '2', '3', '4']);
      });

      test('chained waits accumulate delays', async () => {
        let heap: string[] = [];

        Sequence.create<string>(resolve => resolve('a'))
          .wait(50)
          .wait(50)
          .read(data => heap.push(data))
          .attachToRoot();

        vi.advanceTimersByTime(99);
        expect(heap).toEqual([]);

        vi.advanceTimersByTime(1);
        expect(heap).toEqual(['a']);
      });

      test('wait after map operation', async () => {
        let heap: string[] = [];

        Sequence.create<number>(resolve => {
          resolve(1);
          resolve(2);
          resolve(3);
        })
          .map(value => value * 2)
          .wait(30)
          .read(data => heap.push(data.toString()))
          .attachToRoot();

        expect(heap).toEqual([]);

        vi.advanceTimersByTime(90);
        expect(heap).toEqual(['2', '4', '6']);
      });

      test('map after wait operation', async () => {
        let heap: string[] = [];

        Sequence.create<number>(resolve => {
          resolve(1);
          resolve(2);
          resolve(3);
        })
          .wait(20)
          .map(value => value * 3)
          .read(data => heap.push(data.toString()))
          .attachToRoot();

        vi.advanceTimersByTime(60);
        expect(heap).toEqual(['3', '6', '9']);
      });

      test('wait with no duration', async () => {
        let heap: string[] = [];

        Sequence.create<string>(resolve => {
          resolve('a');
          resolve('b');
        })
          .wait()
          .read(data => heap.push(data))
          .attachToRoot();

        vi.advanceTimersByTime(0);
        await UnitTestHelper.waitForAllOperations();
        expect(heap).toEqual(['a', 'b']);
      });
    });

    describe('Cleanup', () => {
      test('destroying sequence cancels pending waits', async () => {
        let heap: string[] = [];
        let readExecuted = false;

        let sequence = Sequence.create<string>(resolve => {
          resolve('a');
          resolve('b');
          resolve('c');
        })
          .wait(100)
          .read(data => {
            readExecuted = true;
            heap.push(data);
          })
          .attachToRoot();

        expect(heap).toEqual([]);
        expect(readExecuted).toBe(false);

        sequence.destroy();
        vi.advanceTimersByTime(100);

        expect(heap).toEqual([]);
        expect(readExecuted).toBe(false);
      });

      test('destroying parent attachable cancels pending waits', async () => {
        let heap: string[] = [];
        let attachable = new Attachable();

        Sequence.create<string>(resolve => {
          resolve('a');
          resolve('b');
        })
          .wait(100)
          .read(data => heap.push(data))
          .attach(attachable);

        expect(heap).toEqual([]);

        attachable.destroy();
        vi.advanceTimersByTime(100);

        expect(heap).toEqual([]);
      });
    });

    describe('Finalization', () => {
      test('finalization after at creator', async () => {
        let heap: string[] = [];

        Sequence.create<string>((resolve, context) => {
          resolve('a');
          resolve('b');
          context.final();
          resolve('c');
          resolve('d');
        })
          .wait(50)
          .read(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([]);

        vi.advanceTimersByTime(50);
        expect(heap).toEqual(['a', 'b']);
      });

      test('finalization after wait when all packages passing together', async () => {
        let heap: string[] = [];

        let sequence = Sequence.create<string>((resolve, context) => {
          resolve('a');
          resolve('b');
          resolve('c');
          context.final();
        })
          .wait(50)
          .read((data, context) => {
            if (data === 'b') {
              context.final();
            }
            heap.push(data);
          })
          .attachToRoot();

        expect(sequence.destroyed).toBe(false);

        vi.advanceTimersByTime(50);
        expect(heap).toEqual(['a', 'b']);
        expect(sequence.destroyed).toBe(true);
      });

      test('finalization after wait when all packages passing seperately', async () => {
        let heap: string[] = [];

        let resolve!: (data: string) => void;
        let sequence = Sequence.create<string>((r, context) => {
          resolve = r;
          resolve('a');
        })
          .wait(50)
          .read((data, context) => {
            if (data === 'b') {
              context.final();
            }
            heap.push(data);
          })
          .attachToRoot();

        expect(sequence.destroyed).toBe(false);

        UnitTestHelper.callEachDelayed(['b', 'c'], resolve);

        await vi.advanceTimersByTimeAsync(60);
        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual(['a', 'b']);
        expect(sequence.destroyed).toBe(true);
      });
    });
  });

  describe('Merge', () => {
    describe('Behavior', () => {
      test('simple merge', async () => {
        let heap: string[] = [];

        Sequence.merge(
          Sequence.create<string>(resolve => resolve('a')),
          Sequence.create<string>(resolve => resolve('b')),
          Sequence.create<string>(resolve => resolve('c'))
        )
          .read(data => heap.push(data))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual(['a', 'b', 'c']);
      });

      test('merging instantly resolved sequences', async () => {
        let heap: string[] = [];

        let s1 = Sequence.create<string>(resolve => resolve('a')).take(1);
        let s2 = Sequence.create<string>(resolve => resolve('b')).take(1);

        let merged = Sequence.merge(s1, s2);
        let read = merged.read(data => heap.push(data)).attachToRoot();

        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual(['a', 'b']);
        expect(s1.destroyed).toBeTruthy();
        expect(s2.destroyed).toBeTruthy();
        expect(merged.destroyed).toBeTruthy();
        expect(read.destroyed).toBeTruthy();
      });

      test('instantly resolved and finalized sequences', async () => {
        let heap: string[] = [];

        Sequence.merge(
          Sequence.create<string>((resolve, context) => {
            resolve('a');
            context.final();
          }),
          Sequence.create<string>((resolve, context) => {
            resolve('b');
            context.final();
          }),
          Sequence.create<string>((resolve, context) => {
            resolve('c');
            context.final();
          })
        )
          .read(data => heap.push(data))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual(['a', 'b', 'c']);
      });

      test('using action directly', () => {
        let action1 = new Action<string>();
        let action2 = new Action<string>();

        let heap: string[] = [];
        Sequence.merge(action1, action2)
          .read(value => heap.push(value))
          .attachToRoot();

        action1.trigger('a');
        action2.trigger('b');
        expect(heap).toEqual(['a', 'b']);
      });

      test('merge with delayed sequences', async () => {
        let heap: string[] = [];
        Sequence.merge(
          Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed(['1', '2'], resolve)),
          Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed(['a', 'b'], resolve)),
          Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed(['x', 'y'], resolve))
        )
          .read(data => heap.push(data))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();
        expect(heap).toEqual(['1', 'a', 'x', '2', 'b', 'y']);
      });
    });

    describe('Desctruction', () => {
      test('merge destroy -> children destroy', async () => {
        let sequence1 = Sequence.create(() => {});
        let sequence2 = Sequence.create(() => {});
        let merged = Sequence.merge(sequence1, sequence2).attachToRoot();

        expect(sequence1.destroyed).toBeFalsy();
        expect(sequence2.destroyed).toBeFalsy();
        expect(sequence1['_executor']['_onDestroyListeners'].size).toEqual(1);
        expect(sequence2['_executor']['_onDestroyListeners'].size).toEqual(1);
        merged.destroy();
        expect(sequence1.destroyed).toBeTruthy();
        expect(sequence2.destroyed).toBeTruthy();
        expect(sequence1['_executor']['_onDestroyListeners'].size).toEqual(0);
        expect(sequence2['_executor']['_onDestroyListeners'].size).toEqual(0);
      });

      test('children destroy -> merge destroy', async () => {
        let sequence1 = Sequence.create(() => {});
        let sequence2 = Sequence.create(() => {});
        let merged = Sequence.merge(sequence1, sequence2).attachToRoot();

        expect(merged.destroyed).toBeFalsy();
        sequence1.destroy();
        expect(merged.destroyed).toBeFalsy();
        sequence2.destroy();
        expect(merged.destroyed).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      test('merged sequences should not need to be attached manually', () => {
        vi.useFakeTimers();
        expect(() => {
          let sequence1 = Sequence.create(() => {});
          let sequence = Sequence.create(() => {});
          Sequence.merge(sequence1, sequence).attachToRoot();

          vi.runAllTimers();
        }).not.toThrow('Attachable: The object is not attached to anything!');
      });

      test('merging same sequence should throw error', () => {
        let sequence = Sequence.create(() => {});
        expect(() => Sequence.merge(sequence, sequence).attachToRoot()).toThrow(
          'Each given sequence to merge or combine has to be diferent.'
        );
      });

      test('merging same notifier should throw error', () => {
        let action = new Action<string>();
        expect(() => Sequence.merge(action, action).attachToRoot()).toThrow(
          'Each given sequence to merge or combine has to be diferent.'
        );
      });

      test('merging a finalized sequence which had a delayed map link was throwing error', async () => {
        let sequence = Sequence.create((resolve, context) => {
          resolve();
          context.final();
        })
          .asyncMapOrdered(() =>
            Sequence.create(resolve => {
              UnitTestHelper.callEachDelayed([1], () => resolve());
            })
          )
          .read(() => {});

        let heap: unknown[] = [];
        Sequence.merge(sequence)
          .read(value => heap.push(value))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();
      });
    });
  });

  describe('Combine', () => {
    describe('Behavior', () => {
      describe('Object Input', () => {
        test('simple combine', () => {
          let sequence1 = Sequence.create<string>(resolve => resolve('a'));
          let sequence2 = Sequence.create<number>(resolve => resolve(1));

          let heap: { a: string; b: number }[] = [];
          Sequence.combine({ a: sequence1, b: sequence2 })
            .read(data => heap.push(data))
            .attachToRoot();

          expect(heap).toEqual([{ a: 'a', b: 1 }]);
        });

        test('instantly finalizing sequences', () => {
          let sequence1 = Sequence.create<string>((resolve, context) => {
            resolve('a');
            context.final();
          });
          let sequence2 = Sequence.create<number>((resolve, context) => {
            resolve(1);
            context.final();
          });

          let heap: { a: string; b: number }[] = [];
          Sequence.combine({ a: sequence1, b: sequence2 })
            .read(data => heap.push(data))
            .attachToRoot();

          expect(heap).toEqual([{ a: 'a', b: 1 }]);
        });

        test('using action directly', () => {
          let action1 = new Action<string>();
          let action2 = new Action<number>();

          let heap: { a: string; b: number }[] = [];
          Sequence.combine({ a: action1, b: action2 })
            .read(value => heap.push(value))
            .attachToRoot();

          action1.trigger('a');
          action2.trigger(1);
          expect(heap).toEqual([{ a: 'a', b: 1 }]);
        });

        test('combine instantly getting resolved sequences', async () => {
          let heap: { a: string; b: number }[] = [];

          let s1 = Sequence.create<string>(resolve => resolve('a')).take(1);
          let s2 = Sequence.create<number>(resolve => resolve(1)).take(1);

          let combined = Sequence.combine({ a: s1, b: s2 })
            .read(data => heap.push(data))
            .attachToRoot();

          await UnitTestHelper.waitForAllOperations();

          expect(heap).toEqual([{ a: 'a', b: 1 }]);
          expect(s1.destroyed).toBeTruthy();
          expect(s2.destroyed).toBeTruthy();
          expect(combined.destroyed).toBeTruthy();
        });

        test('combine with delayed sequences', async () => {
          let heap: { a: string; b: number }[] = [];
          Sequence.combine({
            a: Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed(['a', 'b'], resolve)),
            b: Sequence.create<number>(resolve => UnitTestHelper.callEachDelayed([1, 2], resolve))
          })
            .read(data => heap.push(data))
            .attachToRoot();

          await UnitTestHelper.waitForAllOperations();
          expect(heap).toEqual([
            { a: 'a', b: 1 },
            { a: 'b', b: 1 },
            { a: 'b', b: 2 }
          ]);
        });
      });

      describe('Array Input', () => {
        test('simple combine', () => {
          let sequence1 = Sequence.create<string>(resolve => resolve('a'));
          let sequence2 = Sequence.create<number>(resolve => resolve(1));

          let heap: unknown[] = [];
          Sequence.combine([sequence1, sequence2])
            .read(data => heap.push(data))
            .attachToRoot();

          expect(heap).toEqual([['a', 1]]);
        });

        test('instantly finalizing sequences', () => {
          let sequence1 = Sequence.create<string>((resolve, context) => {
            resolve('a');
            context.final();
          });
          let sequence2 = Sequence.create<number>((resolve, context) => {
            resolve(1);
            context.final();
          });

          let heap: unknown[] = [];
          Sequence.combine([sequence1, sequence2])
            .read(data => heap.push(data))
            .attachToRoot();

          expect(heap).toEqual([['a', 1]]);
        });

        test('using action directly', () => {
          let action1 = new Action<string>();
          let action2 = new Action<number>();

          let heap: unknown[] = [];
          Sequence.combine([action1, action2])
            .read(value => heap.push(value))
            .attachToRoot();

          action1.trigger('a');
          action2.trigger(1);
          expect(heap).toEqual([['a', 1]]);
        });

        test('combine instantly getting destroyed sequences', async () => {
          let heap: unknown[] = [];

          let s1 = Sequence.create<string>(resolve => resolve('a')).take(1);
          let s2 = Sequence.create<number>(resolve => resolve(1)).take(1);

          let combined = Sequence.combine([s1, s2])
            .read(data => heap.push(data))
            .attachToRoot();

          await UnitTestHelper.waitForAllOperations();

          expect(heap).toEqual([['a', 1]]);
          expect(s1.destroyed).toBeTruthy();
          expect(s2.destroyed).toBeTruthy();
          expect(combined.destroyed).toBeTruthy();
        });

        test('combine with delayed sequences', async () => {
          let heap: unknown[] = [];
          Sequence.combine([
            Sequence.create<string>(resolve => UnitTestHelper.callEachDelayed(['a', 'b'], resolve)),
            Sequence.create<number>(resolve => UnitTestHelper.callEachDelayed([1, 2], resolve))
          ])
            .read(data => heap.push(data))
            .attachToRoot();

          await UnitTestHelper.waitForAllOperations();
          expect(heap).toEqual([
            ['a', 1],
            ['b', 1],
            ['b', 2]
          ]);
        });
      });
    });

    describe('Desctruction', () => {
      test('merge destroy -> children destroy', async () => {
        let sequence1 = Sequence.create<string>(() => {});
        let sequence = Sequence.create<string>(() => {});
        let combined = Sequence.combine({ a: sequence1, b: sequence }).attachToRoot();

        expect(sequence1.destroyed).toBeFalsy();
        expect(sequence.destroyed).toBeFalsy();
        combined.destroy();
        expect(sequence1.destroyed).toBeTruthy();
        expect(sequence.destroyed).toBeTruthy();
      });

      test('children destroy -> merge destroy', async () => {
        let sequence1 = Sequence.create<string>(() => {});
        let sequence = Sequence.create<string>(() => {});
        let combined = Sequence.combine({ a: sequence1, b: sequence }).attachToRoot();

        expect(combined.destroyed).toBeFalsy();
        sequence1.destroy();
        expect(combined.destroyed).toBeFalsy();
        sequence.destroy();
        expect(combined.destroyed).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      test('combined sequences should not need to be attached manually', () => {
        vi.useFakeTimers();
        expect(() => {
          let sequence1 = Sequence.create<string>(() => {});
          let sequence = Sequence.create<string>(() => {});
          Sequence.combine({ a: sequence1, b: sequence }).attachToRoot();

          vi.runAllTimers();
        }).not.toThrow('Attachable: The object is not attached to anything!');
      });

      test('combining same sequence should throw error', () => {
        let sequence = Sequence.create(() => {});
        expect(() => Sequence.combine({ a: sequence, b: sequence }).attachToRoot()).toThrow(
          'Each given sequence to merge or combine has to be diferent.'
        );
      });

      test('combining same notifier should throw error', () => {
        let action = new Action<string>();
        expect(() => Sequence.combine({ a: action, b: action }).attachToRoot()).toThrow(
          'Each given sequence to merge or combine has to be diferent.'
        );
      });

      test('combining a finalized sequence which had a delayed map link was throwing error', async () => {
        let sequence = Sequence.create((resolve, context) => {
          resolve();
          context.final();
        })
          .asyncMapOrdered(() =>
            Sequence.create(resolve => {
              UnitTestHelper.callEachDelayed([1], () => resolve());
            })
          )
          .read(() => {});

        let heap: unknown[] = [];
        Sequence.combine({
          s: sequence
        })
          .read(value => heap.push(value))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();
      });
    });
  });

  describe('Combinations', () => {
    test('sequence and action', async () => {
      let action = new Action<string>();

      let heap: string[] = [];
      action
        .orderedMap(data =>
          Sequence.create<string>(resolve => {
            UnitTestHelper.callEachDelayed(['a', 'b', 'c'], value => resolve(data + value));
          })
        )
        .read(data => {
          heap.push(data);
        })
        .attachToRoot();

      UnitTestHelper.callEachDelayed(['1', '2', '3'], value => {
        action.trigger(value);
      });

      await UnitTestHelper.waitForAllOperations();
      expect(heap).toEqual(['1a', '2a', '3a']);
    });

    test('wait until any of it completed', () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();

      let heap: string[] = [];
      let sequence = Sequence.merge(action1, action2)
        .take(1)
        .read(data => heap.push(data))
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
        .read(() => callCount++)
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
        .read(value => heap.push(value))
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
        UnitTestHelper.callEachDelayed(
          [10, 11],
          delayedValue => resolve(delayedValue),
          () => context.final()
        );
      }).asyncMapOrdered(value =>
        Sequence.create<string>((resolve, context) =>
          UnitTestHelper.callEachDelayed(
            [value + 's1'],
            delayedValue => resolve(delayedValue),
            () => context.final()
          )
        )
      );

      let sequence2 = Sequence.create<number>((resolve, context) => {
        UnitTestHelper.callEachDelayed(
          [20, 21],
          delayedValue => resolve(delayedValue),
          () => context.final()
        );
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
          UnitTestHelper.callEachDelayed(
            [value + 's4'],
            delayedValue => resolve(delayedValue),
            () => context.final()
          );
        })
      );

      let heap: unknown[] = [];
      Sequence.combine({
        m: merged,
        s3: sequence3,
        s4: sequence4
      })
        .read(value => heap.push(value))
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
        .read(value => heap.push(value))
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
