// prettier-ignore
export const ActionLibDefaults =  new class {
  readonly action = new class {
    cloneBeforeNotification: boolean = false;
  };
  readonly variable = new class {
    notifyOnChange: boolean = false;
    cloneBeforeNotification: boolean = false;
  };
};
