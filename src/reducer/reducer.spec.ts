import { Reducer } from './reducer';

describe(`Reducer`, () => {
  describe(`Basics`, () => {
    let reducer: Reducer<void, boolean>;

    beforeEach(() => {
      let blockers = new Set<number>();
      reducer = new Reducer<void, boolean>(change => {
        if (change.type === 'effect' || change.type === 'update') {
          blockers.add(change.id);
        } else if (change.type === 'remove') {
          blockers.delete(change.id);
        }
        return blockers.size > 0;
      });
    });

    it('should be definable', () => {
      expect(reducer).toBeDefined();
    });

    it('should be subscribable', () => {
      reducer.subscribe(() => {});
      expect(reducer['notificationHandler']['listenersMap'].size).toEqual(1);
    });

    it('should be unsubscribable', () => {
      let subscription = reducer.subscribe(() => {});
      subscription.unsubscribe();
      expect(reducer['notificationHandler']['listenersMap'].size).toEqual(0);
    });

    it('triggerring without listeners', done => {
      reducer.effect();
      done();
    });

    it('should notify listeners', done => {
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
    });

    it('should not notify unsubscribed listeners', done => {
      let triggered: boolean;
      let subscription = reducer.subscribe(change => {
        triggered = true;
      });
      triggered = false; // remove initial trigger after subscription

      subscription.unsubscribe();

      reducer.effect();

      setTimeout(() => {
        if (!triggered) {
          done();
        }
      }, 0);
    });
  });

  describe(`Feeding Mechanism`, () => {
    let reducer: Reducer<void, boolean>;

    beforeEach(() => {
      let blockers = new Set<number>();
      reducer = new Reducer<void, boolean>(change => {
        if (change.type === 'effect' || change.type === 'update') {
          blockers.add(change.id);
        } else if (change.type === 'remove') {
          blockers.delete(change.id);
        }
        return blockers.size > 0;
      });
    });

    it('subscribing without any effecter should return base value', done => {
      reducer.subscribe(response => {
        if (response === false) {
          done();
        }
      });
    });

    it('should always notify listeners only on change', () => {
      let blocked: boolean = false;
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

      blocker1.remove(); // still there is blocker2 it shouldn't effect anything

      expect(blocked).toEqual(true);
      expect(triggerCount).toEqual(2);

      blocker2.remove();

      expect(blocked).toEqual(false);
      expect(triggerCount).toEqual(3);
    });

    it('should always be persistent, always gives the last broadcasted value to new listeners', () => {
      reducer.effect();
      let blocked: boolean = false;

      reducer.subscribe(response => {
        blocked = response;
      });

      expect(blocked).toEqual(true);
    });
  });

  describe(`Reduce Function`, () => {
    it('should trigger initial call', done => {
      let reducer = new Reducer<boolean, void>(change => {
        if (change.type === 'initial') {
          done();
        }
      });
    });

    it('should trigger effect call', done => {
      let reducer = new Reducer<boolean, void>(change => {
        if (change.type === 'effect') {
          done();
        }
      });

      reducer.effect(true);
    });

    it('should trigger update call', done => {
      let reducer = new Reducer<boolean, void>(change => {
        if (change.type === 'update') {
          done();
        }
      });

      let effect = reducer.effect(true);
      effect.update(false);
    });

    it('should trigger remove call', done => {
      let reducer = new Reducer<boolean, void>(change => {
        if (change.type === 'remove') {
          done();
        }
      });

      let effect = reducer.effect(true);
      effect.remove();
    });

    it('should give unique id to different effecters', () => {
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

    it('should give same unique id to all operations of the same effecter', () => {
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
      effect.remove();

      expect(successful).toEqual(true);
    });

    it('should correct previous and current values of the change', () => {
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
        } else if (change.type === 'remove') {
          if (change.current !== undefined || change.previous !== false) {
            successful = false;
          }
        }

        return !!change.current;
      });

      let effect = reducer.effect(true);
      effect.update(false);
      effect.remove();

      expect(successful).toEqual(true);
    });

    it('should not take effect after removed', () => {
      let triggerCount = 0;
      let reducer = new Reducer<void, void>(change => {
        triggerCount++;
      });

      let effect = reducer.effect();
      expect(triggerCount).toEqual(2); // one initial and one after effect

      effect.remove();
      expect(triggerCount).toEqual(3);

      effect.update();
      effect.remove();
      expect(triggerCount).toEqual(3);
    });
  });

  describe(`Factory`, () => {
    describe(`Existence Checker Reducer`, () => {
      it('should return false if there is no effect', done => {
        let existanceChecker = Reducer.createExistenceChecker();

        existanceChecker.subscribe(result => {
          if (result === false) {
            done();
          }
        });
      });

      it('should return false all effects are removed', done => {
        let existanceChecker = Reducer.createExistenceChecker();

        let firstEffect = existanceChecker.effect();
        let secondEffect = existanceChecker.effect();
        firstEffect.remove();
        secondEffect.remove();

        existanceChecker.subscribe(result => {
          if (result === false) {
            done();
          }
        });
      });

      it('should return true if there is at least one effect', done => {
        let existanceChecker = Reducer.createExistenceChecker();

        let firstEffect = existanceChecker.effect();
        existanceChecker.effect();
        firstEffect.remove();

        existanceChecker.subscribe(result => {
          if (result === true) {
            done();
          }
        });
      });
    });

    describe(`And Question`, () => {
      it('should return true if there is no effect', done => {
        let isEverybodyAgrees = Reducer.createAnd();

        isEverybodyAgrees.subscribe(result => {
          if (result === true) {
            done();
          }
        });
      });

      it('should return false if there is at least one effect with true', done => {
        let isEverybodyAgrees = Reducer.createAnd();

        isEverybodyAgrees.effect(true);
        isEverybodyAgrees.effect(false);

        isEverybodyAgrees.subscribe(result => {
          if (result === false) {
            done();
          }
        });
      });

      it('should return true if all effects are true', done => {
        let isEverybodyAgrees = Reducer.createAnd();

        isEverybodyAgrees.effect(true);
        isEverybodyAgrees.effect(true);

        isEverybodyAgrees.subscribe(result => {
          if (result === true) {
            done();
          }
        });
      });
    });

    describe(`Or Question`, () => {
      it('should return false if there is no effect', done => {
        let isThereAnyone = Reducer.createOr();

        isThereAnyone.subscribe(result => {
          if (result === false) {
            done();
          }
        });
      });

      it('should return false if there is no effect with true', done => {
        let isThereAnyone = Reducer.createOr();

        isThereAnyone.effect(false);
        isThereAnyone.effect(false);

        isThereAnyone.subscribe(result => {
          if (result === false) {
            done();
          }
        });
      });

      it('should return true if is at least one effect with true', done => {
        let isThereAnyone = Reducer.createOr();

        isThereAnyone.effect(false);
        isThereAnyone.effect(true);

        isThereAnyone.subscribe(result => {
          if (result === true) {
            done();
          }
        });
      });
    });

    describe(`Sum Reducer`, () => {
      it('should return 0 if there is no effect', done => {
        let sumReducer = Reducer.createSum();

        sumReducer.subscribe(sum => {
          if (sum === 0) {
            done();
          }
        });
      });

      it('should return sum of the effects', done => {
        let sumReducer = Reducer.createSum();

        sumReducer.effect(5);
        let temporaryEffect = sumReducer.effect(3);
        sumReducer.effect(2);
        temporaryEffect.remove();
        sumReducer.effect(-4);

        sumReducer.subscribe(sum => {
          if (sum === 3) {
            done();
          }
        });
      });
    });

    describe(`Collect Effects Reducer`, () => {
      it('should return empty array if there is no effect', done => {
        let collector = Reducer.createCollector();

        collector.subscribe(result => {
          if (Array.isArray(result) && result.length === 0) {
            done();
          }
        });
      });

      it(`should return array of the listener's responses`, done => {
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
      });
    });

    describe(`Object Creator Reducer`, () => {
      it('should return initial value if there is no effect', done => {
        let collector = Reducer.createObjectCreator<{ value: string }>({ initial: { value: 'a' } });

        collector.subscribe(result => {
          if (result && result.value === 'a') {
            done();
          }
        });
      });

      it('should update final value if there is an effect', done => {
        let collector = Reducer.createObjectCreator<{ value: string }>({ initial: { value: 'a' } });
        collector.effect({ key: 'value', value: 'b' });

        collector.subscribe(result => {
          if (result && result.value === 'b') {
            done();
          }
        });
      });

      it('should not update final value if there is another effect already exist', done => {
        spyOn(console, 'error');

        let collector = Reducer.createObjectCreator<{ value: string }>({ initial: { value: 'a' } });
        collector.effect({ key: 'value', value: 'b' });
        collector.effect({ key: 'value', value: 'c' });

        collector.subscribe(result => {
          if (result && result.value === 'b') {
            done();
          }
        });
      });

      it('should work with combination of effects', done => {
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
      });
    });
  });
});
