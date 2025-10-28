import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { ActionLibUnitTestHelper } from '../helpers/unit-test.helper';
import { Action } from '../observables/action/action';
import { DelayedSequentialCallsHelper } from './delayed-sequential-calls.helper';
import { Sequence2 as Sequence } from './sequence2';

describe('Sequence', () => {
  let delayedCalls = new DelayedSequentialCallsHelper();

  beforeEach(() => {
    ActionLibUnitTestHelper.hardReset();
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
          Sequence.create<string>(resolve => delayedCalls.callEachDelayed(['1, 2'], value => resolve(value))).attachToRoot()
        ).toBeDefined();
      });

      test('plain sequence sync/async triggers', async () => {
        expect(
          Sequence.create<string>(resolve => {
            resolve('a');
            resolve('b');
            delayedCalls.callEachDelayed(['1, 2'], value => resolve(value));
          }).attachToRoot()
        ).toBeDefined();
        await delayedCalls.waitForAllPromises();
      });

      test('attach cannot be called before the end of the chain', async () => {
        let sequence = Sequence.create<string>(resolve => resolve('a'));
        expect(() =>
          sequence
            .read(() => {})
            .attachToRoot()
            .read(() => {})
        ).toThrow('After attaching a sequence you cannot add another operation.');
        await delayedCalls.waitForAllPromises();
      });
    });

    describe('Destruction', () => {
      test('destroying sequence', () => {
        let sequance = Sequence.create<void>(resolve => resolve()).attachToRoot();

        expect(sequance.destroyed).toBeFalsy();
        sequance.destroy();
        expect(sequance.destroyed).toBeTruthy();
      });

      test('destroying parent should destroy sequence', () => {
        let parent = new Attachable().attachToRoot();

        let sequance = Sequence.create<void>(resolve => resolve()).attach(parent);

        expect(sequance.destroyed).toBeFalsy();
        parent.destroy();
        expect(sequance.destroyed).toBeTruthy();
      });
    });

    describe('Attachment Errors', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      test('not attaching to anything should throw error', () => {
        expect(() => {
          Sequence.create<void>(resolve => resolve());
          vi.runAllTimers();
        }).toThrow('LightweightAttachable: The object is not attached to anything!');
      });

      test('attaching to a target should not throw error', () => {
        expect(() => {
          Sequence.create<void>(resolve => resolve())
            .read(() => {})
            .attach(new Attachable().attachToRoot());

          vi.runAllTimers();
        }).not.toThrow('LightweightAttachable: The object is not attached to anything!');
      });

      test('attaching to root should not throw error', () => {
        expect(() => {
          Sequence.create<void>(resolve => resolve())
            .read(() => {})
            .attachToRoot();

          vi.runAllTimers();
        }).not.toThrow('LightweightAttachable: The object is not attached to anything!');
      });

      test('not attaching the chain to a target should throw error', () => {
        expect(() => {
          Sequence.create<void>(resolve => resolve())
            .read(() => {})
            .read(() => {});

          vi.runAllTimers();
        }).toThrow('LightweightAttachable: The object is not attached to anything!');
      });

      test('attaching the chain to a target should not throw error', () => {
        expect(() => {
          Sequence.create<void>(resolve => resolve())
            .read(() => {})
            .read(() => {})
            .attach(new Attachable().attachToRoot());

          vi.runAllTimers();
        }).not.toThrow('LightweightAttachable: The object is not attached to anything!');
      });

      test('attaching the chain to root should not throw error', () => {
        expect(() => {
          Sequence.create<void>(resolve => resolve())
            .read(() => {})
            .read(() => {})
            .attachToRoot();

          vi.runAllTimers();
        }).not.toThrow('LightweightAttachable: The object is not attached to anything!');
      });
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
        delayedCalls.callEachDelayed(['k', 't'], data => resolve(data));

        await delayedCalls.waitForAllPromises();

        expect(heap).toEqual(['a', 'b', 'x', 'y', 'k', 't']);
      });
    });

    describe('Behavior', () => {
      test('sync read chain', () => {
        let heap: string[] = [];

        Sequence.create<void>(resolve => resolve())
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
        delayedCalls.callEachDelayed(['k', 't'], data => resolve(data));

        await delayedCalls.waitForAllPromises();

        expect(heap).toEqual([
          '1a',
          '1b',
          '2a',
          '2b',
          '3a',
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
        Sequence.create<void>(resolve => resolve())
          .read(data => {
            heap.push(data);
          })
          .attachToRoot();

        expect(heap).toEqual([undefined]);
      });
    });

    describe('Destruction', () => {
      test('destroying sequence', () => {
        let sequance = Sequence.create<void>(resolve => resolve())
          .read(() => {})
          .read(() => {})
          .read(() => {})
          .attachToRoot();

        expect(sequance.destroyed).toBeFalsy();
        sequance.destroy();
        expect(sequance.destroyed).toBeTruthy();
      });

      test('destroying parent should destroy sequence', () => {
        let parent = new Attachable().attachToRoot();

        let sequance = Sequence.create<void>(resolve => resolve())
          .read(() => {})
          .read(() => {})
          .read(() => {})
          .attach(parent);

        expect(sequance.destroyed).toBeFalsy();
        parent.destroy();
        expect(sequance.destroyed).toBeTruthy();
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
        delayedCalls.callEachDelayed(['k', 't'], data => resolve(data));

        await delayedCalls.waitForAllPromises();

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

      test('map returns another sequence sync resolve', () => {
        let heap: unknown[] = [];

        Sequence.create<string>(resolve => resolve('a'))
          .map(data => Sequence.create<string>(resolveInner => resolveInner(data + '1')))
          .read(data => heap.push(data))
          .attachToRoot();

        expect(heap).toEqual(['a1']);
      });

      test('map returns another sequence async resolve', async () => {
        let heap: unknown[] = [];

        Sequence.create<string>(resolve => resolve('a'))
          .map(data =>
            Sequence.create<string>(resolveInner => {
              delayedCalls.callEachDelayed([data + '1'], delayedData => resolveInner(delayedData));
            })
          )
          .read(data => heap.push(data))
          .attachToRoot();

        await delayedCalls.waitForAllPromises();
        expect(heap).toEqual(['a1']);
      });

      test('map returns another sequence mixed resolves', async () => {
        let heap: string[] = [];

        let resolve!: (data: string) => void;

        let innerCount = 0;
        Sequence.create<string>(r => {
          resolve = r;
          resolve('a');
          resolve('b');
        })
          .map(data =>
            Sequence.create<string>(resolveInner => {
              let response = data + 'I';

              // 1 sync response, 1 async response on each call
              if (innerCount % 2 === 0) {
                resolveInner(response);
              } else {
                delayedCalls.callEachDelayed([response], delayedData => resolveInner(delayedData));
              }
            })
          )
          .read(data => heap.push(data))
          .attachToRoot();

        resolve('x');
        resolve('y');
        delayedCalls.callEachDelayed(['k', 't'], data => resolve(data));

        await delayedCalls.waitForAllPromises();

        expect(heap).toEqual(['a', 'b', 'x', 'y', 'k', 't']);
      });
    });
  });

  describe('Edge Cases', () => {
    test('execution should stop listening notifiers even it is in the middle on destruction', () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();

      let triggered = false;
      let sequence = action1
        .map(() => action2)
        .map(() => {
          triggered = true;
        })
        .attachToRoot();

      action1.trigger('');

      expect(triggered).toEqual(false);
      expect(action2.listenerCount).toEqual(1);

      sequence.destroy();
      expect(action2.listenerCount).toEqual(0);

      action2.trigger('');
      expect(triggered).toEqual(false);
    });

    test('multiple chain triggers should successfully unsubscribe on destruction', () => {
      let action1 = new Action<string>();
      let action2 = new Action<string>();
      let sequence = action1
        .map(() => action2)
        .map(() => {})
        .attachToRoot();

      action1.trigger('');
      action1.trigger('');

      expect(action1.listenerCount).toEqual(1);
      expect(action2.listenerCount).toEqual(2);

      sequence.destroy();
      expect(action1.listenerCount).toEqual(0);
      expect(action2.listenerCount).toEqual(0);
    });
  });
});
