import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../../../attachable/attachable';
import { IDAttachable } from '../../../attachable/id-attachable';
import { ActionLibHardReset } from '../../../helpers/hard-reset';
import { Action } from '../../../observables/action/action';
import { SingleEvent } from '../single-event';

describe('SingleEvent', () => {
  beforeEach(() => {
    ActionLibHardReset.hardReset();
    UnitTestHelper.reset();
  });

  describe('Setup', () => {
    test('plain single event no trigger', () => {
      expect(SingleEvent.create<string>(() => {}).attachToRoot()).toBeDefined();
    });

    test('plain single event sync trigger', () => {
      expect(SingleEvent.create<string>(resolve => resolve('a')).attachToRoot()).toBeDefined();
    });

    test('multiple resolve should throw error', () => {
      let resolve!: () => void;
      SingleEvent.create<void>(r => {
        resolve = r;
      }).attachToRoot();

      expect(() => resolve()).not.toThrow('Single Event: It can only resolve once.');
      expect(() => resolve()).toThrow('Single Event: It can only resolve once.');
    });

    test('plain single event async trigger', () => {
      expect(
        SingleEvent.create<string>(resolve => UnitTestHelper.callEachDelayed(['1'], value => resolve(value))).attachToRoot()
      ).toBeDefined();
    });

    test('attach cannot be called before the end of the chain', () => {
      let singleEvent = SingleEvent.create<string>(() => {});
      singleEvent.read(() => {}).attachToRoot();
      expect(() => singleEvent.read(() => {})).toThrow('Single Event: A single event can only be linked once.');
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
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([undefined]);
    });

    test('with data', () => {
      let heap: string[] = [];

      SingleEvent.instant<string>('a')
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual(['a']);
    });
  });

  describe('Chain', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    describe('to root', () => {
      test('without doing further operations without resolve', () => {
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
        let chain = firstEvent.chainToRoot();

        vi.runAllTimers();
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

      test('without doing further operations with resolve', () => {
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
        let chain = firstEvent.chainToRoot();

        operation.trigger();
        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('using chain', () => {
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
        let chain = firstEvent.chainToRoot();

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
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeTruthy();
      });

      test('chain parent destroy before trigger', () => {
        let chainParent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
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
        expect(firstEvent.destroyed).toBeTruthy();
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

        let firstEvent = operation.toSingleEvent();
        let chain = firstEvent.chain(parent);

        vi.runAllTimers();
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

      test('without doing further operations with resolve', () => {
        let parent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
        let chain = firstEvent.chain(parent);

        operation.trigger();
        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('using chain', () => {
        let parent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
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
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeTruthy();
      });

      test('chain parent destroy before trigger', () => {
        let parent = new Attachable().attachToRoot();
        let chainParent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
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
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();
      });

      test('operation attached parent destroy', () => {
        let parent = new Attachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
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

        parent.destroy();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();
      });
    });

    describe('by id', () => {
      test('without doing further operations without resolve', () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
        let chain = firstEvent.chainByID(parent.id);

        vi.runAllTimers();
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

      test('without doing further operations with resolve', () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
        let chain = firstEvent.chainByID(parent.id);

        operation.trigger();
        vi.runAllTimers();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeFalsy();
      });

      test('using chain', () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
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
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeTruthy();
      });

      test('chain parent destroy before trigger', () => {
        let parent = new IDAttachable().attachToRoot();
        let chainParent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
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
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();
      });

      test('operation attached parent destroy', () => {
        let parent = new IDAttachable().attachToRoot();
        let operation = new Action();

        let firstEvent = operation.toSingleEvent();
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

        parent.destroy();
        expect(firstEvent.destroyed).toBeTruthy();
        expect(firstEvent.attachIsCalled).toBeTruthy();
        expect(chain.destroyed).toBeTruthy();
        expect(chain.attachIsCalled).toBeTruthy();
        expect(triggered).toBeFalsy();
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
        .read(() => {})
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
        .read((_, context) => {
          context.destroy();
        })
        .attachToRoot();

      expect(sequence.destroyed).toBeTruthy();
      expect(sequence['_executor']['_pipeline']).toEqual(undefined);
    });

    test('destroying parent should destroy single event', () => {
      let parent = new Attachable().attachToRoot();

      let singleEvent = SingleEvent.create<void>(() => {})
        .read(() => {})
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
        .read(() => {})
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
        .read(() => {})
        .attach(new Attachable().attachToRoot());

      expect(singleEvent.destroyed).toBeTruthy();
    });

    test('after attaching a resolved event should destroy by itself', () => {
      let resolve!: () => void;
      let singleEvent = SingleEvent.create<void>(r => {
        resolve = r;
      })
        .read(() => {})
        .attach(new Attachable().attachToRoot());

      expect(singleEvent.destroyed).toBeFalsy();
      resolve();

      expect(singleEvent.destroyed).toBeTruthy();
    });
  });

  describe('Attachment Errors', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    test('not attaching to anything should destroy the sequence', () => {
      let sequence = SingleEvent.create(resolve => resolve());
      vi.runAllTimers();

      expect(sequence.destroyed).toBeTruthy();
    });

    test('not attaching the chain to a target should throw error', () => {
      expect(() => {
        SingleEvent.create<void>(resolve => resolve())
          .read(() => {})
          .read(() => {});

        vi.runAllTimers();
      }).toThrow('Attachable: The object is not attached to anything!');
    });

    test('attaching to a target should not throw error', () => {
      expect(() => {
        SingleEvent.create<void>(resolve => resolve())
          .read(() => {})
          .attach(new Attachable().attachToRoot());

        vi.runAllTimers();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('attaching to root should not throw error', () => {
      expect(() => {
        SingleEvent.create<void>(resolve => resolve())
          .read(() => {})
          .attachToRoot();

        vi.runAllTimers();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('attaching the chain to a target should not throw error', () => {
      expect(() => {
        SingleEvent.create<void>(resolve => resolve())
          .read(() => {})
          .read(() => {})
          .attach(new Attachable().attachToRoot());

        vi.runAllTimers();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });

    test('attaching the chain to root should not throw error', () => {
      expect(() => {
        SingleEvent.create<void>(resolve => resolve())
          .read(() => {})
          .read(() => {})
          .attachToRoot();

        vi.runAllTimers();
      }).not.toThrow('Attachable: The object is not attached to anything!');
    });
  });

  describe('Error Handling', () => {
    test('error in read callback should not break chain', () => {
      let heap: string[] = [];
      let consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      SingleEvent.create<string>(resolve => resolve('a'))
        .read(() => {
          throw new Error('Test error');
        })
        .read(data => heap.push(data))
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
        .read(data => heap.push(data))
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
        .read(data => heap.push(data))
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
        singleEvent.read(() => {}).attachToRoot();
        singleEvent.read(() => {});
      }).toThrow('Single Event: A single event can only be linked once.');
    });
  });
});
