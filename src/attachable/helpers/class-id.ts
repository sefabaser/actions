export type AnyClass = abstract new (...args: any[]) => any;

export class ClassID {
  private static nextClassID = 1;
  private static classToClassID = new WeakMap<AnyClass, number>();

  static get id(): number {
    return this.getClassID(this);
  }

  static getClassID(Class: AnyClass): number {
    let id = ClassID.classToClassID.get(Class);
    if (!id) {
      id = ClassID.nextClassID++;
      ClassID.classToClassID.set(Class, id);
    }
    return id;
  }

  get classId(): number {
    return (this.constructor as typeof ClassID).id;
  }

  /**
   * Required to be called before or after each unit test to reset the store
   * @internal
   */
  static hardReset(): void {
    this.nextClassID = 1;
    this.classToClassID = new WeakMap<typeof ClassID, number>();
  }
}
