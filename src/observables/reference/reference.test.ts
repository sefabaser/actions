import { beforeEach, describe, expect, test, vi } from 'vitest';

import { Attachable } from '../../attachable/attachable';
import { AttachmentTargetStore } from '../../attachable/helpers/attachment-target.store';
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
      vi.useFakeTimers();
      expect(() => {
        new Reference().attachToRoot();
        vi.runAllTimers();
      }).not.toThrow('Attachable: The object is not attached to anything!');
      vi.useRealTimers();
    });

    test('destroyed reference returns undefined for value', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;
      expect(refVar.value).toBe(target.id);

      refVar.destroy();
      expect(refVar.value).toBeUndefined();
    });

    test('destroyed reference returns 0 for listenerCount', () => {
      let refVar = new Reference().attach(parent);
      refVar.subscribe(() => {}).attachToRoot();

      expect(refVar.listenerCount).toBe(1);

      refVar.destroy();
      expect(refVar.listenerCount).toBe(0);
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

      expect(refVar['destroySubscription']).toBeDefined();
      let previousDestroySubscription = refVar['destroySubscription'];

      refVar.value = undefined;
      expect(previousDestroySubscription?.destroyed).toBeTruthy();
      expect(refVar['destroySubscription']).toBeUndefined();
    });

    test('setting same value does not create duplicate subscriptions', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;
      refVar.value = target.id;

      expect(target['_onDestroy']?.listenerCount).toBe(1);
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
      expect(target['_onDestroy']?.listenerCount).toBe(1);

      parent.destroy();
      expect(refVar.value).toBe(undefined);
      expect(target['_onDestroy']?.listenerCount).toBe(0);
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

  describe('Reference path', () => {
    test('can use path to extract id from object', () => {
      let refVar = new Reference<{ id: string }>({ path: 'id' }).attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = { id: target.id };
      expect(refVar.value).toEqual({ id: target.id });

      target.destroy();
      expect(refVar.value).toBeUndefined();
    });

    test('can use nested path to extract id from object', () => {
      let refVar = new Reference<{ user: { profile: { id: string } } }>({ path: 'user.profile.id' }).attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = {
        user: {
          profile: {
            id: target.id
          }
        }
      };

      expect(refVar.value).toEqual({
        user: {
          profile: {
            id: target.id
          }
        }
      });

      target.destroy();
      expect(refVar.value).toBeUndefined();
    });

    test('initial value with path works correctly', () => {
      let target = new Attachable().attachToRoot();
      let refVar = new Reference<{ id: string }>({
        path: 'id',
        initialValue: { id: target.id }
      }).attach(parent);

      expect(refVar.value).toEqual({ id: target.id });

      target.destroy();
      expect(refVar.value).toBeUndefined();
    });

    test('can change from one object to another', () => {
      let refVar = new Reference<{ id: string }>({ path: 'id' }).attach(parent);
      let target1 = new Attachable().attachToRoot();
      let target2 = new Attachable().attachToRoot();

      refVar.value = { id: target1.id };
      refVar.value = { id: target2.id };

      target1.destroy();
      expect(refVar.value).toEqual({ id: target2.id });

      target2.destroy();
      expect(refVar.value).toBeUndefined();
    });

    test('throws error when using object without path', () => {
      let refVar = new Reference<{ id: string }>(undefined as any).attach(parent);
      let target = new Attachable().attachToRoot();

      expect(() => {
        refVar.value = { id: target.id };
      }).toThrow('Reference: the value and the path is not matching. Value type: "object, path: "undefined"');
    });

    test('throws error when using string with path', () => {
      let refVar = new Reference<string>({ path: 'id' } as any).attach(parent);
      let target = new Attachable().attachToRoot();

      expect(() => {
        refVar.value = target.id;
      }).toThrow('Reference: the value and the path is not matching. Value type: "string, path: "id"');
    });

    test('subscribers notified when object reference destroyed', () => {
      let refVar = new Reference<{ id: string }>({ path: 'id' }).attach(parent);
      let target = new Attachable().attachToRoot();

      let heap: ({ id: string } | undefined)[] = [];
      refVar
        .subscribe(value => {
          heap.push(value);
        })
        .attachToRoot();

      refVar.value = { id: target.id };
      target.destroy();

      expect(heap).toEqual([undefined, { id: target.id }, undefined]);
    });

    test('path with additional object properties preserved', () => {
      interface UserData {
        id: string;
        name: string;
        age: number;
      }

      let refVar = new Reference<UserData>({ path: 'id' }).attach(parent);
      let target = new Attachable().attachToRoot();

      let userData: UserData = {
        id: target.id,
        name: 'John Doe',
        age: 30
      };

      refVar.value = userData;
      expect(refVar.value).toEqual(userData);

      target.destroy();
      expect(refVar.value).toBeUndefined();
    });

    test('can set to undefined to clear object reference', () => {
      let refVar = new Reference<{ id: string }>({ path: 'id' }).attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = { id: target.id };
      expect(refVar.value).toEqual({ id: target.id });

      refVar.value = undefined;
      expect(refVar.value).toBeUndefined();

      target.destroy();
      expect(refVar.value).toBeUndefined();
    });

    test('waitUntil works with object values', () => {
      let refVar = new Reference<{ id: string }>({ path: 'id' }).attach(parent);
      let target = new Attachable().attachToRoot();

      let triggered = false;
      let targetValue = { id: target.id };

      refVar
        .waitUntil(targetValue, () => {
          triggered = true;
        })
        .attachToRoot();

      expect(triggered).toBe(false);
      refVar.value = targetValue;
      expect(triggered).toBe(true);
    });

    test('waitUntilNext works with object values', () => {
      let refVar = new Reference<{ id: string }>({ path: 'id' }).attach(parent);
      let target = new Attachable().attachToRoot();

      let receivedValue: { id: string } | undefined;
      refVar
        .waitUntilNext(value => {
          receivedValue = value;
        })
        .attachToRoot();

      expect(receivedValue).toBeUndefined();
      refVar.value = { id: target.id };
      expect(receivedValue).toEqual({ id: target.id });
    });

    test('setting same object value does not create duplicate subscriptions', () => {
      let refVar = new Reference<{ id: string }>({ path: 'id' }).attach(parent);
      let target = new Attachable().attachToRoot();

      let obj = { id: target.id };
      refVar.value = obj;
      refVar.value = obj;

      target.destroy();
      expect(refVar.value).toBeUndefined();
    });

    test('object reference with array in path', () => {
      interface DataWithArray {
        items: Array<{ id: string }>;
        selectedIndex: number;
      }

      let refVar = new Reference<DataWithArray>({ path: 'items.0.id' }).attach(parent);
      let target = new Attachable().attachToRoot();

      let data: DataWithArray = {
        items: [{ id: target.id }, { id: 'other-id' }],
        selectedIndex: 0
      };

      refVar.value = data;
      expect(refVar.value).toEqual(data);

      target.destroy();
      expect(refVar.value).toBeUndefined();
    });

    test('destroyed reference with path cannot be set', () => {
      let refVar = new Reference<{ id: string }>({ path: 'id' }).attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.destroy();

      expect(() => {
        refVar.value = { id: target.id };
      }).toThrow('Reference: This reference is destroyed cannot be set!');
    });

    test('listenerCount works with object references', () => {
      let refVar = new Reference<{ id: string }>({ path: 'id' }).attach(parent);
      expect(refVar.listenerCount).toBe(0);

      refVar.subscribe(() => {}).attachToRoot();
      expect(refVar.listenerCount).toBe(1);

      refVar.subscribe(() => {}).attachToRoot();
      expect(refVar.listenerCount).toBe(2);
    });
  });

  describe('Destroyed state behavior', () => {
    test('cannot set value on destroyed reference', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.destroy();

      expect(() => {
        refVar.value = target.id;
      }).toThrow('Reference: This reference is destroyed cannot be set!');
    });

    test('cannot subscribe to destroyed reference', () => {
      let refVar = new Reference().attach(parent);

      refVar.destroy();

      expect(() => {
        refVar.subscribe(() => {});
      }).toThrow('Reference: This reference is destroyed cannot be subscribed to!');
    });

    test('cannot waitUntilNext on destroyed reference', () => {
      let refVar = new Reference().attach(parent);

      refVar.destroy();

      expect(() => {
        refVar.waitUntilNext(() => {});
      }).toThrow('Reference: This reference is destroyed cannot be waited until next!');
    });

    test('cannot waitUntil on destroyed reference', () => {
      let refVar = new Reference().attach(parent);

      refVar.destroy();

      expect(() => {
        refVar.waitUntil('some-id', () => {});
      }).toThrow('Reference: This reference is destroyed cannot be waited until!');
    });

    test('destroy cleans up internal destroy subscription', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;
      expect(refVar['destroySubscription']).toBeDefined();

      let destroySubscription = refVar['destroySubscription'];
      refVar.destroy();

      expect(destroySubscription?.destroyed).toBe(true);
      expect(refVar['destroySubscription']).toBeUndefined();
    });

    test('destroy can be called multiple times safely', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;

      expect(() => {
        refVar.destroy();
        refVar.destroy();
      }).not.toThrow();

      expect(refVar.destroyed).toBe(true);
    });

    test('destroying reference with value does not affect target attachable', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;
      refVar.destroy();

      expect(target.destroyed).toBe(false);
    });

    test('getting value after destroy does not throw', () => {
      let refVar = new Reference().attach(parent);
      let target = new Attachable().attachToRoot();

      refVar.value = target.id;
      refVar.destroy();

      expect(() => {
        let value = refVar.value;
        expect(value).toBeUndefined();
      }).not.toThrow();
    });

    test('getting listenerCount after destroy does not throw', () => {
      let refVar = new Reference().attach(parent);
      refVar.subscribe(() => {}).attachToRoot();

      refVar.destroy();

      expect(() => {
        let count = refVar.listenerCount;
        expect(count).toBe(0);
      }).not.toThrow();
    });

    test('destroyed reference with no value cleans up properly', () => {
      let refVar = new Reference().attach(parent);

      expect(refVar['destroySubscription']).toBeUndefined();

      refVar.destroy();

      expect(refVar.destroyed).toBe(true);
      expect(refVar.value).toBeUndefined();
    });

    test('circular referencing', () => {
      let consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      let base = new Attachable().attachToRoot();
      let componentOfTheBase = new Attachable().attach(base);

      // They hold each other's reference
      let ref1 = new Reference({ initialValue: componentOfTheBase.id }).attach(base);
      let ref2 = new Reference({ initialValue: base.id }).attach(componentOfTheBase);

      expect(ref1.value).toBe(componentOfTheBase.id);
      expect(ref2.value).toBe(base.id);

      base.destroy();

      expect(ref1.value).toBeUndefined();
      expect(ref2.value).toBeUndefined();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
