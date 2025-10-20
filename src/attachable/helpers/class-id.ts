export class ClassId {
  private static nextClassId = 1;
  private static classToClassId = new WeakMap<typeof ClassId, string>();

  static get id(): string {
    let id = ClassId.classToClassId.get(this);
    if (!id) {
      id = `${ClassId.nextClassId++}`;
      ClassId.classToClassId.set(this, id);
    }
    return id;
  }

  get classId(): string {
    return (this.constructor as typeof ClassId).id;
  }

  /**
   * Required to be called before or after each unit test to reset the store
   * @internal
   */
  static hardReset(): void {
    this.nextClassId = 1;
    this.classToClassId = new WeakMap<typeof ClassId, string>();
  }
}
