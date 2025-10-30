import { CallbackHelper } from '../helpers/callback.helper';
import { Sequence } from '../sequence/sequence';
import { AttachmentTargetStore } from './helpers/attachment-target.store';
import { ClassId } from './helpers/class-id';
import { LightweightAttachable } from './lightweight-attachable';

export interface IAttachable {
  destroyed: boolean;
  attachIsCalled: boolean;
  destroy(): void;
  attach(parent: Attachable | string): this;
  attachToRoot(): this;
}

export class Attachable extends ClassId implements IAttachable {
  static validateId(this: typeof Attachable, id: string): boolean {
    return AttachmentTargetStore.validateIdForClass(id, this);
  }

  readonly id: string = AttachmentTargetStore.registerAttachmentTarget(this);

  private _attachedParent: Attachable | undefined;
  /** @internal */
  get attachedParent(): Attachable | undefined {
    return this._attachedParent;
  }

  private _destroyed = false;
  get destroyed(): boolean {
    return this._destroyed;
  }

  private _attachIsCalled = false;
  get attachIsCalled(): boolean {
    return this._attachIsCalled;
  }

  private _onDestroyListeners: Set<() => void> | undefined;
  private _attachments: Set<IAttachable> | undefined;

  constructor() {
    super();
    setTimeout(() => {
      if (!this._destroyed && !this._attachIsCalled) {
        throw new Error(`Attachable: The object is not attached to anything!`);
      }
    });
  }

  destroy(): void {
    if (!this._destroyed) {
      this._attachedParent?.removeAttachment(this);
      this._attachedParent = undefined;
      AttachmentTargetStore.unregisterAttachmentTarget(this);

      let listeners = this._onDestroyListeners;
      this._onDestroyListeners = undefined;
      listeners?.forEach(listener => listener());

      let attachedEntities = this._attachments;
      this._attachments = undefined;
      attachedEntities?.forEach(item => item.destroy());

      this._destroyed = true;
    }
  }

  onDestroy(callback?: () => void): Sequence<void> {
    if (this._destroyed) {
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

  attach(parent: Attachable | string): this {
    if (this._attachIsCalled) {
      throw new Error(`Attachable: The object is already attached to something!`);
    }

    this._attachIsCalled = true;
    if (!this._destroyed) {
      let parentEntity = LightweightAttachable.attach(parent, this);
      this._attachedParent = parentEntity;
    }
    return this;
  }

  attachToRoot(): this {
    if (this._attachIsCalled) {
      throw new Error(`Attachable: The object is already attached to something!`);
    }

    this._attachIsCalled = true;
    return this;
  }

  /** @internal */
  setAttachment(child: IAttachable): void {
    if (this._destroyed) {
      child.destroy();
    } else {
      if (!this._attachments) {
        this._attachments = new Set();
      }
      this._attachments.add(child);
    }
  }

  /** @internal */
  removeAttachment(child: IAttachable): void {
    this._attachments?.delete(child);
  }
}
