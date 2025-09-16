// prettier-ignore
export const ActionLibDefaults = new (class {
  readonly action = new (class {
    cloneBeforeNotification = false;
  })();
  readonly variable = new (class {
    notifyOnChange = false;
    cloneBeforeNotification = false;
  })();
  readonly reducer = new (class {
    cloneBeforeNotification = false;
  })();
})();
