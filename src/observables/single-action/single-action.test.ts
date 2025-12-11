import { beforeEach, describe, expect, test } from 'vitest';

import { SingleAction } from './single-action';

class SampleModel {
  testData = '';
}

describe(`SingleAction`, () => {
  let action: SingleAction<SampleModel>;

  beforeEach(() => {
    action = new SingleAction<SampleModel>();
  });

  describe(`Basics`, () => {
    test('should be definable', () => {
      expect(action).toBeDefined();
    });

    test('triggerring without listeners', () =>
      new Promise<void>(done => {
        action.resolve({ testData: 'sample' });
        done();
      }));

    test('should notify listeners', () =>
      new Promise<void>(done => {
        let listener1 = false;
        let listener2 = false;

        action
          .subscribe(message => {
            if (message && message.testData === 'sample') {
              listener1 = true;
              if (listener2) {
                done();
              }
            }
          })
          .attachToRoot();

        action
          .subscribe(message => {
            if (message && message.testData === 'sample') {
              listener2 = true;
              if (listener1) {
                done();
              }
            }
          })
          .attachToRoot();

        action.resolve({ testData: 'sample' });
      }));

    test('should not notify destroyed listeners', () =>
      new Promise<void>(done => {
        let triggered = false;
        let subscription = action
          .subscribe(_ => {
            triggered = true;
          })
          .attachToRoot();
        subscription.destroy();
        action.resolve({ testData: 'sample' });

        setTimeout(() => {
          if (!triggered) {
            done();
          }
        }, 0);
      }));

    test('clone before notification', () => {
      let action2 = new SingleAction<SampleModel>({ clone: true });

      let receivedData: any;
      action2
        .subscribe(received => {
          receivedData = received;
        })
        .attachToRoot();

      let data = { testData: 'sample' };
      action2.resolve(data);
      expect(receivedData === data).toBeFalsy();
    });
  });

  describe('Behaviour', () => {
    test('should not trigger listeners before resolve', () => {
      let listenerTriggered = false;

      action
        .subscribe(() => {
          listenerTriggered = true;
        })
        .attachToRoot();

      expect(listenerTriggered).toBeFalsy();
    });

    test('should trigger listeners instantly if resolved', () => {
      let listenerTriggered = false;

      action
        .subscribe(() => {
          listenerTriggered = true;
        })
        .attachToRoot();

      action.resolve({ testData: 'sample' });

      expect(listenerTriggered).toBeTruthy();
    });

    test('multiple resolves should not take any action', () => {
      let heap: unknown[] = [];

      action
        .subscribe(message => {
          heap.push(message);
        })
        .attachToRoot();

      action.resolve({ testData: 'sample1' });
      action.resolve({ testData: 'sample2' });
      action.resolve({ testData: 'sample3' });
      action.resolve({ testData: 'sample4' });
      action.resolve({ testData: 'sample5' });

      expect(heap).toEqual([{ testData: 'sample1' }]);
    });

    test('resolve void', () => {
      let voidAction = new SingleAction();
      voidAction.resolve();

      let listenerTriggered = false;

      voidAction
        .subscribe(() => {
          listenerTriggered = true;
        })
        .attachToRoot();

      expect(listenerTriggered).toBeTruthy();
    });
  });

  describe('Notifier', () => {
    test('should not trigger listeners before resolve', () => {
      let listenerTriggered = false;

      action.notifier
        .subscribe(() => {
          listenerTriggered = true;
        })
        .attachToRoot();

      expect(listenerTriggered).toBeFalsy();
    });

    test('should trigger listeners instantly if resolved', () => {
      let listenerTriggered = false;

      action.notifier
        .subscribe(() => {
          listenerTriggered = true;
        })
        .attachToRoot();

      action.resolve({ testData: 'sample' });

      expect(listenerTriggered).toBeTruthy();
    });

    test('multiple resolves should not take any action', () => {
      let heap: unknown[] = [];

      action.notifier
        .subscribe(message => {
          heap.push(message);
        })
        .attachToRoot();

      action.resolve({ testData: 'sample1' });
      action.resolve({ testData: 'sample2' });
      action.resolve({ testData: 'sample3' });
      action.resolve({ testData: 'sample4' });
      action.resolve({ testData: 'sample5' });

      expect(heap).toEqual([{ testData: 'sample1' }]);
    });

    test('resolve void', () => {
      let voidAction = new SingleAction();
      voidAction.resolve();

      let listenerTriggered = false;

      voidAction.notifier
        .subscribe(() => {
          listenerTriggered = true;
        })
        .attachToRoot();

      expect(listenerTriggered).toBeTruthy();
    });
  });
});
