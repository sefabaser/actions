export class PromiseIsDestroyedError extends Error {
  constructor() {
    super('Promise is destroyed');
  }
}

export class DestroyablePromise<T> implements PromiseLike<T> {
  private promise: Promise<T>;
  private cleanup?: () => void;
  private isDestroyed = false;
  private rejectInternal!: (reason?: any) => void;

  constructor(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void | (() => void)) {
    let resolveInternal!: (value: T | PromiseLike<T>) => void;

    this.promise = new Promise<T>((resolve, reject) => {
      this.rejectInternal = reject;
      resolveInternal = value => {
        if (!this.isDestroyed) {
          resolve(value);
        }
      };
    });

    let cleanupOrVoid = executor(resolveInternal, this.rejectInternal);
    if (typeof cleanupOrVoid === 'function') {
      this.cleanup = cleanupOrVoid;
    }
  }

  destroy(): void {
    if (!this.isDestroyed) {
      this.isDestroyed = true;
      this.cleanup?.();
      this.rejectInternal(new PromiseIsDestroyedError());
      this.cleanup = undefined;
      this.rejectInternal = () => {};
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
