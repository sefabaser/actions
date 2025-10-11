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
      reducer.subscribe(() => {}).attachToRoot();
      expect(reducer['notificationHandler']['listenersMap'].size).toEqual(1);
    });

    test('should be able to use subscribe only new changes', () => {
      let triggered = false;
      reducer
        .subscribe(
          () => {
            triggered = true;
          },
          { listenOnlyNewChanges: true }
        )
        .attachToRoot();

      expect(triggered).toEqual(false);
      reducer.effect().attachToRoot();
      expect(triggered).toEqual(true);
    });

    test('should be destroyable', () => {
      let subscription = reducer.subscribe(() => {});
      subscription.destroy();
      expect(reducer['notificationHandler']['listenersMap'].size).toEqual(0);
    });

    test('triggerring without listeners', () => {
      expect(() => reducer.effect().attachToRoot()).not.toThrow();
    });

    test('should notify listeners', () =>
      new Promise<void>(done => {
        let listener1 = false;
        let listener2 = false;

        reducer
          .subscribe(response => {
            if (response) {
              listener1 = true;
              if (listener2) {
                done();
              }
            }
          })
          .attachToRoot();

        reducer
          .subscribe(response => {
            if (response) {
              listener2 = true;
              if (listener1) {
                done();
              }
            }
          })
          .attachToRoot();

        reducer.effect().attachToRoot();
      }));

    test('should not notify destroyed listeners', () =>
      new Promise<void>(done => {
        let triggered: boolean;
        let subscription = reducer
          .subscribe(_ => {
            triggered = true;
          })
          .attachToRoot();
        triggered = false; // destroy initial trigger after subscription

        subscription.destroy();

        reducer.effect().attachToRoot();

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
        reducer
          .subscribe(response => {
            if (response === false) {
              done();
            }
          })
          .attachToRoot();
      }));

    test('should always notify listeners only on change', () => {
      let blocked = false;
      let triggerCount = 0;
      reducer
        .subscribe(response => {
          blocked = response;
          triggerCount++;
        })
        .attachToRoot();

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
      reducer.effect().attachToRoot();
      let blocked = false;

      reducer
        .subscribe(response => {
          blocked = response;
        })
        .attachToRoot();

      expect(blocked).toEqual(true);
    });
  });

  describe(`Reduce Function`, () => {
    test('should trigger initial call', () =>
      new Promise<void>(done => {
        new Reducer<boolean, void>(change => {
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

        reducer.effect(true).attachToRoot();
      }));

    test('should trigger update call', () =>
      new Promise<void>(done => {
        let reducer = new Reducer<boolean, void>(change => {
          if (change.type === 'update') {
            done();
          }
        });

        let effect = reducer.effect(true).attachToRoot();
        effect.update(false);
      }));

    test('should trigger destroy call', () =>
      new Promise<void>(done => {
        let reducer = new Reducer<boolean, void>(change => {
          if (change.type === 'destroy') {
            done();
          }
        });

        let effect = reducer.effect(true).attachToRoot();
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

      reducer.effect(true).attachToRoot();
      reducer.effect(true).attachToRoot();

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

      let effect = reducer.effect(true).attachToRoot();
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

      let effect = reducer.effect(true).attachToRoot();
      effect.update(false);
      effect.destroy();

      expect(successful).toEqual(true);
    });

    test('updating effect should throw error after destroyd', () => {
      let triggerCount = 0;
      let reducer = new Reducer<void, void>(_ => {
        triggerCount++;
      });

      let effect = reducer.effect().attachToRoot();
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

          existanceChecker
            .subscribe(result => {
              if (result === false) {
                done();
              }
            })
            .attachToRoot();
        }));

      test('should return false all effects are destroyd', () =>
        new Promise<void>(done => {
          let existanceChecker = Reducer.createExistenceChecker();

          let firstEffect = existanceChecker.effect().attachToRoot();
          let secondEffect = existanceChecker.effect().attachToRoot();
          firstEffect.destroy();
          secondEffect.destroy();

          existanceChecker
            .subscribe(result => {
              if (result === false) {
                done();
              }
            })
            .attachToRoot();
        }));

      test('should return true if there is at least one effect', () =>
        new Promise<void>(done => {
          let existanceChecker = Reducer.createExistenceChecker();

          let firstEffect = existanceChecker.effect().attachToRoot();
          existanceChecker.effect().attachToRoot();
          firstEffect.destroy();

          existanceChecker
            .subscribe(result => {
              if (result === true) {
                done();
              }
            })
            .attachToRoot();
        }));
    });

    describe(`And Question`, () => {
      test('should return true if there is no effect', () =>
        new Promise<void>(done => {
          let isEverybodyAgrees = Reducer.createAnd();

          isEverybodyAgrees
            .subscribe(result => {
              if (result === true) {
                done();
              }
            })
            .attachToRoot();
        }));

      test('should return false if there is at least one effect with true', () =>
        new Promise<void>(done => {
          let isEverybodyAgrees = Reducer.createAnd();

          isEverybodyAgrees.effect(true).attachToRoot();
          isEverybodyAgrees.effect(false).attachToRoot();

          isEverybodyAgrees
            .subscribe(result => {
              if (result === false) {
                done();
              }
            })
            .attachToRoot();
        }));

      test('should return true if all effects are true', () =>
        new Promise<void>(done => {
          let isEverybodyAgrees = Reducer.createAnd();

          isEverybodyAgrees.effect(true).attachToRoot();
          isEverybodyAgrees.effect(true).attachToRoot();

          isEverybodyAgrees
            .subscribe(result => {
              if (result === true) {
                done();
              }
            })
            .attachToRoot();
        }));
    });

    describe(`Or Question`, () => {
      test('should return false if there is no effect', () =>
        new Promise<void>(done => {
          let isThereAnyone = Reducer.createOr();

          isThereAnyone
            .subscribe(result => {
              if (result === false) {
                done();
              }
            })
            .attachToRoot();
        }));

      test('should return false if there is no effect with true', () =>
        new Promise<void>(done => {
          let isThereAnyone = Reducer.createOr();

          isThereAnyone.effect(false).attachToRoot();
          isThereAnyone.effect(false).attachToRoot();

          isThereAnyone
            .subscribe(result => {
              if (result === false) {
                done();
              }
            })
            .attachToRoot();
        }));

      test('should return true if is at least one effect with true', () =>
        new Promise<void>(done => {
          let isThereAnyone = Reducer.createOr();

          isThereAnyone.effect(false).attachToRoot();
          isThereAnyone.effect(true).attachToRoot();

          isThereAnyone
            .subscribe(result => {
              if (result === true) {
                done();
              }
            })
            .attachToRoot();
        }));
    });

    describe(`Sum Reducer`, () => {
      test('should return 0 if there is no effect', () =>
        new Promise<void>(done => {
          let sumReducer = Reducer.createSum();

          sumReducer
            .subscribe(sum => {
              if (sum === 0) {
                done();
              }
            })
            .attachToRoot();
        }));

      test('should return sum of the effects', () =>
        new Promise<void>(done => {
          let sumReducer = Reducer.createSum();

          sumReducer.effect(5).attachToRoot();
          let temporaryEffect = sumReducer.effect(3);
          sumReducer.effect(2).attachToRoot();
          temporaryEffect.destroy();
          sumReducer.effect(-4).attachToRoot();

          sumReducer
            .subscribe(sum => {
              if (sum === 3) {
                done();
              }
            })
            .attachToRoot();
        }));
    });

    describe(`Collect Effects Reducer`, () => {
      test('should return empty array if there is no effect', () =>
        new Promise<void>(done => {
          let collector = Reducer.createCollector();

          collector
            .subscribe(result => {
              if (Array.isArray(result) && result.length === 0) {
                done();
              }
            })
            .attachToRoot();
        }));

      test(`should return array of the listener's responses`, () =>
        new Promise<void>(done => {
          let collector = Reducer.createCollector<string>();

          collector.effect('a').attachToRoot();
          collector.effect('b').attachToRoot();
          collector.effect('c').attachToRoot();

          collector
            .subscribe(result => {
              if (Array.isArray(result) && result.length === 3) {
                if (result.indexOf('a') >= 0 && result.indexOf('b') >= 0 && result.indexOf('c') >= 0) {
                  done();
                }
              }
            })
            .attachToRoot();
        }));
    });

    describe(`Object Creator Reducer`, () => {
      test('should return initial value if there is no effect', () =>
        new Promise<void>(done => {
          let collector = Reducer.createObjectCreator<{ value: string }>({ initial: { value: 'a' } });

          collector
            .subscribe(result => {
              if (result && result.value === 'a') {
                done();
              }
            })
            .attachToRoot();
        }));

      test('should update final value if there is an effect', () =>
        new Promise<void>(done => {
          let collector = Reducer.createObjectCreator<{ value: string }>({ initial: { value: 'a' } });
          collector.effect({ key: 'value', value: 'b' }).attachToRoot();

          collector
            .subscribe(result => {
              if (result && result.value === 'b') {
                done();
              }
            })
            .attachToRoot();
        }));

      test('should not update final value if there is another effect already exist', () =>
        new Promise<void>(done => {
          // Listen console.error and avoid it
          let spy = vi.spyOn(console, 'error').mockImplementation(() => {});

          let collector = Reducer.createObjectCreator<{ value: string }>({ initial: { value: 'a' } });
          collector.effect({ key: 'value', value: 'b' }).attachToRoot();
          collector.effect({ key: 'value', value: 'c' }).attachToRoot();

          collector
            .subscribe(result => {
              if (result && result.value === 'b') {
                done();
              }
            })
            .attachToRoot();
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
          collector.effect({ key: 'v1', value: '2' }).attachToRoot();
          collector.effect({ key: 'v2', value: 'b' }).attachToRoot();

          collector
            .subscribe(result => {
              if (result && result.v1 === '2' && result.v2 === 'b' && result.v3 === 'initial') {
                done();
              }
            })
            .attachToRoot();
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
      let effect = reducer.effect(2).attachToRoot();
      reducer.effect(3).attachToRoot();
      effect.destroy();
      reducer.effect(4).attachToRoot();
      expect(reducer.value).toEqual(7);
    });
  });

  describe(`Wait Until`, () => {
    let reducer: Reducer<boolean, boolean>;

    beforeEach(() => {
      reducer = Reducer.createOr();
    });

    test('wait until spesific data', async () => {
      let resolvedWith: boolean | undefined;

      reducer
        .waitUntil(true, data => {
          resolvedWith = data;
        })
        .attachToRoot();

      let effectChannel = reducer.effect(false).attachToRoot();
      expect(resolvedWith).toEqual(undefined);
      expect(reducer['untilListeners'].size).toEqual(1);

      effectChannel.update(true);
      expect(resolvedWith).toEqual(true);
      expect(reducer['untilListeners'].size).toEqual(0);
    });

    test('wait until callback throws error', () => {
      let consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      reducer.effect(true).attachToRoot();

      expect(() =>
        reducer
          .waitUntil(true, () => {
            throw new Error('test error');
          })
          .attachToRoot()
      ).not.toThrow();

      expect(consoleErrorSpy).toBeCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
