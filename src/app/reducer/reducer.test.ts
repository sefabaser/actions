import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Reducer } from './reducer';

describe(`Reducer`, () => {
  describe(`Basics`, () => {
    let reducer: Reducer<void, boolean>;

    beforeEach(() => {
      let blockers = new Set<number>();
      reducer = new Reducer<void, boolean>(change => {
        if (change.type === 'effect' || change.type === 'update') {
          blockers.add(change.id);
        } else if (change.type === 'destroy') {
          blockers.delete(change.id);
        }
        return blockers.size > 0;
      });
    });

    test('should be definable', () => {
      expect(reducer).toBeDefined();
    });

    test('should be subscribable', () => {
      reducer.subscribe(() => {});
      expect(reducer['notificationHandler']['listenersMap'].size).toEqual(1);
    });

    test('should be able to use subscribe only new changes', () => {
      let triggered = false;
      reducer.subscribe(
        () => {
          triggered = true;
        },
        { listenOnlyNewChanges: true }
      );

      expect(triggered).toEqual(false);
      reducer.effect();
      expect(triggered).toEqual(true);
    });

    test('should be unsubscribable', () => {
      let subscription = reducer.subscribe(() => {});
      subscription.unsubscribe();
      expect(reducer['notificationHandler']['listenersMap'].size).toEqual(0);
    });

    test('triggerring without listeners', () =>
      new Promise<void>(done => {
        reducer.effect();
        done();
      }));

    test('should notify listeners', () =>
      new Promise<void>(done => {
        let listener1 = false;
        let listener2 = false;

        reducer.subscribe(response => {
          if (response) {
            listener1 = true;
            if (listener2) {
              done();
            }
          }
        });

        reducer.subscribe(response => {
          if (response) {
            listener2 = true;
            if (listener1) {
              done();
            }
          }
        });

        reducer.effect();
      }));

    test('should not notify unsubscribed listeners', () =>
      new Promise<void>(done => {
        let triggered: boolean;
        let subscription = reducer.subscribe(change => {
          triggered = true;
        });
        triggered = false; // destroy initial trigger after subscription

        subscription.unsubscribe();

        reducer.effect();

        setTimeout(() => {
          if (!triggered) {
            done();
          }
        }, 0);
      }));
  });

  describe(`Feeding Mechanism`, () => {
    let reducer: Reducer<void, boolean>;

    beforeEach(() => {
      let blockers = new Set<number>();
      reducer = new Reducer<void, boolean>(change => {
        if (change.type === 'effect' || change.type === 'update') {
          blockers.add(change.id);
        } else if (change.type === 'destroy') {
          blockers.delete(change.id);
        }
        return blockers.size > 0;
      });
    });

    test('subscribing without any effecter should return base value', () =>
      new Promise<void>(done => {
        reducer.subscribe(response => {
          if (response === false) {
            done();
          }
        });
      }));

    test('should always notify listeners only on change', () => {
      let blocked = false;
      let triggerCount = 0;
      reducer.subscribe(response => {
        blocked = response;
        triggerCount++;
      });

      expect(blocked).toEqual(false);
      expect(triggerCount).toEqual(1);

      let blocker1 = reducer.effect();

      expect(blocked).toEqual(true);
      expect(triggerCount).toEqual(2);

      let blocker2 = reducer.effect(); // this new blocker shouldn't trigger new broadcast

      expect(blocked).toEqual(true);
      expect(triggerCount).toEqual(2);

      blocker1.destroy(); // still there is blocker2 it shouldn't effect anything

      expect(blocked).toEqual(true);
      expect(triggerCount).toEqual(2);

      blocker2.destroy();

      expect(blocked).toEqual(false);
      expect(triggerCount).toEqual(3);
    });

    test('should always be persistent, always gives the last broadcasted value to new listeners', () => {
      reducer.effect();
      let blocked = false;

      reducer.subscribe(response => {
        blocked = response;
      });

      expect(blocked).toEqual(true);
    });
  });

  describe(`Reduce Function`, () => {
    test('should trigger initial call', () =>
      new Promise<void>(done => {
        let reducer = new Reducer<boolean, void>(change => {
          if (change.type === 'initial') {
            done();
          }
        });
      }));

    test('should trigger effect call', () =>
      new Promise<void>(done => {
        let reducer = new Reducer<boolean, void>(change => {
          if (change.type === 'effect') {
            done();
          }
        });

        reducer.effect(true);
      }));

    test('should trigger update call', () =>
      new Promise<void>(done => {
        let reducer = new Reducer<boolean, void>(change => {
          if (change.type === 'update') {
            done();
          }
        });

        let effect = reducer.effect(true);
        effect.update(false);
      }));

    test('should trigger destroy call', () =>
      new Promise<void>(done => {
        let reducer = new Reducer<boolean, void>(change => {
          if (change.type === 'destroy') {
            done();
          }
        });

        let effect = reducer.effect(true);
        effect.destroy();
      }));

    test('should give unique id to different effecters', () => {
      let firstId: number | undefined;
      let secondId: number | undefined;

      let reducer = new Reducer<boolean, void>(change => {
        if (change.type === 'effect') {
          if (!firstId) {
            firstId = change.id;
          } else {
            secondId = change.id;
          }
        }
      });

      reducer.effect(true);
      reducer.effect(true);

      expect(firstId).toBeDefined();
      expect(secondId).toBeDefined();
      expect(firstId !== secondId).toEqual(true);
    });

    test('should give same unique id to all operations of the same effecter', () => {
      let id: number;
      let successful = true;

      let reducer = new Reducer<boolean, void>(change => {
        if (change.type !== 'initial') {
          if (!id) {
            id = change.id;
          } else if (id !== change.id) {
            successful = false;
          }
        }
      });

      let effect = reducer.effect(true);
      effect.update(false);
      effect.update(true);
      effect.destroy();

      expect(successful).toEqual(true);
    });

    test('should correct previous and current values of the change', () => {
      let successful = true;

      let reducer = new Reducer<boolean, boolean>(change => {
        if (change.type === 'initial') {
          if (change.current !== undefined || change.previous !== undefined) {
            successful = false;
          }
        } else if (change.type === 'effect') {
          if (change.current !== true || change.previous !== undefined) {
            successful = false;
          }
        } else if (change.type === 'update') {
          if (change.current !== false || change.previous !== true) {
            successful = false;
          }
        } else if (change.type === 'destroy') {
          if (change.current !== undefined || change.previous !== false) {
            successful = false;
          }
        }

        return !!change.current;
      });

      let effect = reducer.effect(true);
      effect.update(false);
      effect.destroy();

      expect(successful).toEqual(true);
    });

    test('updating effect should throw error after destroyd', () => {
      let triggerCount = 0;
      let reducer = new Reducer<void, void>(change => {
        triggerCount++;
      });

      let effect = reducer.effect();
      expect(triggerCount).toEqual(2); // one initial and one after effect

      effect.destroy();
      expect(triggerCount).toEqual(3);

      expect(() => effect.update()).toThrow();
    });
  });

  describe(`Factory`, () => {
    describe(`Existence Checker Reducer`, () => {
      test('should return false if there is no effect', () =>
        new Promise<void>(done => {
          let existanceChecker = Reducer.createExistenceChecker();

          existanceChecker.subscribe(result => {
            if (result === false) {
              done();
            }
          });
        }));

      test('should return false all effects are destroyd', () =>
        new Promise<void>(done => {
          let existanceChecker = Reducer.createExistenceChecker();

          let firstEffect = existanceChecker.effect();
          let secondEffect = existanceChecker.effect();
          firstEffect.destroy();
          secondEffect.destroy();

          existanceChecker.subscribe(result => {
            if (result === false) {
              done();
            }
          });
        }));

      test('should return true if there is at least one effect', () =>
        new Promise<void>(done => {
          let existanceChecker = Reducer.createExistenceChecker();

          let firstEffect = existanceChecker.effect();
          existanceChecker.effect();
          firstEffect.destroy();

          existanceChecker.subscribe(result => {
            if (result === true) {
              done();
            }
          });
        }));
    });

    describe(`And Question`, () => {
      test('should return true if there is no effect', () =>
        new Promise<void>(done => {
          let isEverybodyAgrees = Reducer.createAnd();

          isEverybodyAgrees.subscribe(result => {
            if (result === true) {
              done();
            }
          });
        }));

      test('should return false if there is at least one effect with true', () =>
        new Promise<void>(done => {
          let isEverybodyAgrees = Reducer.createAnd();

          isEverybodyAgrees.effect(true);
          isEverybodyAgrees.effect(false);

          isEverybodyAgrees.subscribe(result => {
            if (result === false) {
              done();
            }
          });
        }));

      test('should return true if all effects are true', () =>
        new Promise<void>(done => {
          let isEverybodyAgrees = Reducer.createAnd();

          isEverybodyAgrees.effect(true);
          isEverybodyAgrees.effect(true);

          isEverybodyAgrees.subscribe(result => {
            if (result === true) {
              done();
            }
          });
        }));
    });

    describe(`Or Question`, () => {
      test('should return false if there is no effect', () =>
        new Promise<void>(done => {
          let isThereAnyone = Reducer.createOr();

          isThereAnyone.subscribe(result => {
            if (result === false) {
              done();
            }
          });
        }));

      test('should return false if there is no effect with true', () =>
        new Promise<void>(done => {
          let isThereAnyone = Reducer.createOr();

          isThereAnyone.effect(false);
          isThereAnyone.effect(false);

          isThereAnyone.subscribe(result => {
            if (result === false) {
              done();
            }
          });
        }));

      test('should return true if is at least one effect with true', () =>
        new Promise<void>(done => {
          let isThereAnyone = Reducer.createOr();

          isThereAnyone.effect(false);
          isThereAnyone.effect(true);

          isThereAnyone.subscribe(result => {
            if (result === true) {
              done();
            }
          });
        }));
    });

    describe(`Sum Reducer`, () => {
      test('should return 0 if there is no effect', () =>
        new Promise<void>(done => {
          let sumReducer = Reducer.createSum();

          sumReducer.subscribe(sum => {
            if (sum === 0) {
              done();
            }
          });
        }));

      test('should return sum of the effects', () =>
        new Promise<void>(done => {
          let sumReducer = Reducer.createSum();

          sumReducer.effect(5);
          let temporaryEffect = sumReducer.effect(3);
          sumReducer.effect(2);
          temporaryEffect.destroy();
          sumReducer.effect(-4);

          sumReducer.subscribe(sum => {
            if (sum === 3) {
              done();
            }
          });
        }));
    });

    describe(`Collect Effects Reducer`, () => {
      test('should return empty array if there is no effect', () =>
        new Promise<void>(done => {
          let collector = Reducer.createCollector();

          collector.subscribe(result => {
            if (Array.isArray(result) && result.length === 0) {
              done();
            }
          });
        }));

      test(`should return array of the listener's responses`, () =>
        new Promise<void>(done => {
          let collector = Reducer.createCollector<string>();

          collector.effect('a');
          collector.effect('b');
          collector.effect('c');

          collector.subscribe(result => {
            if (Array.isArray(result) && result.length === 3) {
              if (result.indexOf('a') >= 0 && result.indexOf('b') >= 0 && result.indexOf('c') >= 0) {
                done();
              }
            }
          });
        }));
    });

    describe(`Object Creator Reducer`, () => {
      test('should return initial value if there is no effect', () =>
        new Promise<void>(done => {
          let collector = Reducer.createObjectCreator<{ value: string }>({ initial: { value: 'a' } });

          collector.subscribe(result => {
            if (result && result.value === 'a') {
              done();
            }
          });
        }));

      test('should update final value if there is an effect', () =>
        new Promise<void>(done => {
          let collector = Reducer.createObjectCreator<{ value: string }>({ initial: { value: 'a' } });
          collector.effect({ key: 'value', value: 'b' });

          collector.subscribe(result => {
            if (result && result.value === 'b') {
              done();
            }
          });
        }));

      test('should not update final value if there is another effect already exist', () =>
        new Promise<void>(done => {
          // Listen console.error and avoid it
          let spy = vi.spyOn(console, 'error').mockImplementation(() => {});

          let collector = Reducer.createObjectCreator<{ value: string }>({ initial: { value: 'a' } });
          collector.effect({ key: 'value', value: 'b' });
          collector.effect({ key: 'value', value: 'c' });

          collector.subscribe(result => {
            if (result && result.value === 'b') {
              done();
            }
          });
          spy.mockRestore();
        }));

      test('should work with combination of effects', () =>
        new Promise<void>(done => {
          let collector = Reducer.createObjectCreator<{ v1: string; v2: string; v3: string }>({
            initial: {
              v1: '1',
              v2: 'a',
              v3: 'initial'
            }
          });
          collector.effect({ key: 'v1', value: '2' });
          collector.effect({ key: 'v2', value: 'b' });

          collector.subscribe(result => {
            if (result && result.v1 === '2' && result.v2 === 'b' && result.v3 === 'initial') {
              done();
            }
          });
        }));
    });
  });

  describe(`Current Value`, () => {
    test('basic', () => {
      let reducer = Reducer.createSum();
      expect(reducer.value).toEqual(0);
    });

    test('after multiple operations', () => {
      let reducer = Reducer.createSum();
      let effect = reducer.effect(2);
      reducer.effect(3);
      effect.destroy();
      reducer.effect(4);
      expect(reducer.value).toEqual(7);
    });
  });

  describe(`Wait Until`, () => {
    let reducer: Reducer<boolean, boolean>;

    beforeEach(() => {
      reducer = Reducer.createOr();
    });

    test('wait until spesific data', async () => {
      setTimeout(() => {
        reducer.effect(true);
      }, 1);
      let nextNotification = await reducer.waitUntil(true);
      expect(nextNotification).toEqual(true);
    });

    test('wait until spesific data should trigger immidiately if current data is equal', async () => {
      reducer.effect(true);
      let nextNotification = await reducer.waitUntil(true);
      expect(nextNotification).toEqual(true);
    });

    test('wait until undefined should trigger immidiately if current data is equal', async () => {
      let nextNotification = await reducer.waitUntil(false);
      expect(nextNotification).toEqual(false);
    });
  });
});
