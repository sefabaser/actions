export class RemoteFunction<ParametersType, ReturnType> {
  private implementationFunction?: (parameters: ParametersType) => ReturnType;

  trigger(parameters: ParametersType) {
    if (this.implementationFunction) {
      return this.implementationFunction(parameters);
    } else {
      throw new Error(`RemoteFunction: no implementation is defined! Call parameters: '${parameters}'`);
    }
  }

  implementation(implementationFunction?: (parameters: ParametersType) => ReturnType) {
    if (this.implementationFunction) {
      throw new Error(`RemoteFunction: implementation already defined, it cannot be overriden!`);
    } else {
      this.implementationFunction = implementationFunction;
    }
  }
}
