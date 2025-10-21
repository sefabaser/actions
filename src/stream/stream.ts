export class Stream<T> {
  private resolvedBeforeTapBy: T | undefined;
  private listener: ((data: T) => void) | undefined;
  private destroyed = false;

  constructor(
    executor: (resolve: (data: T) => void) => void,
    private onDestroy?: () => void
  ) {
    executor(data => {
      if (!this.destroyed) {
        if (this.listener) {
          this.listener(data);
        } else {
          this.resolvedBeforeTapBy = data;
        }
      }
    });
  }

  tap<K>(callback: (data: T) => K | Stream<K>): Stream<K> {
    return new Stream<K>(
      resolve => {
        this.getData(data => {
          let tapReturn = callback(data);
          if (tapReturn instanceof Stream) {
            let tapReturnStream: Stream<K> = tapReturn;
            tapReturnStream.getData(innerData => {
              resolve(innerData);
              tapReturnStream.destroy();
            });
          } else {
            resolve(tapReturn);
          }
        });
      },
      () => this.destroy()
    );
  }

  destroy(): void {
    this.listener = undefined;
    this.resolvedBeforeTapBy = undefined;
    this.destroyed = true;
    this.onDestroy?.();
  }

  private getData<K>(callback: (data: T) => K | Stream<K>): void {
    if (this.destroyed) {
      throw new Error('Stream is destroyed');
    }
    if (this.listener) {
      throw new Error('Stream is already being listened to');
    }

    if (this.resolvedBeforeTapBy) {
      callback(this.resolvedBeforeTapBy);
      this.resolvedBeforeTapBy = undefined;
    }
    this.listener = data => callback(data);
  }
}
