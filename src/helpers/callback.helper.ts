/** @internal */
export class CallbackHelper {
  static _triggerCallback<T>(data: T, callback: (returnData: T) => void): void {
    try {
      callback(data);
    } catch (e) {
      console.error('Notifier callback function error: ', e);
    }
  }
}
