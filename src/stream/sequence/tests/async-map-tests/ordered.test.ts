import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, expect, test } from 'vitest';

import { Action, ActionLibHardReset, Notifier, Sequence, SingleEvent, Variable } from '../../../..';

describe('Ordered Async Map', () => {
  let dummySequence = <T>(value: T) => Sequence.create<T>(resolve => resolve(value));
  let dummySingleEvent = <T>(value: T) => SingleEvent.create<T>(resolve => resolve(value));

  beforeEach(() => {
    ActionLibHardReset.hardReset();
    UnitTestHelper.reset();
  });

  describe('Triggers', () => {
    test('simple sequence sync triggers', () => {
      let heap: string[] = [];

      let resolve!: (data: string) => void;
      Sequence.create<string>(r => {
        resolve = r;
        resolve('a');
      })
        .asyncMapOrdered(data => dummySequence(data))
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
        .asyncMapOrdered(data => dummySequence(data))
        .read(data => heap.push(data))
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
        .asyncMapOrdered(data => dummySequence(data))
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
    describe('all async maps common', () => {
      describe('map returns sequence', () => {
        test('instant resolve sequence', () => {
          let heap: unknown[] = [];

          Sequence.create<string>(resolve => resolve('a'))
            .asyncMapOrdered(data => Sequence.create<string>(resolveInner => resolveInner(data + 'I')))
            .read(data => heap.push(data))
            .attachToRoot();

          expect(heap).toEqual(['aI']);
        });

        test('async resolve', async () => {
          let heap: unknown[] = [];

          Sequence.create<string>(resolve => resolve('a'))
            .asyncMapOrdered(data =>
              Sequence.create<string>(resolveInner => {
                UnitTestHelper.callEachDelayed([data + 'I'], delayedData => resolveInner(delayedData));
              })
            )
            .read(data => heap.push(data))
            .attachToRoot();

          await UnitTestHelper.waitForAllOperations();
          expect(heap).toEqual(['aI']);
        });

        test('data chaining', () => {
          let heap: unknown[] = [];

          Sequence.create<string>(resolve => resolve('a'))
            .asyncMapOrdered(data => {
              heap.push(data);
              return dummySequence(1);
            })
            .asyncMapOrdered(data => {
              heap.push(data);
              return dummySequence(undefined);
            })
            .asyncMapOrdered(data => {
              heap.push(data);
              return dummySequence(undefined);
            })
            .attachToRoot();

          expect(heap).toEqual(['a', 1, undefined]);
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
            .asyncMapOrdered(data =>
              Sequence.create<string>(resolveInner => {
                let response = data + 'I';

                // 1 sync response, 1 async response on each call
                if (innerCount % 2 === 0) {
                  resolveInner(response);
                } else {
                  UnitTestHelper.callEachDelayed([response], delayedData => resolveInner(delayedData));
                }
                innerCount++;
              })
            )
            .read(data => results.add(data))
            .attachToRoot();

          resolve('x');
          resolve('y');
          UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

          await UnitTestHelper.waitForAllOperations();

          expect(results).toEqual(new Set(['aI', 'bI', 'xI', 'yI', 'kI', 'tI']));
        });
      });

      describe('map returns single event', () => {
        test('instant resolve', () => {
          let heap: unknown[] = [];

          Sequence.create<string>(resolve => resolve('a'))
            .asyncMapOrdered(data => SingleEvent.create<string>(resolveInner => resolveInner(data + 'I')))
            .read(data => heap.push(data))
            .attachToRoot();

          expect(heap).toEqual(['aI']);
        });

        test('async resolve', async () => {
          let heap: unknown[] = [];

          Sequence.create<string>(resolve => resolve('a'))
            .asyncMapOrdered(data =>
              SingleEvent.create<string>(resolveInner => {
                UnitTestHelper.callEachDelayed([data + 'I'], delayedData => resolveInner(delayedData));
              })
            )
            .read(data => heap.push(data))
            .attachToRoot();

          await UnitTestHelper.waitForAllOperations();
          expect(heap).toEqual(['aI']);
        });

        test('data chaining', () => {
          let heap: unknown[] = [];

          Sequence.create<string>(resolve => resolve('a'))
            .asyncMapOrdered(data => {
              heap.push(data);
              return dummySingleEvent(1);
            })
            .asyncMapOrdered(data => {
              heap.push(data);
              return dummySingleEvent(undefined);
            })
            .asyncMapOrdered(data => {
              heap.push(data);
              return dummySingleEvent(undefined);
            })
            .attachToRoot();

          expect(heap).toEqual(['a', 1, undefined]);
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
            .asyncMapOrdered(data =>
              SingleEvent.create<string>(resolveInner => {
                let response = data + 'I';

                // 1 sync response, 1 async response on each call
                if (innerCount % 2 === 0) {
                  resolveInner(response);
                } else {
                  UnitTestHelper.callEachDelayed([response], delayedData => resolveInner(delayedData));
                }
                innerCount++;
              })
            )
            .read(data => results.add(data))
            .attachToRoot();

          resolve('x');
          resolve('y');
          UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

          await UnitTestHelper.waitForAllOperations();

          expect(results).toEqual(new Set(['aI', 'bI', 'xI', 'yI', 'kI', 'tI']));
        });
      });

      describe('map returns notifier', () => {
        test('sync resolve', () => {
          let heap: unknown[] = [];

          Sequence.create<string>(resolve => resolve('a'))
            .asyncMapOrdered(data => new Variable<string>(data + 'I'))
            .read(data => heap.push(data))
            .attachToRoot();

          expect(heap).toEqual(['aI']);
        });

        test('async resolve', async () => {
          let heap: unknown[] = [];

          Sequence.create<string>(resolve => resolve('a'))
            .asyncMapOrdered(data => {
              let action = new Action<string>();
              UnitTestHelper.callEachDelayed([data + 'I'], delayedData => action.trigger(delayedData));
              return action;
            })
            .read(data => heap.push(data))
            .attachToRoot();

          await UnitTestHelper.waitForAllOperations();
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
            .asyncMapOrdered(data => {
              let response: Notifier<string>;

              // 1 sync response, 1 async response on each call
              if (innerCount % 2 === 0) {
                response = new Variable<string>(data + 'I');
              } else {
                let action = new Action<string>();
                UnitTestHelper.callEachDelayed([data + 'I'], delayedData => action.trigger(delayedData));
                response = action;
              }
              innerCount++;

              return response;
            })
            .read(data => results.add(data))
            .attachToRoot();

          resolve('x');
          resolve('y');
          UnitTestHelper.callEachDelayed(['k', 't'], data => resolve(data));

          await UnitTestHelper.waitForAllOperations();

          expect(results).toEqual(new Set(['aI', 'bI', 'xI', 'yI', 'kI', 'tI']));
        });
      });
    });

    describe('specific to this map', () => {
      test(`execution order`, () => {
        let heap: unknown[] = [];
        let action1 = new Action<void>();
        let action2 = new Action<void>();
        let action3 = new Action<void>();

        Sequence.create<number>(resolve => {
          resolve(1);
          resolve(2);
          resolve(3);
        })
          .asyncMapOrdered(value => {
            if (value === 1) {
              return action1.map(() => value);
            } else if (value === 2) {
              return action2.map(() => value);
            } else {
              return action3.map(() => value);
            }
          })
          .read(value => heap.push(value))
          .attachToRoot();

        action2.trigger();
        action3.trigger();
        action1.trigger();

        expect(heap).toEqual([1, 2, 3]);
      });

      test('finalizing on arrive', () => {
        let heap: unknown[] = [];
        let action1 = new Action<void>();
        let action2 = new Action<void>();
        let action3 = new Action<void>();

        Sequence.create<number>(resolve => {
          resolve(1); // will be "in the room"
          resolve(2); // will be "in the room" finalize
          resolve(3); // will be "not entered the room yet"
        })
          .asyncMapOrdered((value, context) => {
            if (value === 1) {
              return action1.map(() => value);
            } else if (value === 2) {
              context.final();
              return action2.map(() => value);
            } else {
              return action3.map(() => value);
            }
          })
          .read(value => heap.push(value))
          .attachToRoot();

        action2.trigger();
        action3.trigger();
        action1.trigger();

        expect(heap).toEqual([1, 2]);
      });

      test('finalizing on resolve', () => {
        let heap: unknown[] = [];
        let action1 = new Action<void>();
        let action2 = new Action<void>();
        let action3 = new Action<void>();

        Sequence.create<number>(resolve => {
          resolve(1); // will be "in the room"
          resolve(2); // will be "in the room" finalize on resolve
          resolve(3); // will be "in the room"
        })
          .asyncMapOrdered((value, context) => {
            if (value === 1) {
              return action1.map(() => value);
            } else if (value === 2) {
              return action2.map(() => {
                context.final();
                return value;
              });
            } else {
              return action3.map(() => value);
            }
          })
          .read(value => heap.push(value))
          .attachToRoot();

        action2.trigger();
        action3.trigger();
        action1.trigger();

        expect(heap).toEqual([1, 2]);
      });
    });
  });

  describe('Destruction', () => {
    describe('map returns sequence', () => {
      test(`ongoing execution's subscriptions should be destroyed sequence destroy`, async () => {
        let triggered = false;
        let innerSequence: Sequence<string> | undefined;

        let sequence = Sequence.create(resolve => resolve())
          .asyncMapOrdered(() => {
            innerSequence = Sequence.create(r => {
              UnitTestHelper.callDelayed(() => r(''));
            });
            expect(innerSequence!['_executor']['_pipeline'].length).toEqual(0);
            return innerSequence;
          })
          .asyncMapOrdered(() => {
            triggered = true;
            return dummySequence(undefined);
          })
          .attachToRoot();

        expect(innerSequence).toBeDefined();
        expect(innerSequence!['_executor']['_pipeline'].length).toEqual(1);

        sequence.destroy();
        expect(innerSequence!.destroyed).toBeTruthy();

        await UnitTestHelper.waitForAllOperations();
        expect(triggered).toEqual(false);
      });

      test(`multiple chain triggers should successfully unsubscribe on destruction`, () => {
        let triggered = false;
        let innerSequences: Sequence<string>[] = [];
        let innerResolves: ((data: string) => void)[] = [];

        let sequence = Sequence.create(resolve => {
          resolve();
          resolve();
        })
          .asyncMapOrdered(() => {
            let innerSequence = Sequence.create<string>(r => {
              innerResolves.push(r);
            });
            expect(innerSequence!['_executor']['_pipeline'].length).toEqual(0);
            innerSequences.push(innerSequence);
            return innerSequence;
          })
          .asyncMapOrdered(() => {
            triggered = true;
            return dummySequence(undefined);
          })
          .attachToRoot();

        expect(innerSequences.length).toEqual(2);
        expect(innerResolves.length).toEqual(2);
        innerSequences.forEach(innerSequence => {
          expect(innerSequence['_executor']['_pipeline'].length).toEqual(1);
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
        let sequence = Sequence.create(resolve => resolve())
          .asyncMapOrdered(() => action)
          .asyncMapOrdered(() => {
            triggered = true;
            return dummySequence(undefined);
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
        let sequence = Sequence.create(resolve => {
          resolve();
          resolve();
        })
          .asyncMapOrdered(() => action)
          .asyncMapOrdered(() => {
            triggered = true;
            return dummySequence(undefined);
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

    describe('destroying pipeline', () => {
      test('finalizing pipeline with ongoing operation to be completed', async () => {
        let heap: unknown[] = [];

        Sequence.create<number>((resolve, context) => {
          resolve(1);
          context.final();
        })
          .asyncMapOrdered(value =>
            Sequence.create<string>(resolve =>
              UnitTestHelper.callEachDelayed([value + 'a'], delayedValue => resolve(delayedValue))
            )
          )
          .read(value => heap.push(value))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();
        expect(heap).toEqual(['1a']);
      });

      test('finalizing pipeline with multiple ongoing operations to be completed', async () => {
        let heap: unknown[] = [];

        Sequence.create<number>((resolve, context) => {
          resolve(1);
          resolve(2);
          context.final();
        })
          .asyncMapOrdered(value =>
            Sequence.create<string>(resolve =>
              UnitTestHelper.callEachDelayed([value + 'a'], delayedValue => resolve(delayedValue))
            )
          )
          .read(value => heap.push(value))
          .attachToRoot();

        await UnitTestHelper.waitForAllOperations();
        expect(heap).toEqual(['1a', '2a']);
      });

      test('finalize a link that comes after should destroy ongoing items of previous link', () => {
        let heap: unknown[] = [];

        let action1 = new Action<void>();
        let action2 = new Action<void>();
        let action3 = new Action<void>();
        let actionlast = new Action<void>();

        let sequence = Sequence.create<number>(resolve => {
          resolve(1);
          resolve(2);
          resolve(3);
        })
          .asyncMapDirect(value => {
            if (value === 1) {
              return action1.map(() => value);
            } else if (value === 2) {
              return action2.map(() => value);
            } else {
              return action3.map(() => value);
            }
          })
          .asyncMapDirect((value, context) => {
            if (value === 2) {
              context.final();
            }

            return actionlast.map(() => value);
          })
          .read(value => heap.push(value))
          .attachToRoot();

        // 3, 2, 1 --> _ --> _

        expect(action1.listenerCount).toEqual(1);
        expect(action2.listenerCount).toEqual(1);
        expect(action3.listenerCount).toEqual(1);
        expect(actionlast.listenerCount).toEqual(0);
        expect(sequence['_executor']['_finalized']).toBeFalsy();
        expect(heap).toEqual([]);

        action1.trigger();
        // 3, 2 --> 1 --> _

        expect(action1.listenerCount).toEqual(0);
        expect(action2.listenerCount).toEqual(1);
        expect(action3.listenerCount).toEqual(1);
        expect(actionlast.listenerCount).toEqual(1);
        expect(sequence['_executor']['_finalized']).toBeFalsy();
        expect(sequence.destroyed).toBeFalsy();
        expect(heap).toEqual([]);

        action2.trigger();
        // _ --> F!, 2, 1 --> _

        expect(action1.listenerCount).toEqual(0);
        expect(action2.listenerCount).toEqual(0);
        expect(action3.listenerCount).toEqual(0);
        expect(actionlast.listenerCount).toEqual(2);
        expect(sequence['_executor']['_finalized']).toBeTruthy();
        expect(sequence.destroyed).toBeFalsy();
        expect(heap).toEqual([]);

        actionlast.trigger();
        // _ --> _ --> F!, 2, 1

        expect(action1.listenerCount).toEqual(0);
        expect(action2.listenerCount).toEqual(0);
        expect(action3.listenerCount).toEqual(0);
        expect(actionlast.listenerCount).toEqual(0);
        expect(sequence['_executor']['_finalized']).toBeTruthy();
        expect(sequence.destroyed).toBeTruthy();
        expect(heap).toEqual([1, 2]);
      });
    });
  });

  describe('Edge Cases', () => {
    test('destroying subscriptions via attachment, instantly finalizing sequence', () => {
      let variable = new Variable<number>(1);
      let triggered = false;

      let sequence = Sequence.create((resolve, context) => {
        resolve();
        context.final();
      })
        .asyncMapOrdered((_, context) =>
          Sequence.create(resolve => {
            variable
              .subscribe(() => {
                triggered = true;
                resolve();
              })
              .attach(context.attachable);
          })
        )
        .attachToRoot();

      expect(sequence.destroyed).toBeTruthy();
      expect(variable.listenerCount).toEqual(0);
      expect(triggered).toBeTruthy();
    });

    test('attachments on the context attachable should be destroyed right after the package iteration step', () => {
      let variable = new Variable<number>(1);
      let action = new Action<void>();
      let triggered = false;

      let resolve!: () => void;
      let sequence = Sequence.create(r => {
        resolve = r;
      })
        .asyncMapOrdered((_, context) =>
          Sequence.create(r => {
            variable
              .subscribe(() => {
                triggered = true;
                r();
              })
              .attach(context.attachable);
          })
        )
        .asyncMapOrdered(() => action)
        .attachToRoot();

      expect(sequence.destroyed).toBeFalsy();
      expect(variable.listenerCount).toEqual(0);
      expect(action.listenerCount).toEqual(0);
      expect(triggered).toBeFalsy();

      resolve();

      expect(sequence.destroyed).toBeFalsy();
      expect(variable.listenerCount).toEqual(0);
      expect(action.listenerCount).toEqual(1);
      expect(triggered).toBeTruthy();

      sequence.destroy();

      expect(sequence.destroyed).toBeTruthy();
      expect(variable.listenerCount).toEqual(0);
      expect(action.listenerCount).toEqual(0);
    });

    test('multiple packages waiting for same action to be triggered should pass together to the next link with keeping their order', () => {
      let action = new Action<string>();

      let heap: string[] = [];
      Sequence.create<number>(resolve => {
        resolve(1);
        resolve(2);
        resolve(3);
      })
        .asyncMapOrdered(data =>
          Sequence.create<string>((resolve, context) => {
            action.subscribe(actionValue => resolve(data + actionValue)).attach(context.attachable);
          })
        )
        .read(data => heap.push(data))
        .attachToRoot();

      expect(heap).toEqual([]);
      expect(action.listenerCount).toEqual(3);

      action.trigger('a');
      expect(heap).toEqual(['1a', '2a', '3a']);
      expect(action.listenerCount).toEqual(0);
    });
  });
});
