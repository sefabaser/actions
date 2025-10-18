import { beforeEach, describe, expect, test } from 'vitest';

import { Action } from './action';

class SampleModel {
  testData = '';
}

describe(`Action`, () => {
  describe(`Basics`, () => {
    let action: Action<SampleModel>;

    beforeEach(() => {
      action = new Action<SampleModel>();
    });

    test('should be definable', () => {
      expect(action).toBeDefined();
    });

    test('triggerring without listeners', () =>
      new Promise<void>(done => {
        action.trigger({ testData: 'sample' });
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

        action.trigger({ testData: 'sample' });
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
        action.trigger({ testData: 'sample' });

        setTimeout(() => {
          if (!triggered) {
            done();
          }
        }, 0);
      }));

    test('clone before notification', () => {
      let action = new Action<SampleModel>({ clone: true });

      let receivedData: any;
      action
        .subscribe(data => {
          receivedData = data;
        })
        .attachToRoot();

      let data = { testData: 'sample' };
      action.trigger(data);
      expect(receivedData === data).toBeFalsy();
    });
  });
});
