import { UnitTestHelper, Wait } from 'helpers-lib';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../../../attachable/attachable';
import { IDAttachable } from '../../../attachable/id-attachable';
import { Action } from '../../../observables/action/action';
import { Variable } from '../../../observables/variable/variable';
import { ActionLib } from '../../../utilities/action-lib';
import { Sequence } from '../../sequence/sequence';
import { SingleEvent } from '../single-event';

describe('SingleEvent', () => {
  beforeEach(() => {
    ActionLib.hardReset();
    UnitTestHelper.reset();
  });

  describe('Setup', () => {
    test('plain single event no trigger', () => {
      expect(SingleEvent.create<string>(() => {}).attachToRoot()).toBeDefined();
    });

    test('plain single event sync trigger', () => {
      expect(SingleEvent.create<string>(resolve => resolve('a')).attachToRoot()).toBeDefined();
    });

    test('plain single event async trigger', () => {
      expect(
        SingleEvent.create<string>(resolve => UnitTestHelper.callEachDelayed(['1'], value => resolve(value))).attachToRoot()
      ).toBeDefined();
    });

    test('attach cannot be called before the end of the chain', () => {
      let singleEvent = SingleEvent.create<string>(() => {});
      singleEvent.tap(() => {}).attachToRoot();
      expect(() => singleEvent.tap(() => {})).toThrow('Single Event: A single event can only be linked once.');
    });
  });

  describe('Instant', () => {
    test('setup', () => {
      expect(SingleEvent.instant().attachToRoot()).toBeDefined();
      expect(SingleEvent.instant<string>('a').attachToRoot()).toBeDefined();
    });

    test('without data', () => {
      let heap: unknown[] = [];

      SingleEvent.instant()
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([undefined]);
    });

    test('with data', () => {
      let heap: string[] = [];

      SingleEvent.instant<string>('a')
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a']);
    });
  });

  describe('Chain', () => {
    describe('to root', () => {
      test('without doing further operations without resolve', async () => {
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
        let chain = firstEvent.chainToRoot();

        await Wait();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();

        operation.trigger();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('without doing further operations with resolve', async () => {
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
        let chain = firstEvent.chainToRoot();

        operation.trigger();
        await Wait();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('using chain', async () => {
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
        let chain = firstEvent.chainToRoot();

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
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeTruthy();
      });

      test('chain parent destroy before trigger', async () => {
        let chainParent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
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
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();
      });

      test('multiple chain', async () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action<number>();

        let heap: unknown[] = [];

        let firstEvent = operation.toSingleEvent();
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
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain1.destroyed).toBeTruthy();
        expect(chain1.attachIsCalled).toBeTruthy();
        expect(chain2.destroyed).toBeTruthy();
        expect(chain2.attachIsCalled).toBeTruthy();
        expect(final.destroyed).toBeTruthy();
        expect(final.attachIsCalled).toBeTruthy();
        expect(heap).toEqual([1, 1]);

        operation.trigger(2);
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain1.destroyed).toBeTruthy();
        expect(chain1.attachIsCalled).toBeTruthy();
        expect(chain2.destroyed).toBeTruthy();
        expect(chain2.attachIsCalled).toBeTruthy();
        expect(final.destroyed).toBeTruthy();
        expect(final.attachIsCalled).toBeTruthy();
        expect(heap).toEqual([1, 1]);
      });
    });

    describe('directly', () => {
      test('without doing further operations without resolve', async () => {
        let parent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
        let chain = firstEvent.chain(parent);

        await Wait();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();

        operation.trigger();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('without doing further operations with resolve', async () => {
        let parent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
        let chain = firstEvent.chain(parent);

        operation.trigger();
        await Wait();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('using chain', async () => {
        let parent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
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
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeTruthy();
      });

      test('chain parent destroy before trigger', async () => {
        let parent = new Attachable().attachToRoot();
        let chainParent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
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
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();
      });

      test('operation attached parent destroy', async () => {
        let parent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
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

        parent.destroy();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();
      });

      test('multiple chain', async () => {
        let parent = new Attachable().attachToRoot();
        let operation = new Action();

        let triggerCount1 = 0;
        let triggerCount2 = 0;

        let firstEvent = operation.toSingleEvent();
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
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain1.destroyed).toBeTruthy();
        expect(chain1.attachIsCalled).toBeTruthy();
        expect(chain2.destroyed).toBeTruthy();
        expect(chain2.attachIsCalled).toBeTruthy();
        expect(triggerCount1).toEqual(1);
        expect(triggerCount2).toEqual(1);

        operation.trigger();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain1.destroyed).toBeTruthy();
        expect(chain1.attachIsCalled).toBeTruthy();
        expect(chain2.destroyed).toBeTruthy();
        expect(chain2.attachIsCalled).toBeTruthy();
        expect(triggerCount1).toEqual(1);
        expect(triggerCount2).toEqual(1);
      });
    });

    describe('by id', async () => {
      test('without doing further operations without resolve', async () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
        let chain = firstEvent.chainByID(parent.id);

        await Wait();
        expect(firstEvent.destroyed).toBeFalsy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();

        operation.trigger();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('without doing further operations with resolve', async () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
        let chain = firstEvent.chainByID(parent.id);

        operation.trigger();
        await Wait();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('using chain', async () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
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
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeTruthy();
      });

      test('chain parent destroy before trigger', async () => {
        let parent = new IDAttachable().attachToRoot();
        let chainParent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
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
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();
      });

      test('operation attached parent destroy', async () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
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

        parent.destroy();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();
      });

      test('multiple chain', async () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let triggerCount1 = 0;
        let triggerCount2 = 0;

        let firstEvent = operation.toSingleEvent();
        let chain1 = firstEvent.chainByID(parent.id);
        let chain2 = chain1
          .tap(() => {
            triggerCount1++;
          })
          .chainByID(parent.id);

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
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain1.destroyed).toBeTruthy();
        expect(chain1.attachIsCalled).toBeTruthy();
        expect(chain2.destroyed).toBeTruthy();
        expect(chain2.attachIsCalled).toBeTruthy();
        expect(triggerCount1).toEqual(1);
        expect(triggerCount2).toEqual(1);

        operation.trigger();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain1.destroyed).toBeTruthy();
        expect(chain1.attachIsCalled).toBeTruthy();
        expect(chain2.destroyed).toBeTruthy();
        expect(chain2.attachIsCalled).toBeTruthy();
        expect(triggerCount1).toEqual(1);
        expect(triggerCount2).toEqual(1);
      });
    });
  });

  describe('Destruction', () => {
    test('Should not be destroyed after attach if it is not resolved', () => {
      let singleEvent = SingleEvent.create<string>(() => {}).attachToRoot();

      expect(singleEvent.destroyed).toBeFalsy();
    });

    test('destroying single event directly', () => {
      let singleEvent = SingleEvent.create<void>(() => {})
        .tap(() => {})
        .attachToRoot();

      expect(singleEvent.destroyed).toBeFalsy();
      singleEvent.destroy();
      expect(singleEvent.destroyed).toBeTruthy();
      expect(singleEvent['_executor']['_pipeline']).toEqual(undefined);
    });

    test('destroying single event via constructor context', () => {
      let sequence = SingleEvent.create<void>((resolve, context) => {
        resolve();
        context.destroy();
      }).attachToRoot();

      expect(sequence.destroyed).toBeTruthy();
      expect(sequence['_executor']['_pipeline']).toEqual(undefined);
    });

    test('destroying single event via iterator context', () => {
      let sequence = SingleEvent.create<void>(resolve => {
        resolve();
      })
        .tap((_, context) => {
          context.destroy();
        })
        .attachToRoot();

      expect(sequence.destroyed).toBeTruthy();
      expect(sequence['_executor']['_pipeline']).toEqual(undefined);
    });

    test('destroying parent should destroy single event', () => {
      let parent = new Attachable().attachToRoot();

      let singleEvent = SingleEvent.create<void>(() => {})
        .tap(() => {})
        .attach(parent);

      expect(singleEvent.destroyed).toBeFalsy();
      parent.destroy();
      expect(singleEvent.destroyed).toBeTruthy();
    });

    test('destroy single event callback', () => {
      let triggered = false;
      let singleEvent = SingleEvent.create<void>(() => {
        return () => {
          triggered = true;
        };
      })
        .tap(() => {})
        .attachToRoot();

      expect(triggered).toBeFalsy();
      singleEvent.destroy();
      expect(triggered).toBeTruthy();
    });

    test('resolve after destruction should not throw error', () => {
      let resolve!: (data: string) => void;
      let singleEvent = SingleEvent.create<string>(r => {
        resolve = r;
      }).attachToRoot();

      singleEvent.destroy();
      expect(() => resolve('test')).not.toThrow();
    });

    test('after attaching a resolved event should destroy by itself', () => {
      let singleEvent = SingleEvent.create<void>(resolve => resolve())
        .tap(() => {})
        .attach(new Attachable().attachToRoot());

      expect(singleEvent.destroyed).toBeTruthy();
    });

    test('after attaching a resolved event should destroy by itself', () => {
      let resolve!: () => void;
      let singleEvent = SingleEvent.create<void>(r => {
        resolve = r;
      })
        .tap(() => {})
        .attach(new Attachable().attachToRoot());

      expect(singleEvent.destroyed).toBeFalsy();
      resolve();

      expect(singleEvent.destroyed).toBeTruthy();
    });
  });

  describe('Attachment Errors', () => {
    test('not attaching to anything should destroy the sequence', async () => {
      let sequence = SingleEvent.create(resolve => resolve());
      await Wait();

      expect(sequence.destroyed).toBeTruthy();
    });

    test('not attaching the chain to a target should throw error', async () => {
      let errorCapturer = UnitTestHelper.captureErrors();

      SingleEvent.create<void>(resolve => resolve())
        .tap(() => {})
        .tap(() => {});

      await Wait();
      expect(() => errorCapturer.throwErrors()).toThrow('Attachable: The object is not attached to anything!');
      errorCapturer.destroy();
    });

    test('attaching to a target should not throw error', () => {
      expect(async () => {
        SingleEvent.create<void>(resolve => resolve())
          .tap(() => {})
          .attach(new Attachable().attachToRoot());

        await Wait();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('attaching to root should not throw error', () => {
      expect(async () => {
        SingleEvent.create<void>(resolve => resolve())
          .tap(() => {})
          .attachToRoot();

        await Wait();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('attaching the chain to a target should not throw error', () => {
      expect(async () => {
        SingleEvent.create<void>(resolve => resolve())
          .tap(() => {})
          .tap(() => {})
          .attach(new Attachable().attachToRoot());

        await Wait();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('attaching the chain to root should not throw error', () => {
      expect(async () => {
        SingleEvent.create<void>(resolve => resolve())
          .tap(() => {})
          .tap(() => {})
          .attachToRoot();

        await Wait();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });
  });

  describe('Error Handling', () => {
    test('error in read callback should not break chain', () => {
      let heap: string[] = [];
      let consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      SingleEvent.create<string>(resolve => resolve('a'))
        .tap(() => {
          throw new Error('Test error');
        })
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    test('error in map callback should not break chain', () => {
      let heap: string[] = [];
      let consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      SingleEvent.create<string>(resolve => resolve('a'))
        .map(() => {
          throw new Error('Test error');
        })
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    test('error in asyncMap callback should not break chain', () => {
      let heap: unknown[] = [];
      let consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      SingleEvent.create<string>(resolve => resolve('a'))
        .asyncMap(() => {
          throw new Error('Test error');
        })
        .tap(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    test('error in create executor should not throw', () => {
      let consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        SingleEvent.create<string>(() => {
          throw new Error('Test error');
        }).attachToRoot();
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    test('Each single event can be linkable once', () => {
      expect(() => {
        let singleEvent = SingleEvent.create<string>(resolve => resolve('a'));
        singleEvent.tap(() => {}).attachToRoot();
        singleEvent.tap(() => {});
      }).toThrow('Single Event: A single event can only be linked once.');
    });
    test('attachments on the context attachable should be destroyed right after the iteration step', async () => {
      let variable = new Variable<number>(1);
      let action = new Action<void>();
      let triggered = false;

      let singleEvent = SingleEvent.create<void>(resolve => resolve())
        .asyncMap((_, context) =>
          SingleEvent.create(r => {
            variable
              .subscribe(() => {
                triggered = true;
                r();
              })
              .attach(context.attachable);
          })
        )
        .asyncMap(() => action)
        .attachToRoot();

      expect(singleEvent.destroyed).toBeFalsy();
      expect(variable.listenerCount).toEqual(0);
      expect(action.listenerCount).toEqual(1);
      expect(triggered).toBeTruthy();

      singleEvent.destroy();

      expect(singleEvent.destroyed).toBeTruthy();
      expect(variable.listenerCount).toEqual(0);
      expect(action.listenerCount).toEqual(0);
    });

    test('destroying subscriptions via attachment, instantly finalizing sequence, in map', () => {
      let variable = new Variable<number>(1);
      let triggered = false;

      let sequence = SingleEvent.create<void>(resolve => {
        resolve();
      })
        .map((_, context) => {
          variable
            .subscribe(() => {
              triggered = true;
            })
            .attach(context.attachable);
          expect(variable.listenerCount).toEqual(1);
        })
        .attachToRoot();

      expect(sequence.destroyed).toBeTruthy();
      expect(variable.listenerCount).toEqual(0);
      expect(triggered).toBeTruthy();
    });

    test('destroying subscriptions via attachment, instantly finalizing sequence, in returned single event', () => {
      let variable = new Variable<number>(1);
      let triggered = false;

      let sequence = SingleEvent.create<void>(resolve => {
        resolve();
      })
        .asyncMap((_, context) => {
          return SingleEvent.create(resolve => {
            variable
              .subscribe(() => {
                triggered = true;
                resolve();
              })
              .attach(context.attachable);
          });
        })
        .attachToRoot();

      expect(sequence.destroyed).toBeTruthy();
      expect(variable.listenerCount).toEqual(0);
      expect(triggered).toBeTruthy();
    });

    test('destroying via context attachable during async operation', async () => {
      let variable = new Variable<number>(1);
      let triggered = false;

      let singleEvent = SingleEvent.create<void>(resolve => {
        UnitTestHelper.callEachDelayed([undefined], () => resolve());
      })
        .asyncMap((_, context) =>
          SingleEvent.create(r => {
            variable
              .subscribe(() => {
                triggered = true;
                r();
              })
              .attach(context.attachable);
          })
        )
        .attachToRoot();

      expect(singleEvent.destroyed).toBeFalsy();
      expect(variable.listenerCount).toEqual(0);
      expect(triggered).toBeFalsy();

      await UnitTestHelper.waitForAllOperations();

      expect(singleEvent.destroyed).toBeTruthy();
      expect(variable.listenerCount).toEqual(0);
      expect(triggered).toBeTruthy();
    });

    test('using attached event after timeout', async () => {
      let event = SingleEvent.create<void>(resolve => resolve()).attachToRoot();

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
      }).rejects.toThrow('Single Event: After attaching, you cannot add another operation.');
    });
  });
});
