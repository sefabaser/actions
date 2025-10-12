import { Attachable } from '../attachable/attachable';
import { AttachmentTargetStore } from '../attachable/helpers/attachment-target.store';
import { LightweightAttachable } from '../attachable/lightweight-attachable';
import { ActionSubscription } from '../notifier/action-subscription';
import { IVariable, Variable, VariableListenerCallbackFunction } from '../variable/variable';

export class Reference extends LightweightAttachable implements IVariable<string | undefined> {
  get value(): string | undefined {
    if (this.destroyed) {
      return undefined;
    }

    return this.variable.value;
  }
  set value(value: string | undefined) {
    this.set(value);
  }

  get listenerCount(): number {
    if (this.destroyed) {
      return 0;
    }

    return this.variable.listenerCount;
  }

  private variable: Variable<string | undefined>;
  private destroySubscription: ActionSubscription | undefined;

  constructor() {
    super();
    this.variable = new Variable<string | undefined>(undefined, { notifyOnChange: true });
  }

  set(data: string | undefined): this {
    if (this.destroyed) {
      throw new Error(`Reference: This reference is destroyed cannot be set!`);
    }

    if (data !== this.variable.value) {
      this.destroySubscription?.destroy();
      this.destroySubscription = undefined;

      if (data) {
        this.destroySubscription = AttachmentTargetStore.findAttachmentTarget(data).onDestroyed(() => {
          this.set(undefined);
        });

        if (this._attachIsCalled) {
          if (this.attachedParent) {
            this.destroySubscription.attach(this.attachedParent);
          } else {
            this.destroySubscription.attachToRoot();
          }
        }
      }

      this.variable.set(data);
    }
    return this;
  }

  subscribe(callback: VariableListenerCallbackFunction<string | undefined>): ActionSubscription {
    if (this.destroyed) {
      throw new Error(`Reference: This reference is destroyed cannot be subscribed to!`);
    }

    return this.variable.subscribe(callback);
  }

  waitUntilNext(callback: (data: string | undefined) => void): ActionSubscription {
    if (this.destroyed) {
      throw new Error(`Reference: This reference is destroyed cannot be waited until next!`);
    }

    return this.variable.waitUntilNext(callback);
  }

  waitUntil(data: string | undefined, callback: (data: string | undefined) => void): ActionSubscription {
    if (this.destroyed) {
      throw new Error(`Reference: This reference is destroyed cannot be waited until!`);
    }

    return this.variable.waitUntil(data, callback);
  }

  attach(parent: Attachable | string): this {
    super.attach(parent);
    this.destroySubscription?.attach(this.attachedParent!);
    return this;
  }

  attachToRoot(): this {
    super.attachToRoot();
    this.destroySubscription?.attachToRoot();
    return this;
  }

  destroy(): void {
    this.destroySubscription?.destroy();
    this.destroySubscription = undefined;
    this.variable = undefined as any;
    super.destroy();
  }
}
