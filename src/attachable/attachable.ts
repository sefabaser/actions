import { CallbackHelper } from '../helpers/callback.helper';
import { Sequence } from '../sequence/sequence';
import { BaseAttachable, IAttachable } from './base-attachable';

export class Attachable extends BaseAttachable {
  /**
   * @returns IAttachable that is already destroyed
   */
  static getDestroyed(): IAttachable {
    let destroyedSubscription = new Attachable();
    destroyedSubscription.destroy();
    return destroyedSubscription;
  }

  private _onDestroyListeners: Set<() => void> | undefined;

  onDestroy(callback?: () => void): Sequence<void> {
    if (this.destroyed) {
      if (callback) {
        CallbackHelper.triggerCallback(undefined, callback);
      }
      return Sequence.create<void>(resolve => resolve());
    } else {
      if (!this._onDestroyListeners) {
        this._onDestroyListeners = new Set();
      }

      return Sequence.create<void>(resolve => {
        let listener = () => {
          if (callback) {
            CallbackHelper.triggerCallback(undefined, callback);
          }
          resolve();
        };
        this._onDestroyListeners!.add(listener);
        return () => {
          this._onDestroyListeners?.delete(listener);
        };
      });
    }
  }

  destroy(): void {
    if (!this.destroyed) {
      let listeners = this._onDestroyListeners;
      this._onDestroyListeners = undefined;
      listeners?.forEach(listener => listener());

      super.destroy();
    }
  }
}
