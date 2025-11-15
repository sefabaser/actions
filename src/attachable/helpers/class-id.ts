export type AnyClass = abstract new (...args: any[]) => any;

export class ClassID {
  private static _nextClassID = 1;
  private static _classToClassID = new WeakMap<AnyClass, number>();

  static get id(): number {
    return this.getClassID(this);
  }

  static getClassID(Class: AnyClass): number {
    let id = ClassID._classToClassID.get(Class);
    if (!id) {
      id = ClassID._nextClassID++;
      ClassID._classToClassID.set(Class, id);
    }
    return id;
  }

  get classID(): number {
    return (this.constructor as typeof ClassID).id;
  }

  /**
   * Required to be called before or after each unit test to reset the store
   * @internal
   */
  static hardReset(): void {
    this._nextClassID = 1;
    this._classToClassID = new WeakMap<typeof ClassID, number>();
  }
}
