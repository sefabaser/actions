import { beforeEach, describe, expect, test } from 'vitest';

import { Attachable } from '../attachable/attachable';
import { AttachmentTargetStore } from '../attachable/helpers/attachment-target.store';
import { Reference } from './reference';

describe('Reference', () => {
  let parent: Attachable;

  beforeEach(() => {
    AttachmentTargetStore.hardReset();
    parent = new Attachable().attachToRoot();
  });

  describe('Basics', () => {
    test('definable', () => {
      let refVar = new Reference().attach(parent);
      expect(refVar).toBeDefined();
    });

    test('initial value is undefined', () => {
      let refVar = new Reference().attach(parent);
      expect(refVar.value).toBeUndefined();
    });

    test('can set and get value', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;
      expect(refVar.value).toBe(target.id);
    });

    test('can set value to undefined', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;
      refVar.value = undefined;
      expect(refVar.value).toBeUndefined();
    });

    test('has listener count', () => {
      let refVar = new Reference().attach(parent);
      expect(refVar.listenerCount).toBe(0);

      refVar.subscribe(() => {}).attachToRoot();
      expect(refVar.listenerCount).toBe(1);
    });

    test('can use attachToRoot', () => {
      let refVar = new Reference().attachToRoot();
      expect(refVar).toBeDefined();
      expect(refVar.value).toBeUndefined();
    });
  });

  describe('Reference behavior', () => {
    test('when referenced attachable is destroyed, value becomes undefined', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;
      expect(refVar.value).toBe(target.id);

      target.destroy();
      expect(refVar.value).toBeUndefined();
    });

    test('changing reference cleans up old subscription', () => {
      let refVar = new Reference().attach(parent);
      let target1 = new Attachable().attachToRoot();
      let target2 = new Attachable().attachToRoot();

      refVar.value = target1.id;
      refVar.value = target2.id;

      target1.destroy();
      expect(refVar.value).toBe(target2.id);

      target2.destroy();
      expect(refVar.value).toBeUndefined();
    });

    test('setting to undefined cleans up subscription', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;
      refVar.value = undefined;

      target.destroy();
      expect(refVar.value).toBeUndefined();
    });

    test('setting same value does not create duplicate subscriptions', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;
      refVar.value = target.id;

      target.destroy();
      expect(refVar.value).toBeUndefined();
    });
  });

  describe('Subscription', () => {
    test('subscribe receives initial value', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;

      let receivedValue: string | undefined;
      refVar
        .subscribe(value => {
          receivedValue = value;
        })
        .attachToRoot();

      expect(receivedValue).toBe(target.id);
    });

    test('subscribe notified when value changes', () => {
      let refVar = new Reference().attach(parent);
      let target1 = new Attachable().attachToRoot();
      let target2 = new Attachable().attachToRoot();

      let receivedValues: (string | undefined)[] = [];
      refVar
        .subscribe(value => {
          receivedValues.push(value);
        })
        .attachToRoot();

      refVar.value = target1.id;
      refVar.value = target2.id;

      expect(receivedValues).toEqual([undefined, target1.id, target2.id]);
    });

    test('subscribe notified when referenced attachable is destroyed', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;

      let receivedValues: (string | undefined)[] = [];
      refVar
        .subscribe(value => {
          receivedValues.push(value);
        })
        .attachToRoot();

      target.destroy();

      expect(receivedValues).toEqual([target.id, undefined]);
    });

    test('multiple subscribers all notified', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      let received1: string | undefined;
      let received2: string | undefined;

      refVar
        .subscribe(value => {
          received1 = value;
        })
        .attachToRoot();
      refVar
        .subscribe(value => {
          received2 = value;
        })
        .attachToRoot();

      refVar.value = target.id;

      expect(received1).toBe(target.id);
      expect(received2).toBe(target.id);
    });

    test('unsubscribed listeners not notified', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      let callCount = 0;
      let subscription = refVar
        .subscribe(() => {
          callCount++;
        })
        .attachToRoot();

      subscription.destroy();
      refVar.value = target.id;

      expect(callCount).toBe(1);
    });
  });

  describe('Wait until', () => {
    test('wait until specific value', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      let triggered = false;
      refVar
        .waitUntil(target.id, () => {
          triggered = true;
        })
        .attachToRoot();

      expect(triggered).toBe(false);
      refVar.value = target.id;
      expect(triggered).toBe(true);
    });

    test('wait until undefined', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;

      let triggered = false;
      refVar
        .waitUntil(undefined, () => {
          triggered = true;
        })
        .attachToRoot();

      expect(triggered).toBe(false);
      refVar.value = undefined;
      expect(triggered).toBe(true);
    });

    test('wait until triggered immediately if already at value', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;

      let triggered = false;
      refVar
        .waitUntil(target.id, () => {
          triggered = true;
        })
        .attachToRoot();

      expect(triggered).toBe(true);
    });

    test('wait until next', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      let receivedValue: string | undefined;
      refVar
        .waitUntilNext(value => {
          receivedValue = value;
        })
        .attachToRoot();

      expect(receivedValue).toBeUndefined();
      refVar.value = target.id;
      expect(receivedValue).toBe(target.id);
    });

    test('wait until next only triggers once', () => {
      let refVar = new Reference().attach(parent);
      let target1 = new Attachable().attachToRoot();
      let target2 = new Attachable().attachToRoot();

      let callCount = 0;
      refVar
        .waitUntilNext(() => {
          callCount++;
        })
        .attachToRoot();

      refVar.value = target1.id;
      refVar.value = target2.id;

      expect(callCount).toBe(1);
    });
  });

  describe('Edge cases', () => {
    test('destroyed parent cleans up reference subscription', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;
      parent.destroy();

      expect(refVar.value).toBe(target.id);
    });

    test('setting invalid id throws error', () => {
      let refVar = new Reference().attach(parent);

      expect(() => {
        refVar.value = 'invalid-id';
      }).toThrow('Attachable: attachable not found by id!');
    });

    test('notify on change behavior', () => {
      let refVar = new Reference().attach(parent);
      let target1 = new Attachable().attachToRoot();
      let target2 = new Attachable().attachToRoot();

      let callCount = 0;
      refVar
        .subscribe(() => {
          callCount++;
        })
        .attachToRoot();

      refVar.value = target1.id;
      expect(callCount).toBe(2);

      refVar.value = target1.id;
      expect(callCount).toBe(2);

      refVar.value = target2.id;
      expect(callCount).toBe(3);
    });

    test('cascading reference destruction', () => {
      let refVar1 = new Reference().attach(parent);
      let refVar2 = new Reference().attach(parent);

      let target1 = new Attachable().attachToRoot();
      let target2 = new Attachable().attach(target1);

      refVar1.value = target1.id;
      refVar2.value = target2.id;

      target1.destroy();

      expect(refVar1.value).toBeUndefined();
      expect(refVar2.value).toBeUndefined();
    });
  });

  describe('Attachment behavior', () => {
    test('reference is destroyed when parent is destroyed', () => {
      let refVar = new Reference().attach(parent);
      expect(refVar.destroyed).toBe(false);

      parent.destroy();
      expect(refVar.destroyed).toBe(true);
    });

    test('cannot attach twice', () => {
      let refVar = new Reference().attach(parent);

      expect(() => {
        refVar.attach(parent);
      }).toThrow('LightweightAttachable: The object is already attached to something!');
    });

    test('cannot call attachToRoot after attach', () => {
      let refVar = new Reference().attach(parent);

      expect(() => {
        refVar.attachToRoot();
      }).toThrow('LightweightAttachable: The object is already attached to something!');
    });

    test('onDestroyed subscription inherits attachment from Reference', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;

      parent.destroy();
      expect(refVar.destroyed).toBe(true);
      expect(refVar.value).toBe(target.id);
    });

    test('onDestroyed subscription uses attachToRoot when reference uses attachToRoot', () => {
      let refVar = new Reference().attachToRoot();
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;

      target.destroy();
      expect(refVar.value).toBeUndefined();
    });

    test('changing value after reference attached properly reattaches onDestroyed subscription', () => {
      let refVar = new Reference().attach(parent);
      let target1 = new Attachable().attachToRoot();
      let target2 = new Attachable().attachToRoot();

      refVar.value = target1.id;
      refVar.value = target2.id;

      target1.destroy();
      expect(refVar.value).toBe(target2.id);

      target2.destroy();
      expect(refVar.value).toBeUndefined();
    });
  });
});
