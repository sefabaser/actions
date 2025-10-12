import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ObservableMapNotifier } from './observable-map-notifier';

describe('ObservableMapNotifier', () => {
  describe('Basics', () => {
    let notifier: ObservableMapNotifier<number, string>;

    beforeEach(() => {
      notifier = new ObservableMapNotifier(new Map());
    });

    test('definable', () => {
      expect(notifier).toBeDefined();
    });

    test('size returns map size', () => {
      expect(notifier.size).toBe(0);
      notifier['map'].set(1, 'test');
      expect(notifier.size).toBe(1);
      notifier['map'].set(2, 'test2');
      expect(notifier.size).toBe(2);
    });

    test('has checks if key exists', () => {
      expect(notifier.has(1)).toBe(false);
      notifier['map'].set(1, 'test');
      expect(notifier.has(1)).toBe(true);
    });

    test('get returns value', () => {
      expect(notifier.get(1)).toBeUndefined();
      notifier['map'].set(1, 'test');
      expect(notifier.get(1)).toBe('test');
    });

    test('convertToMap returns new map', () => {
      notifier['map'].set(1, 'test');
      let converted = notifier.convertToMap();
      expect(converted).toEqual(new Map([[1, 'test']]));
      expect(converted).not.toBe(notifier['map']);
    });

    test('converted map should not change the original map', () => {
      notifier['map'].set(1, 'test');
      let converted = notifier.convertToMap();
      converted.set(2, 'test2');
      expect(notifier.size).toBe(1);
      expect(notifier.convertToMap()).toEqual(new Map([[1, 'test']]));
    });
  });

  describe('Wait Until Added', () => {
    let notifier: ObservableMapNotifier<number, string>;

    beforeEach(() => {
      notifier = new ObservableMapNotifier(new Map());
    });

    test('immediate callback if item already exists', () => {
      notifier['map'].set(1, 'test');
      let triggeredWith: string | undefined;

      let subscription = notifier.waitUntilAdded(1, value => {
        triggeredWith = value;
      });

      expect(triggeredWith).toBe('test');
      expect(subscription.destroyed).toBe(true);
    });

    test('delayed callback if item does not exist yet', () => {
      let triggeredWith: string | undefined;

      let subscription = notifier
        .waitUntilAdded(1, value => {
          triggeredWith = value;
        })
        .attachToRoot();

      expect(triggeredWith).toBeUndefined();
      expect(subscription.destroyed).toBe(false);

      notifier['map'].set(1, 'test');
      notifier['_untilAddedListeners']?.get(1)?.forEach(callback => callback(1));

      expect(triggeredWith).toBe('test');
    });

    test('subscription cleanup removes listener', () => {
      let subscription = notifier.waitUntilAdded(1, () => {}).attachToRoot();

      expect(notifier['_untilAddedListeners']?.get(1)?.size).toBe(1);

      subscription.destroy();

      expect(notifier['_untilAddedListeners']?.get(1)?.size).toBe(0);
    });

    test('not triggered if subscription is destroyed before item is added', () => {
      let triggered = false;

      let subscription = notifier
        .waitUntilAdded(1, () => {
          triggered = true;
        })
        .attachToRoot();

      subscription.destroy();

      notifier['map'].set(1, 'test');
      notifier['_untilAddedListeners']?.get(1)?.forEach(callback => callback(1));

      expect(triggered).toBe(false);
    });

    test('multiple listeners for same key', () => {
      let triggered1 = false;
      let triggered2 = false;

      notifier
        .waitUntilAdded(1, () => {
          triggered1 = true;
        })
        .attachToRoot();

      notifier
        .waitUntilAdded(1, () => {
          triggered2 = true;
        })
        .attachToRoot();

      expect(notifier['_untilAddedListeners']?.get(1)?.size).toBe(2);

      notifier['map'].set(1, 'test');
      notifier['_untilAddedListeners']?.get(1)?.forEach(callback => callback(1));

      expect(triggered1).toBe(true);
      expect(triggered2).toBe(true);
    });

    test('callback error handling', () => {
      let consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let subscription2Called = false;

      notifier['map'].set(1, 'test');

      notifier.waitUntilAdded(1, () => {
        throw new Error('Test error');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Notifier callback function error: ', expect.any(Error));

      notifier
        .waitUntilAdded(2, () => {
          subscription2Called = true;
        })
        .attachToRoot();

      notifier['map'].set(2, 'test2');
      notifier['_untilAddedListeners']?.get(2)?.forEach(callback => callback(2));

      expect(subscription2Called).toBe(true);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Wait Until Removed', () => {
    let notifier: ObservableMapNotifier<number, string>;

    beforeEach(() => {
      notifier = new ObservableMapNotifier(new Map());
    });

    test('immediate callback if item does not exist', () => {
      let triggered = false;

      let subscription = notifier.waitUntilRemoved(1, () => {
        triggered = true;
      });

      expect(triggered).toBe(true);
      expect(subscription.destroyed).toBe(true);
    });

    test('delayed callback if item exists', () => {
      notifier['map'].set(1, 'test');
      let triggered = false;

      let subscription = notifier
        .waitUntilRemoved(1, () => {
          triggered = true;
        })
        .attachToRoot();

      expect(triggered).toBe(false);
      expect(subscription.destroyed).toBe(false);

      notifier['map'].delete(1);
      notifier['_untilRemovedListeners']?.get(1)?.forEach(callback => callback());

      expect(triggered).toBe(true);
    });

    test('subscription cleanup removes listener', () => {
      notifier['map'].set(1, 'test');

      let subscription = notifier.waitUntilRemoved(1, () => {}).attachToRoot();

      expect(notifier['_untilRemovedListeners']?.get(1)?.size).toBe(1);

      subscription.destroy();

      expect(notifier['_untilRemovedListeners']?.get(1)?.size).toBe(0);
    });

    test('not triggered if subscription is destroyed before item is removed', () => {
      notifier['map'].set(1, 'test');
      let triggered = false;

      let subscription = notifier
        .waitUntilRemoved(1, () => {
          triggered = true;
        })
        .attachToRoot();

      subscription.destroy();

      notifier['map'].delete(1);
      notifier['_untilRemovedListeners']?.get(1)?.forEach(callback => callback());

      expect(triggered).toBe(false);
    });

    test('multiple listeners for same key', () => {
      notifier['map'].set(1, 'test');
      let triggered1 = false;
      let triggered2 = false;

      notifier
        .waitUntilRemoved(1, () => {
          triggered1 = true;
        })
        .attachToRoot();

      notifier
        .waitUntilRemoved(1, () => {
          triggered2 = true;
        })
        .attachToRoot();

      expect(notifier['_untilRemovedListeners']?.get(1)?.size).toBe(2);

      notifier['map'].delete(1);
      notifier['_untilRemovedListeners']?.get(1)?.forEach(callback => callback());

      expect(triggered1).toBe(true);
      expect(triggered2).toBe(true);
    });

    test('callback error handling', () => {
      let consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let subscription2Called = false;

      notifier.waitUntilRemoved(1, () => {
        throw new Error('Test error');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Notifier callback function error: ', expect.any(Error));

      notifier['map'].set(2, 'test2');

      notifier
        .waitUntilRemoved(2, () => {
          subscription2Called = true;
        })
        .attachToRoot();

      notifier['map'].delete(2);
      notifier['_untilRemovedListeners']?.get(2)?.forEach(callback => callback());

      expect(subscription2Called).toBe(true);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Notifier getter', () => {
    test('returns new notifier with same map', () => {
      let map = new Map<number, string>([[1, 'test']]);
      let notifier = new ObservableMapNotifier(map);
      let notifier2 = notifier.notifier;

      expect(notifier2).toBeInstanceOf(ObservableMapNotifier);
      expect(notifier2).not.toBe(notifier);
      expect(notifier2['map']).toBe(notifier['map']);
    });

    test('shares listener maps between notifiers', () => {
      let map = new Map<number, string>();
      let notifier = new ObservableMapNotifier(map);

      notifier.waitUntilAdded(1, () => {}).attachToRoot();

      let notifier2 = notifier.notifier;

      notifier2.waitUntilAdded(2, () => {}).attachToRoot();

      expect(notifier['_untilAddedListeners']).toBe(notifier2['_untilAddedListeners']);
      expect(notifier['_untilAddedListeners']?.size).toBe(2);
    });

    test('destroying subscription of one notifier should effect the other notifier', () => {
      let map = new Map<number, string>();
      let notifier = new ObservableMapNotifier(map);

      notifier.waitUntilAdded(2, () => {}).attachToRoot();

      let notifier2 = notifier.notifier;

      let triggered = false;

      let subscription = notifier2
        .waitUntilAdded(1, () => {
          triggered = true;
        })
        .attachToRoot();

      expect(notifier['_untilAddedListeners']?.get(1)?.size).toBe(1);

      subscription.destroy();

      expect(notifier['_untilAddedListeners']?.get(1)?.size).toBe(0);

      notifier['map'].set(1, 'test');
      notifier['_untilAddedListeners']?.get(1)?.forEach(callback => callback(1));

      expect(triggered).toBe(false);
    });
  });

  describe('Constructor', () => {
    test('creates with empty map if not provided', () => {
      let notifier = new ObservableMapNotifier(undefined as any);
      expect(notifier.size).toBe(0);
      expect(notifier['map']).toEqual(new Map());
    });

    test('creates with provided map', () => {
      let map = new Map<number, string>([[1, 'test']]);
      let notifier = new ObservableMapNotifier(map);
      expect(notifier.size).toBe(1);
      expect(notifier.get(1)).toBe('test');
    });

    test('creates with shared listener maps', () => {
      let map = new Map<number, string>();
      let untilAddedListeners = new Map<number, Set<(data: number) => void>>();
      let untilRemovedListeners = new Map<number, Set<() => void>>();

      let notifier = new ObservableMapNotifier(map, untilAddedListeners, untilRemovedListeners);

      expect(notifier['_untilAddedListeners']).toBe(untilAddedListeners);
      expect(notifier['_untilRemovedListeners']).toBe(untilRemovedListeners);
    });
  });

  describe('Lazy initialization', () => {
    test('untilAddedListeners initialized on first use', () => {
      let notifier = new ObservableMapNotifier(new Map());
      expect(notifier['_untilAddedListeners']).toBeUndefined();

      notifier.waitUntilAdded(1, () => {}).attachToRoot();

      expect(notifier['_untilAddedListeners']).toBeDefined();
      expect(notifier['_untilAddedListeners']).toBeInstanceOf(Map);
    });

    test('untilRemovedListeners initialized on first use', () => {
      let map = new Map<number, string>([[1, 'test']]);
      let notifier = new ObservableMapNotifier(map);
      expect(notifier['_untilRemovedListeners']).toBeUndefined();

      notifier.waitUntilRemoved(1, () => {}).attachToRoot();

      expect(notifier['_untilRemovedListeners']).toBeDefined();
      expect(notifier['_untilRemovedListeners']).toBeInstanceOf(Map);
    });
  });
});
