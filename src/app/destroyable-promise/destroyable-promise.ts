import { Comparator } from 'helpers-lib';

import { LightweightAttachable } from '../attachable/lightweight-attachable';

export class PromiseIsDestroyedError extends Error {
  constructor() {
    super('Promise is destroyed');
  }
}

export class DestroyablePromise<T> extends LightweightAttachable implements PromiseLike<T> {
  private promise: Promise<T>;
  private isSettled = false;

  private resolveInternal?: (value: T | PromiseLike<T>) => void;
  private rejectInternal?: (reason?: any) => void;
  private cleanup?: () => void;

  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: any) => void
    ) => void | (() => void) | Promise<void | (() => void)>
  ) {
    super();

    this.promise = new Promise<T>((resolve, reject) => {
      this.resolveInternal = resolve;
      this.rejectInternal = reject;
    });

    try {
      let cleanupOrVoid = executor(
        value => {
          if (!this.isSettled) {
            this.resolveInternal?.(value);
            this.settle();
          }
        },
        reason => {
          if (!this.isSettled) {
            this.rejectInternal?.(reason);
            this.settle();
          }
        }
      );

      if (cleanupOrVoid instanceof Promise) {
        cleanupOrVoid
          .then(cleanup => {
            if (Comparator.isFunction(cleanup)) {
              if (this.isSettled) {
                cleanup();
              } else {
                this.cleanup = cleanup;
              }
            }
          })
          .catch(error => {
            if (!this.isSettled) {
              this.rejectInternal?.(error);
              this.settle();
            }
          });
      } else if (Comparator.isFunction(cleanupOrVoid)) {
        if (this.isSettled) {
          cleanupOrVoid();
        } else {
          this.cleanup = cleanupOrVoid;
        }
      }
    } catch (error) {
      if (!this.isSettled) {
        this.rejectInternal?.(error);
        this.settle();
      }
    }
  }

  private settle(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    this.resolveInternal = undefined;
    this.rejectInternal = undefined;
    this.isSettled = true;
    super.destroy();
  }

  destroy(): void {
    if (!this.isSettled) {
      this.rejectInternal?.(new PromiseIsDestroyedError());
      this.settle();
    }
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(onrejected?: (reason: any) => TResult | PromiseLike<TResult>): Promise<T | TResult> {
    return this.promise.catch(onrejected);
  }

  finally(onfinally?: () => void): Promise<T> {
    return this.promise.finally(onfinally);
  }
}
