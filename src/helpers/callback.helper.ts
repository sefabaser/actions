/** @internal */
export class CallbackHelper {
  static triggerCallback<T>(data: T, callback: (data: T) => void): void {
    try {
      callback(data);
    } catch (e) {
      console.error('Notifier callback function error: ', e);
    }
  }
}
