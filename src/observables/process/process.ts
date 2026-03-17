import { Attachable, type IAttachment } from '../../attachable/attachable';
import type { AsyncOperation } from '../../common';
import { NotifierBase } from '../_notifier/notifier-base';
import { Reducer } from '../reducer/reducer';

export class Process<InputType, ProcessReturnType, OutputType> {
  static createAll<SInputType>(): Process<SInputType, void, boolean> {
    let notifier = new NotifierBase<SInputType>();
    let reducer = Reducer.createExistenceChecker();
    return new Process(notifier, reducer, undefined);
  }

  constructor(
    private notifier: NotifierBase<InputType>,
    private reducer: Reducer<ProcessReturnType, OutputType>,
    private defaultEffectValue: ProcessReturnType
  ) {}

  start(...args: void extends InputType ? (InputType extends void ? [] : [InputType]) : [InputType]): SingleEvent<OutputType> {}

  register(callback: (data: InputType) => AsyncOperation<ProcessReturnType> | ProcessReturnType): IAttachment {
    let attachable = new Attachable();

    this.notifier
      .subscribe(broadcast => {
        let effect = this.reducer.effect(this.defaultEffectValue).attach(attachable);

        let response: any;
        try {
          response = callback(broadcast);
        } catch (e) {
          console.error('Process registerer function error: ', e);
          return;
        }

        if (response?._subscribeSingle) {
          (response as AsyncOperation<ProcessReturnType>)
            ._subscribeSingle(() => {
              effect.update(response);
            })
            .attach(attachable);
        } else {
          effect.update(response as ProcessReturnType);
        }
      })
      .attach(attachable);

    return attachable;
  }
}
