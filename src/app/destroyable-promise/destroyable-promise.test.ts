import { Wait } from 'helpers-lib';
import { describe, expect, test } from 'vitest';

import { DestroyablePromise, PromiseIsDestroyedError } from './destroyable-promise';

describe('DestroyablePromise', () => {
  test('resolves successfully', async () => {
    let promise = new DestroyablePromise<number>(resolve => resolve(42));
    let result = await promise;
    expect(result).toBe(42);
  });

  test('await function returns destroyable promise', async () => {
    let foo = function (): DestroyablePromise<number> {
      return new DestroyablePromise<number>(resolve => {
        setTimeout(() => resolve(42), 10);
      });
    };
    let promise = await foo();
    expect(promise).toBe(42);
  });

  test('rejects successfully', async () => {
    let error = new Error('test error');
    let promise = new DestroyablePromise<number>((_, reject) => reject(error));
    await expect(promise).rejects.toThrow('test error');
  });

  test('resolves delayed', async () => {
    let promise = new DestroyablePromise<string>(resolve => {
      setTimeout(() => resolve('delayed'), 10);
    });

    let result = await promise;
    expect(result).toBe('delayed');
  });

  test('async executor', async () => {
    let promise = new DestroyablePromise<number>(async resolve => {
      await Wait(10);
      resolve(42);
    });
    let result = await promise;
  });

  test('destruction before resolution rejects with PromiseIsDestroyedError', async () => {
    let promise = new DestroyablePromise<number>(resolve => {
      setTimeout(() => resolve(42), 100);
    });

    promise.destroy();

    await expect(promise).rejects.toThrow(PromiseIsDestroyedError);
  });

  test('destruction prevents resolution', async () => {
    let resolveExternal: ((value: number) => void) | undefined;
    let promise = new DestroyablePromise<number>(resolve => {
      resolveExternal = resolve;
    });

    promise.destroy();

    resolveExternal?.(42); // Try to resolve after destruction
    await expect(promise).rejects.toThrow(PromiseIsDestroyedError);
  });

  test('cleanup function is called on destroy', () => {
    let cleanupCalled = false;

    let promise = new DestroyablePromise<number>(() => () => {
      cleanupCalled = true;
    });

    promise.catch(() => {});
    promise.destroy();

    expect(cleanupCalled).toBe(true);
  });

  test('cleanup function receives no arguments', () => {
    let cleanupArgs: any[] = [];
    let promise = new DestroyablePromise<number>(() => (...args: any[]) => {
      cleanupArgs = args;
    });

    promise.catch(() => {});
    promise.destroy();

    expect(cleanupArgs).toEqual([]);
  });

  test('multiple destroy calls only execute cleanup once', () => {
    let cleanupCount = 0;
    let promise = new DestroyablePromise<number>(() => () => {
      cleanupCount++;
    });

    promise.catch(() => {});

    promise.destroy();
    promise.destroy();
    promise.destroy();

    expect(cleanupCount).toBe(1);
  });

  test('executor without cleanup function', async () => {
    let promise = new DestroyablePromise<number>(_ => {});
    promise.destroy();
    await expect(promise).rejects.toThrow(PromiseIsDestroyedError);
  });

  test('then method chains correctly', async () => {
    let promise = new DestroyablePromise<number>(resolve => {
      resolve(10);
    });

    let result = await promise.then(value => value * 2);
    expect(result).toBe(20);
  });

  test('then with rejection handler', async () => {
    let promise = new DestroyablePromise<number>((_, reject) => {
      reject(new Error('failed'));
    });

    let result = await promise.then(
      value => value,
      () => 'handled'
    );
    expect(result).toBe('handled');
  });

  test('catch method handles rejection', async () => {
    let promise = new DestroyablePromise<number>((_, reject) => {
      reject(new Error('test error'));
    });

    let result = await promise.catch(error => error.message);
    expect(result).toBe('test error');
  });

  test('catch method handles destruction', async () => {
    let promise = new DestroyablePromise<number>(resolve => {
      setTimeout(() => resolve(42), 100);
    });

    promise.destroy();

    let result = await promise.catch(error => {
      if (error instanceof PromiseIsDestroyedError) {
        return 'destroyed';
      }
      return 'other';
    });

    expect(result).toBe('destroyed');
  });

  test('finally method executes on resolution', async () => {
    let finallyCalled = false;
    let promise = new DestroyablePromise<number>(resolve => {
      resolve(42);
    });

    let result = await promise.finally(() => {
      finallyCalled = true;
    });

    expect(finallyCalled).toBe(true);
    expect(result).toBe(42);
  });

  test('finally method executes on rejection', async () => {
    let finallyCalled = false;
    let promise = new DestroyablePromise<number>((_, reject) => {
      reject(new Error('failed'));
    });

    await promise
      .catch(() => {})
      .finally(() => {
        finallyCalled = true;
      });

    expect(finallyCalled).toBe(true);
  });

  test('finally method executes on destruction', async () => {
    let finallyCalled = false;
    let promise = new DestroyablePromise<number>(() => {});

    promise.destroy();

    await promise
      .catch(() => {})
      .finally(() => {
        finallyCalled = true;
      });

    expect(finallyCalled).toBe(true);
  });

  test('resolves with PromiseLike value', async () => {
    let promise = new DestroyablePromise<number>(resolve => {
      resolve(Promise.resolve(99));
    });

    let result = await promise;
    expect(result).toBe(99);
  });

  test('cleanup with timer cancellation', async () => {
    let timerExecuted = false;
    let promise = new DestroyablePromise<string>(resolve => {
      let timerId = setTimeout(() => {
        timerExecuted = true;
        resolve('done');
      }, 50);

      return () => clearTimeout(timerId);
    });

    promise.catch(() => {});
    promise.destroy();

    await Wait(100); // Wait to ensure timer would have fired if not cleaned up

    expect(timerExecuted).toBe(false);
  });

  test('destruction after resolution does not affect result', async () => {
    let promise = new DestroyablePromise<number>(resolve => {
      resolve(42);
    });

    let result = await promise;
    promise.destroy(); // Destroy after already resolved

    expect(result).toBe(42);
  });

  test('chaining multiple then calls', async () => {
    let promise = new DestroyablePromise<number>(resolve => {
      resolve(5);
    });

    let result1 = await promise;
    let result2 = await promise
      .then(value => value + 5)
      .then(value => value * 2)
      .then(value => value.toString());

    expect(result1).toBe(5);
    expect(result2).toBe('20');
  });

  test('works with async/await', async () => {
    let promise = new DestroyablePromise<string>(resolve => {
      setTimeout(() => resolve('async result'), 10);
    });

    let result = await promise;
    expect(result).toBe('async result');
  });

  test('cleanup function with side effects', () => {
    let sideEffect = { value: 0 };
    let promise = new DestroyablePromise<void>(() => () => {
      sideEffect.value = 100;
    });

    promise.catch(() => {});

    expect(sideEffect.value).toBe(0);
    promise.destroy();
    expect(sideEffect.value).toBe(100);
  });

  test('creates error with correct message', () => {
    let error = new PromiseIsDestroyedError();
    expect(error.message).toBe('Promise is destroyed');
    expect(error).toBeInstanceOf(Error);
  });

  test('cleanup is called on successful resolution', async () => {
    let cleanupCalled = false;

    let promise = new DestroyablePromise<number>(resolve => {
      queueMicrotask(() => resolve(42));
      return () => {
        cleanupCalled = true;
      };
    });

    await promise;
    expect(cleanupCalled).toBe(true);
  });

  test('cleanup is called on rejection', async () => {
    let cleanupCalled = false;

    let promise = new DestroyablePromise<number>((_, reject) => {
      queueMicrotask(() => reject(new Error('failed')));
      return () => {
        cleanupCalled = true;
      };
    });

    await promise.catch(() => {});
    expect(cleanupCalled).toBe(true);
  });

  test('cleanup is called on async resolution', async () => {
    let cleanupCalled = false;

    let promise = new DestroyablePromise<string>(resolve => {
      setTimeout(() => resolve('done'), 10);
      return () => {
        cleanupCalled = true;
      };
    });

    await promise;
    expect(cleanupCalled).toBe(true);
  });

  test('cleanup is called on async rejection', async () => {
    let cleanupCalled = false;

    let promise = new DestroyablePromise<string>((_, reject) => {
      setTimeout(() => reject(new Error('async error')), 10);
      return () => {
        cleanupCalled = true;
      };
    });

    await promise.catch(() => {});
    expect(cleanupCalled).toBe(true);
  });

  test('cleanup is not called twice on resolution then destroy', async () => {
    let cleanupCount = 0;

    let promise = new DestroyablePromise<number>(resolve => {
      queueMicrotask(() => resolve(42));
      return () => {
        cleanupCount++;
      };
    });

    await promise;
    promise.destroy();

    expect(cleanupCount).toBe(1);
  });

  test('cleanup is not called twice on rejection then destroy', async () => {
    let cleanupCount = 0;

    let promise = new DestroyablePromise<number>((_, reject) => {
      queueMicrotask(() => reject(new Error('failed')));
      return () => {
        cleanupCount++;
      };
    });

    await promise.catch(() => {});
    promise.destroy();

    expect(cleanupCount).toBe(1);
  });

  test('destroy after resolution does not call cleanup again', async () => {
    let cleanupCount = 0;

    let promise = new DestroyablePromise<number>(resolve => {
      setTimeout(() => resolve(42), 10);
      return () => {
        cleanupCount++;
      };
    });

    await promise;
    expect(cleanupCount).toBe(1);

    promise.destroy();
    promise.destroy();

    expect(cleanupCount).toBe(1);
  });

  test('cleanup clears subscriptions on resolution', async () => {
    let eventListenerRemoved = false;
    let mockEmitter = {
      addEventListener: () => {},
      removeEventListener: () => {
        eventListenerRemoved = true;
      }
    };

    let promise = new DestroyablePromise<void>(resolve => {
      mockEmitter.addEventListener();
      queueMicrotask(() => resolve());
      return () => mockEmitter.removeEventListener();
    });

    await promise;
    expect(eventListenerRemoved).toBe(true);
  });

  test('cleanup clears subscriptions on rejection', async () => {
    let subscriptionCancelled = false;

    let promise = new DestroyablePromise<void>((_, reject) => {
      queueMicrotask(() => reject(new Error('error')));
      return () => {
        subscriptionCancelled = true;
      };
    });

    await promise.catch(() => {});
    expect(subscriptionCancelled).toBe(true);
  });

  test('cleanup clears interval on resolution', async () => {
    let intervalCleared = false;

    let promise = new DestroyablePromise<number>(resolve => {
      let intervalId = setInterval(() => {}, 1000);
      queueMicrotask(() => resolve(42));
      return () => {
        clearInterval(intervalId);
        intervalCleared = true;
      };
    });

    await promise;
    expect(intervalCleared).toBe(true);
  });

  test('resolve after settlement is ignored', async () => {
    let resolveExternal: ((value: number) => void) | undefined;

    let promise = new DestroyablePromise<number>(resolve => {
      resolveExternal = resolve;
    });

    promise.destroy();

    await promise.catch(() => {});

    resolveExternal?.(42);
    resolveExternal?.(100);

    await expect(promise).rejects.toThrow(PromiseIsDestroyedError);
  });

  test('reject after settlement is ignored', async () => {
    let rejectExternal: ((reason?: any) => void) | undefined;

    let promise = new DestroyablePromise<number>((resolve, reject) => {
      resolve(42);
      rejectExternal = reject;
    });

    await promise;

    rejectExternal?.(new Error('should be ignored'));

    let result = await promise;
    expect(result).toBe(42);
  });

  test('multiple async operations cleanup correctly on first resolution', async () => {
    let cleanup1Called = false;
    let cleanup2Called = false;
    let resolveExternal: ((value: string) => void) | undefined;

    let promise = new DestroyablePromise<string>(resolve => {
      resolveExternal = resolve;

      setTimeout(() => {
        cleanup1Called = true;
      }, 100);

      return () => {
        cleanup2Called = true;
      };
    });

    resolveExternal?.('first');

    await promise;

    expect(cleanup2Called).toBe(true);
    expect(cleanup1Called).toBe(false);
  });

  test('cleanup with complex resource management', async () => {
    let resources = {
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
      listener: false,
      connection: false
    };

    let promise = new DestroyablePromise<void>(resolve => {
      resources.timer = setTimeout(() => resolve(), 10);
      resources.listener = true;
      resources.connection = true;

      return () => {
        if (resources.timer) {
          clearTimeout(resources.timer);
        }
        resources.listener = false;
        resources.connection = false;
      };
    });

    await promise;

    expect(resources.listener).toBe(false);
    expect(resources.connection).toBe(false);
  });
});
