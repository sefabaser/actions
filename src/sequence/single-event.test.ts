import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { ActionLibHardReset } from '../helpers/hard-reset';
import { Action } from '../observables/action/action';
import { Variable } from '../observables/variable/variable';
import { Sequence } from './sequence';
import { SingleEvent } from './single-event';

describe('SingleEvent', () => {
  let dummySequence = <T>(value: T) => Sequence.create<T>(resolve => resolve(value));
  let dummySingleEvent = <T>(value: T) => SingleEvent.create<T>(resolve => resolve(value));

  beforeEach(() => {
    ActionLibHardReset.hardReset();
    UnitTestHelper.reset();
  });

  describe('Triggers', () => {
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
      expect(singleEvent['executor']['_pipeline']).toEqual(undefined);
    });

    test('destroying single event via constructor context', () => {
      let sequence = SingleEvent.create<void>((resolve, context) => {
        resolve();
        context.destroy();
      }).attachToRoot();

      expect(sequence.destroyed).toBeTruthy();
      expect(sequence['executor']['_pipeline']).toEqual(undefined);
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
      expect(sequence['executor']['_pipeline']).toEqual(undefined);
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

    test('not attaching to anything should throw error', () => {
      expect(() => {
        SingleEvent.create<void>(resolve => resolve());
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

    test('not attaching the chain to a target should throw error', () => {
      expect(() => {
        SingleEvent.create<void>(resolve => resolve())
          .read(() => {})
          .read(() => {});

        vi.runAllTimers();
      }).toThrow('Attachable: The object is not attached to anything!');
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

  describe('Read', () => {
    describe('Triggers', () => {
      test('simple single event sync trigger', () => {
        let heap: string[] = [];

        SingleEvent.create<string>(resolve => resolve('a'))
          .read(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual(['a']);
      });

      test('simple single event async trigger', async () => {
        let heap: string[] = [];

        SingleEvent.create<string>(resolve => {
          UnitTestHelper.callEachDelayed(['a'], data => resolve(data));
        })
          .read(data => heap.push(data))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual(['a']);
      });
    });

    describe('Behavior', () => {
      test('sync read chain', () => {
        let heap: string[] = [];

        SingleEvent.create<void>(resolve => resolve())
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

      test('async read chain', async () => {
        let heap: string[] = [];

        SingleEvent.create<string>(resolve => {
          UnitTestHelper.callEachDelayed(['test'], data => resolve(data));
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

        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual(['1test', '2test', '3test']);
      });

      test('read should not change the data', () => {
        let heap: string[] = [];
        SingleEvent.create<string>(resolve => resolve('a'))
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
        SingleEvent.create<void>(resolve => resolve())
          .read(data => {
            heap.push(data);
          })
          .attachToRoot();

        expect(heap).toEqual([undefined]);
      });

      test('single event should complete after first trigger', async () => {
        let heap: string[] = [];
        let resolve!: (data: string) => void;

        let singleEvent = SingleEvent.create<string>(r => {
          resolve = r;
        })
          .read(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([]);
        expect(singleEvent.destroyed).toBeFalsy();

        resolve('first');
        expect(heap).toEqual(['first']);
        expect(singleEvent.destroyed).toBeTruthy();
      });
    });

    describe('Destruction', () => {
      test('destroying single event', () => {
        let singleEvent = SingleEvent.create<void>(() => {})
          .read(() => {})
          .read(() => {})
          .read(() => {})
          .attachToRoot();

        expect(singleEvent.destroyed).toBeFalsy();
        singleEvent.destroy();
        expect(singleEvent.destroyed).toBeTruthy();
      });

      test('destroying parent should destroy single event', () => {
        let parent = new Attachable().attachToRoot();

        let singleEvent = SingleEvent.create<void>(() => {})
          .read(() => {})
          .read(() => {})
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
          .read(() => {})
          .read(() => {})
          .attachToRoot();

        expect(triggered).toBeFalsy();
        singleEvent.destroy();
        expect(triggered).toBeTruthy();
      });
    });
  });

  describe('Map', () => {
    describe('Triggers', () => {
      test('simple single event sync trigger', () => {
        let heap: string[] = [];

        SingleEvent.create<string>(resolve => resolve('a'))
          .map(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual(['a']);
      });

      test('simple single event async trigger', async () => {
        let heap: string[] = [];

        SingleEvent.create<string>(resolve => {
          UnitTestHelper.callEachDelayed(['a'], data => resolve(data));
        })
          .map(data => heap.push(data))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual(['a']);
      });
    });

    describe('Behavior', () => {
      test('sync data chaining', () => {
        let heap: unknown[] = [];

        SingleEvent.create<string>(resolve => resolve('a'))
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

      test('async data chaining', async () => {
        let heap: unknown[] = [];

        SingleEvent.create<string>(resolve => {
          UnitTestHelper.callEachDelayed(['a'], data => resolve(data));
        })
          .map(data => {
            heap.push(data);
            return 1;
          })
          .map(data => {
            heap.push(data);
            return 'test';
          })
          .map(data => {
            heap.push(data);
          })
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual(['a', 1, 'test']);
      });
    });

    describe('Destruction', () => {
      test('destroying single event', () => {
        let singleEvent = SingleEvent.create<void>(() => {})
          .map(() => {})
          .map(() => {})
          .map(() => {})
          .attachToRoot();

        expect(singleEvent.destroyed).toBeFalsy();
        singleEvent.destroy();
        expect(singleEvent.destroyed).toBeTruthy();
      });

      test('destroy single event callback', () => {
        let triggered = false;
        let singleEvent = SingleEvent.create<void>(() => {
          return () => {
            triggered = true;
          };
        })
          .map(() => {})
          .map(() => {})
          .map(() => {})
          .attachToRoot();

        expect(triggered).toBeFalsy();
        singleEvent.destroy();
        expect(triggered).toBeTruthy();
      });

      test('destroying parent should destroy single event', () => {
        let parent = new Attachable().attachToRoot();

        let singleEvent = SingleEvent.create<void>(() => {})
          .map(() => {})
          .map(() => {})
          .map(() => {})
          .attach(parent);

        expect(singleEvent.destroyed).toBeFalsy();
        parent.destroy();
        expect(singleEvent.destroyed).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      test('object with subscribe property should not fool the map', () => {
        let heap: unknown[] = [];
        let fakeStream = { subscribe: 'hello' };

        SingleEvent.create<void>(resolve => resolve())
          .map(() => fakeStream)
          .read(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([fakeStream]);
      });

      test('object with subscribe function should not fool the map', () => {
        let heap: unknown[] = [];
        let fakeStream = { subscribe: () => {} };

        SingleEvent.create<void>(resolve => resolve())
          .map(() => fakeStream)
          .read(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual([fakeStream]);
      });

      test('attachments on the context attachable should be destroyed right after the iteration step', () => {
        let variable = new Variable<number>(1);
        let triggered = false;

        let singleEvent = SingleEvent.create<void>(resolve => resolve())
          .map((_, context) => {
            variable
              .subscribe(() => {
                triggered = true;
              })
              .attach(context.attachable);
          })
          .attachToRoot();

        expect(singleEvent.destroyed).toBeTruthy();
        expect(variable.listenerCount).toEqual(0);
        expect(triggered).toBeTruthy();
      });
    });
  });

  describe('Async Map', () => {
    describe('Triggers', () => {
      test('simple single event sync trigger', () => {
        let heap: string[] = [];

        SingleEvent.create<string>(resolve => resolve('a'))
          .asyncMap(data => dummySingleEvent(data))
          .read(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual(['a']);
      });

      test('simple single event async trigger', async () => {
        let heap: string[] = [];

        SingleEvent.create<string>(resolve => {
          UnitTestHelper.callEachDelayed(['a'], data => resolve(data));
        })
          .asyncMap(data => dummySingleEvent(data))
          .read(data => heap.push(data))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();

        expect(heap).toEqual(['a']);
      });
    });

    describe('Behavior', () => {
      describe('asyncMap returns sequence', () => {
        test('instant resolve', () => {
          let heap: unknown[] = [];

          SingleEvent.create<string>(resolve => resolve('a'))
            .asyncMap(data => Sequence.create<string>(resolveInner => resolveInner(data + 'I')))
            .read(data => heap.push(data))
            .attachToRoot();

          expect(heap).toEqual(['aI']);
        });

        test('async resolve', async () => {
          let heap: unknown[] = [];

          SingleEvent.create<string>(resolve => resolve('a'))
            .asyncMap(data =>
              Sequence.create<string>(resolveInner => {
                UnitTestHelper.callEachDelayed([data + 'I'], delayedData => resolveInner(delayedData));
              })
            )
            .read(data => heap.push(data))
            .attachToRoot();

          await UnitTestHelper.waitForAllOperations();
          expect(heap).toEqual(['aI']);
        });

        test('data chaining', async () => {
          let heap: unknown[] = [];

          SingleEvent.create<string>(resolve => resolve('a'))
            .asyncMap(data => {
              heap.push(data);
              return dummySequence(1);
            })
            .asyncMap(data => {
              heap.push(data);
              return dummySequence(undefined);
            })
            .asyncMap(data => {
              heap.push(data);
              return dummySequence('final');
            })
            .read(data => heap.push(data))
            .attachToRoot();

          expect(heap).toEqual(['a', 1, undefined, 'final']);
        });
      });

      describe('asyncMap returns single event', () => {
        test('instant resolve single event', () => {
          let heap: unknown[] = [];

          SingleEvent.create<string>(resolve => resolve('a'))
            .asyncMap(data => SingleEvent.create<string>(resolveInner => resolveInner(data + 'I')))
            .read(data => heap.push(data))
            .attachToRoot();

          expect(heap).toEqual(['aI']);
        });

        test('async resolve', async () => {
          let heap: unknown[] = [];

          SingleEvent.create<string>(resolve => resolve('a'))
            .asyncMap(data =>
              SingleEvent.create<string>(resolveInner => {
                UnitTestHelper.callEachDelayed([data + 'I'], delayedData => resolveInner(delayedData));
              })
            )
            .read(data => heap.push(data))
            .attachToRoot();

          await UnitTestHelper.waitForAllOperations();
          expect(heap).toEqual(['aI']);
        });

        test('data chaining', async () => {
          let heap: unknown[] = [];

          SingleEvent.create<string>(resolve => resolve('a'))
            .asyncMap(data => {
              heap.push(data);
              return dummySingleEvent(1);
            })
            .asyncMap(data => {
              heap.push(data);
              return dummySingleEvent(undefined);
            })
            .asyncMap(data => {
              heap.push(data);
              return dummySingleEvent('final');
            })
            .read(data => heap.push(data))
            .attachToRoot();

          expect(heap).toEqual(['a', 1, undefined, 'final']);
        });
      });

      describe('asyncMap returns notifier', () => {
        test('sync resolve', () => {
          let heap: unknown[] = [];

          SingleEvent.create<string>(resolve => resolve('a'))
            .asyncMap(data => new Variable<string>(data + 'I'))
            .read(data => heap.push(data))
            .attachToRoot();

          expect(heap).toEqual(['aI']);
        });

        test('async resolve', async () => {
          let heap: unknown[] = [];

          SingleEvent.create<string>(resolve => resolve('a'))
            .asyncMap(data => {
              let action = new Action<string>();
              UnitTestHelper.callEachDelayed([data + 'I'], delayedData => action.trigger(delayedData));
              return action;
            })
            .read(data => heap.push(data))
            .attachToRoot();

          await UnitTestHelper.waitForAllOperations();
          expect(heap).toEqual(['aI']);
        });
      });
    });

    describe('Destruction', () => {
      describe('asyncMap returns single event', () => {
        test('ongoing execution subscriptions should be destroyed on single event destroy', async () => {
          let triggered = false;
          let innerSingleEvent: SingleEvent<string> | undefined;

          let singleEvent = SingleEvent.create<void>(resolve => resolve())
            .asyncMap(() => {
              innerSingleEvent = SingleEvent.create(r => {
                UnitTestHelper.callEachDelayed([''], () => r(''));
              });
              expect(innerSingleEvent['executor']['_pipeline'].length).toEqual(0);
              return innerSingleEvent;
            })
            .asyncMap(() => {
              triggered = true;
              return dummySingleEvent(undefined);
            })
            .attachToRoot();

          expect(innerSingleEvent).toBeDefined();
          expect(innerSingleEvent!['executor']['_pipeline'].length).toEqual(1);

          singleEvent.destroy();
          expect(innerSingleEvent!.destroyed).toBeTruthy();

          await UnitTestHelper.waitForAllOperations();
          expect(triggered).toEqual(false);
        });
      });

      describe('asyncMap returns notifier', () => {
        test('ongoing execution subscriptions should be destroyed on single event destroy', () => {
          let action = new Action<string>();

          let triggered = false;
          let resolve!: (data: void) => void;
          let singleEvent = SingleEvent.create<void>(r => {
            resolve = r;
          })
            .asyncMap(() => action)
            .asyncMap(() => {
              triggered = true;
              return dummySingleEvent(undefined);
            })
            .attachToRoot();

          expect(triggered).toEqual(false);
          expect(action.listenerCount).toEqual(0);

          resolve();

          expect(action.listenerCount).toEqual(1);

          singleEvent.destroy();
          expect(action.listenerCount).toEqual(0);

          action.trigger('');
          expect(triggered).toEqual(false);
        });
      });
    });

    describe('Edge Cases', () => {
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
