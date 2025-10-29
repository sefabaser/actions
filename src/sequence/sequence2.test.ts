import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { ActionLibUnitTestHelper } from '../helpers/unit-test.helper';
import { Notifier } from '../observables/_notifier/notifier';
import { Action } from '../observables/action/action';
import { Variable } from '../observables/variable/variable';
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

      test('destroy sequence callback', () => {
        let triggered = false;
        let sequance = Sequence.create<void>(() => {
          return () => {
            triggered = true;
          };
        }).attachToRoot();

        expect(triggered).toBeFalsy();
        sequance.destroy();
        expect(triggered).toBeTruthy();
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

    describe('Edge Cases', () => {
      test(`Executor's functions should not leak into the constructor`, () => {
        Sequence.create((...args: any[]) => {
          expect(args.length).toBe(1);
        }).attachToRoot();
      });

      test('Each sequence can be linkable once', () => {
        expect(() => {
          let sequence = Sequence.create<string>(resolve => resolve('a'));
          sequence.read(() => {}).attachToRoot();
          sequence.read(() => {});
        }).toThrow('A sequence can only be linked once.');
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

      test('destroy sequence callback', () => {
        let triggered = false;
        let sequance = Sequence.create<void>(resolve => {
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
        sequance.destroy();
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
      describe('sync', () => {
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

      describe('map returns sequence', () => {
        test('sync resolve', () => {
          let heap: unknown[] = [];

          Sequence.create<string>(resolve => resolve('a'))
            .map(data => Sequence.create<string>(resolveInner => resolveInner(data + 'I')))
            .read(data => heap.push(data))
            .attachToRoot();

          expect(heap).toEqual(['aI']);
        });

        test('async resolve', async () => {
          let heap: unknown[] = [];

          Sequence.create<string>(resolve => resolve('a'))
            .map(data =>
              Sequence.create<string>(resolveInner => {
                delayedCalls.callEachDelayed([data + 'I'], delayedData => resolveInner(delayedData));
              })
            )
            .read(data => heap.push(data))
            .attachToRoot();

          await delayedCalls.waitForAllPromises();
          expect(heap).toEqual(['aI']);
        });

        test('mixed resolves', async () => {
          let results = new Set<string>();

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
                innerCount++;
              })
            )
            .read(data => results.add(data))
            .attachToRoot();

          resolve('x');
          resolve('y');
          delayedCalls.callEachDelayed(['k', 't'], data => resolve(data));

          await delayedCalls.waitForAllPromises();

          expect(results).toEqual(new Set(['aI', 'bI', 'xI', 'yI', 'kI', 'tI']));
        });
      });

      describe('map returns notifier', () => {
        test('sync resolve', () => {
          let heap: unknown[] = [];

          Sequence.create<string>(resolve => resolve('a'))
            .map(data => new Variable<string>(data + 'I'))
            .read(data => heap.push(data))
            .attachToRoot();

          expect(heap).toEqual(['aI']);
        });

        test('async resolve', async () => {
          let heap: unknown[] = [];

          Sequence.create<string>(resolve => resolve('a'))
            .map(data => {
              let action = new Action<string>();
              delayedCalls.callEachDelayed([data + 'I'], delayedData => action.trigger(delayedData));
              return action;
            })
            .read(data => heap.push(data))
            .attachToRoot();

          await delayedCalls.waitForAllPromises();
          expect(heap).toEqual(['aI']);
        });

        test('mixed resolves', async () => {
          let results = new Set<string>();

          let resolve!: (data: string) => void;

          let innerCount = 0;
          Sequence.create<string>(r => {
            resolve = r;
            resolve('a');
            resolve('b');
          })
            .map(data => {
              let response: Notifier<string>;

              // 1 sync response, 1 async response on each call
              if (innerCount % 2 === 0) {
                response = new Variable<string>(data + 'I');
              } else {
                let action = new Action<string>();
                delayedCalls.callEachDelayed([data + 'I'], delayedData => action.trigger(delayedData));
                response = action;
              }
              innerCount++;

              return response;
            })
            .read(data => results.add(data))
            .attachToRoot();

          resolve('x');
          resolve('y');
          delayedCalls.callEachDelayed(['k', 't'], data => resolve(data));

          await delayedCalls.waitForAllPromises();

          expect(results).toEqual(new Set(['aI', 'bI', 'xI', 'yI', 'kI', 'tI']));
        });
      });
    });

    describe('Destruction', () => {
      test('destroy sequence callback', () => {
        let triggered = false;
        let sequance = Sequence.create<void>(resolve => {
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
        sequance.destroy();
        expect(triggered).toBeTruthy();
      });

      describe('sync', () => {
        test('destroying sequence', () => {
          let sequance = Sequence.create<void>(resolve => resolve())
            .map(() => {})
            .map(() => {})
            .map(() => {})
            .attachToRoot();

          expect(sequance.destroyed).toBeFalsy();
          sequance.destroy();
          expect(sequance.destroyed).toBeTruthy();
        });

        test('destroying parent should destroy sequence', () => {
          let parent = new Attachable().attachToRoot();

          let sequance = Sequence.create<void>(resolve => resolve())
            .map(() => {})
            .map(() => {})
            .map(() => {})
            .attach(parent);

          expect(sequance.destroyed).toBeFalsy();
          parent.destroy();
          expect(sequance.destroyed).toBeTruthy();
        });
      });

      describe('map returns sequence', () => {
        test(`ongoing execution's subscriptions should be destroyed sequence destroy`, async () => {
          let triggered = false;
          let innerSequence: Sequence<string> | undefined;

          let sequence = Sequence.create<void>(resolve => resolve())
            .map(() => {
              innerSequence = Sequence.create(r => {
                delayedCalls.callEachDelayed([''], () => r(''));
              });
              expect(innerSequence!['executor']['_pipeline'].length).toEqual(0);
              return innerSequence;
            })
            .map(() => {
              triggered = true;
            })
            .attachToRoot();

          expect(innerSequence).toBeDefined();
          expect(innerSequence!['executor']['_pipeline'].length).toEqual(1);

          sequence.destroy();
          expect(innerSequence!.destroyed).toBeTruthy();

          await delayedCalls.waitForAllPromises();
          expect(triggered).toEqual(false);
        });

        test(`multiple chain triggers should successfully unsubscribe on destruction`, () => {
          let triggered = false;
          let innerSequences: Sequence<string>[] = [];
          let innerResolves: ((data: string) => void)[] = [];

          let sequence = Sequence.create<void>(resolve => {
            resolve();
            resolve();
          })
            .map(() => {
              let innerSequence = Sequence.create<string>(r => {
                innerResolves.push(r);
              });
              expect(innerSequence!['executor']['_pipeline'].length).toEqual(0);
              innerSequences.push(innerSequence);
              return innerSequence;
            })
            .map(() => {
              triggered = true;
            })
            .attachToRoot();

          expect(innerSequences.length).toEqual(2);
          expect(innerResolves.length).toEqual(2);
          innerSequences.forEach(innerSequence => {
            expect(innerSequence['executor']['_pipeline'].length).toEqual(1);
          });

          sequence.destroy();

          innerSequences.forEach(innerSequence => {
            expect(innerSequence.destroyed).toBeTruthy();
          });

          innerResolves.forEach(resolve => resolve(''));
          expect(triggered).toEqual(false);
        });
      });

      describe('map returns notifier', () => {
        test(`ongoing execution's subscriptions should be destroyed sequence destroy`, () => {
          let action = new Action<string>();

          let triggered = false;
          let sequence = Sequence.create<void>(resolve => resolve())
            .map(() => action)
            .map(() => {
              triggered = true;
            })
            .attachToRoot();

          expect(triggered).toEqual(false);
          expect(action.listenerCount).toEqual(1);

          sequence.destroy();
          expect(action.listenerCount).toEqual(0);

          action.trigger('');
          expect(triggered).toEqual(false);
        });

        test('multiple chain triggers should successfully unsubscribe on destruction', () => {
          let action = new Action<string>();

          let triggered = false;
          let sequence = Sequence.create<void>(resolve => {
            resolve();
            resolve();
          })
            .map(() => action)
            .map(() => {
              triggered = true;
            })
            .attachToRoot();

          expect(triggered).toEqual(false);
          expect(action.listenerCount).toEqual(2);

          sequence.destroy();
          expect(action.listenerCount).toEqual(0);

          action.trigger('');
          expect(triggered).toEqual(false);
        });
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
        delayedCalls.callEachDelayed(['k', 't'], data => resolve(data));

        await delayedCalls.waitForAllPromises();

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
        delayedCalls.callEachDelayed(['k', 't'], data => resolve(data));

        await delayedCalls.waitForAllPromises();

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
        delayedCalls.callEachDelayed(['k', 't'], data => resolve(data));

        await delayedCalls.waitForAllPromises();

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
        delayedCalls.callEachDelayed(['k', 'k'], data => resolve(data));

        await delayedCalls.waitForAllPromises();

        expect(heap).toEqual(['a', 'x', 'k']);
      });
    });

    describe('Destruction', () => {
      test('destroying sequence', () => {
        let sequance = Sequence.create<void>(resolve => resolve())
          .filter(() => true)
          .filter(() => true)
          .filter(() => true)
          .attachToRoot();

        expect(sequance.destroyed).toBeFalsy();
        sequance.destroy();
        expect(sequance.destroyed).toBeTruthy();
      });

      test('destroying parent should destroy sequence', () => {
        let parent = new Attachable().attachToRoot();

        let sequance = Sequence.create<void>(resolve => resolve())
          .filter(() => true)
          .filter(() => true)
          .filter(() => true)
          .attach(parent);

        expect(sequance.destroyed).toBeFalsy();
        parent.destroy();
        expect(sequance.destroyed).toBeTruthy();
      });

      test('destroy sequence callback', () => {
        let triggered = false;
        let sequance = Sequence.create<void>(resolve => {
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
        sequance.destroy();
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
        delayedCalls.callEachDelayed(['k', 't'], data => resolve(data));

        await delayedCalls.waitForAllPromises();

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

      test('instantly finishing the sequence should not block the chain', () => {
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
        let sequance = Sequence.create<void>(resolve => resolve())
          .take(2)
          .attachToRoot();

        expect(sequance.destroyed).toBeFalsy();
        sequance.destroy();
        expect(sequance.destroyed).toBeTruthy();
      });

      test('destroy sequence callback', () => {
        let triggered = false;
        let sequance = Sequence.create<void>(resolve => {
          resolve();
          return () => {
            triggered = true;
          };
        });

        expect(triggered).toBeFalsy();
        sequance.take(1);
        expect(triggered).toBeTruthy();
        sequance.attachToRoot();
      });

      test('directly destroyed sequence callback', () => {
        let heap: string[] = [];
        Sequence.create<void>(resolve => {
          resolve();
          return () => {
            heap.push('destroyed');
          };
        })
          .read(() => {
            heap.push('read1');
          })
          .take(1)
          .read(() => {
            heap.push('read2');
          })
          .attachToRoot();

        expect(heap).toEqual(['read1', 'destroyed', 'read2']);
      });

      test('destroying parent should destroy sequence', () => {
        let parent = new Attachable().attachToRoot();

        let sequance = Sequence.create<void>(resolve => resolve())
          .take(2)
          .attach(parent);

        expect(sequance.destroyed).toBeFalsy();
        parent.destroy();
        expect(sequance.destroyed).toBeTruthy();
      });

      test('completing takes should destroy the sequence', () => {
        let resolve!: () => void;
        let sequance = Sequence.create<void>(r => {
          resolve = r;
        })
          .take(1)
          .attachToRoot();

        expect(sequance.destroyed).toBeFalsy();
        resolve();
        expect(sequance.destroyed).toBeTruthy();
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

        await delayedCalls.waitForAllPromises();

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

      test('merging instantly destroyed sequences', async () => {
        let heap: string[] = [];

        let s1 = Sequence.create<string>(resolve => resolve('a')).take(1);
        let s2 = Sequence.create<string>(resolve => resolve('b')).take(1);

        let merged = Sequence.merge(s1, s2);
        let read = merged.read(data => heap.push(data)).attachToRoot();

        await delayedCalls.waitForAllPromises();

        expect(heap).toEqual(['a', 'b']);
        expect(s1.destroyed).toBeTruthy();
        expect(s2.destroyed).toBeTruthy();
        expect(merged.destroyed).toBeTruthy();
        expect(read.destroyed).toBeTruthy();
      });

      test('merge with delayed sequences', async () => {
        let heap: string[] = [];
        Sequence.merge(
          Sequence.create<string>(resolve => delayedCalls.callEachDelayed(['1', '2'], resolve)),
          Sequence.create<string>(resolve => delayedCalls.callEachDelayed(['a', 'b'], resolve)),
          Sequence.create<string>(resolve => delayedCalls.callEachDelayed(['x', 'y'], resolve))
        )
          .read(data => heap.push(data))
          .attachToRoot();

        await delayedCalls.waitForAllPromises();
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
        merged.destroy();
        expect(sequence1.destroyed).toBeTruthy();
        expect(sequence2.destroyed).toBeTruthy();
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
      test('merged sequances should not need to be attached manually', () => {
        vi.useFakeTimers();
        expect(() => {
          let sequence1 = Sequence.create(() => {});
          let sequence2 = Sequence.create(() => {});
          Sequence.merge(sequence1, sequence2).attachToRoot();

          vi.runAllTimers();
        }).not.toThrow('LightweightAttachable: The object is not attached to anything!');
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
    });
  });
});
