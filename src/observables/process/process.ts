import { type IAttachment } from '../../attachable/attachable';
import { SingleEvent } from '../../stream/single-event/single-event';
import { ActionSubscription } from '../_notifier/notifier-base';
import { Reducer, ReducerEffectChannel } from '../reducer/reducer';

export type ProcessCallbackFunction<InputType, ProcessReturnType> = (data: InputType) => SingleEvent<ProcessReturnType>;

interface OngoingProcess<OutputType> {
  idToBlocker: Map<number, ReducerEffectChannel<void>>;
  currentValue: OutputType;
}

export interface IProcessContext<OutputType> {
  readonly resolveProcessWith: (value: OutputType) => void;
}

export class Process<InputType, ProcessReturnType, OutputType> {
  static createAny<SInputType, SOutputType>(): Process<SInputType, SOutputType, SOutputType | undefined> {
    return new Process<SInputType, SOutputType, SOutputType | undefined>((acc, value, context) => {
      context.resolveProcessWith(value);
      return value;
    }, undefined);
  }

  static createAll<SInputType>(): Process<SInputType, void, void> {
    return new Process<SInputType, void, void>((acc, _) => acc, undefined);
  }

  static createSum<SInputType>(): Process<SInputType, number, number> {
    return new Process<SInputType, number, number>((acc, value) => acc + value, 0);
  }

  protected _nextAvailableSubscriptionID = { v: 1 };
  protected _listenersMapVar: Map<number, ProcessCallbackFunction<InputType, ProcessReturnType>> | undefined;
  protected get _registererMap() {
    if (!this._listenersMapVar) {
      this._listenersMapVar = new Map<number, ProcessCallbackFunction<InputType, ProcessReturnType>>();
    }
    return this._listenersMapVar;
  }

  private _ongoingProcess: OngoingProcess<OutputType> | undefined;
  get running(): boolean {
    return this._ongoingProcess !== undefined;
  }

  constructor(
    private _reduceFunction: (acc: OutputType, value: ProcessReturnType, context: IProcessContext<OutputType>) => OutputType,
    private _defaultValue: OutputType
  ) {}

  start(data: InputType): SingleEvent<OutputType> {
    if (this._ongoingProcess !== undefined) {
      throw new Error('Process: cannot start a new process while an ongoing process is still ongoing.');
    }

    let registererMap = this._listenersMapVar;
    if (registererMap) {
      return SingleEvent.create((resolve, context) => {
        this._ongoingProcess = {
          idToBlocker: new Map<number, ReducerEffectChannel<void>>(),
          currentValue: this._defaultValue
        };

        let reducer = Reducer.createExistenceChecker();
        let listenerIDs = [...registererMap.keys()];

        for (let i = 0; i < listenerIDs.length; i++) {
          let id = listenerIDs[i];
          let listener = registererMap.get(id);
          if (listener !== undefined) {
            try {
              let subscription = listener(data)
                ._subscribeSingle(resolvedValue => {
                  if (this._ongoingProcess === undefined) {
                    throw new Error('Process: ongoing process is undefined when resolving a registerer.');
                  }
                  this._ongoingProcess.currentValue = this._reduceFunction(this._ongoingProcess.currentValue, resolvedValue, {
                    resolveProcessWith: (value: OutputType) => resolve(value)
                  });
                })
                .attach(context.attachable);

              let blocker = reducer.effect().attach(subscription);
              this._ongoingProcess.idToBlocker.set(id, blocker);
            } catch (e) {
              console.error('Process registerer function error: ', e);
              return;
            }
          }
        }

        reducer
          .subscribe(blockerExists => {
            if (!blockerExists) {
              if (this._ongoingProcess === undefined) {
                throw new Error('Process: ongoing process is undefined when all blockers are destroyed.');
              }

              resolve(this._ongoingProcess.currentValue);
              this._ongoingProcess = undefined;
            }
          })
          .attach(context.attachable);
      });
    } else {
      return SingleEvent.instant(this._defaultValue);
    }
  }

  register(callback: ProcessCallbackFunction<InputType, ProcessReturnType>): IAttachment {
    let subscriptionID = this._nextAvailableSubscriptionID.v++;
    this._registererMap.set(subscriptionID, callback);

    return new ActionSubscription(() => {
      this._registererMap.delete(subscriptionID);
      this._ongoingProcess?.idToBlocker.get(subscriptionID)?.destroy();
    });
  }
}
