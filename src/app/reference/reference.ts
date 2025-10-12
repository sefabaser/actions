import { Attachable } from '../attachable/attachable';
import { AttachmentTargetStore } from '../attachable/helpers/attachment-target.store';
import { ActionSubscription } from '../notifier/action-subscription';
import { IVariable, Variable, VariableListenerCallbackFunction } from '../variable/variable';

export class Reference implements IVariable<string | undefined> {
  get value(): string | undefined {
    return this.variable.value;
  }
  set value(value: string | undefined) {
    this.set(value);
  }

  get listenerCount(): number {
    return this.variable.listenerCount;
  }

  private variable: Variable<string | undefined>;
  private destroySubscription: ActionSubscription | undefined;

  constructor(private options: { attachTo: Attachable }) {
    this.variable = new Variable<string | undefined>(undefined, { notifyOnChange: true });
  }

  set(data: string | undefined): this {
    if (data !== this.variable.value) {
      this.destroySubscription?.destroy();
      this.destroySubscription = undefined;

      if (data) {
        this.destroySubscription = AttachmentTargetStore.findAttachmentTarget(data)
          .onDestroyed(() => {
            this.set(undefined);
          })
          .attach(this.options.attachTo);
      }

      this.variable.set(data);
    }
    return this;
  }

  subscribe(callback: VariableListenerCallbackFunction<string | undefined>): ActionSubscription {
    return this.variable.subscribe(callback);
  }

  waitUntilNext(callback: (data: string | undefined) => void): ActionSubscription {
    return this.variable.waitUntilNext(callback);
  }

  waitUntil(data: string | undefined, callback: (data: string | undefined) => void): ActionSubscription {
    return this.variable.waitUntil(data, callback);
  }
}
