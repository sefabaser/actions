import { beforeEach, describe, expect, test } from 'vitest';

import { UnitTestHelper } from '../../helpers/unit-test.helper';
import { Variable } from './variable';

class SampleModel {
  testData = '';
}
const SampleData: SampleModel = { testData: 'test' };

describe(`Variable`, () => {
  describe(`Basics`, () => {
    beforeEach(() => {
      UnitTestHelper.hardReset();
    });

    test('should be definable', () => {
      expect(new Variable<SampleModel>(SampleData)).toBeDefined();
    });

    test('persistent value', async () => {
      let variable = new Variable<SampleModel>(SampleData);

      let triggeredWith: any;
      let data = { testData: 'sample' };
      variable.set(data);

      variable
        .subscribe(value => {
          triggeredWith = value;
        })
        .attachToRoot();

      expect(triggeredWith).toEqual(data);
    });

    test('triggering the same data', () => {
      let variable = new Variable<SampleModel>(SampleData);

      let triggeredWith: any;
      let triggerCount = 0;
      variable.set({ testData: 'sample1' });

      variable
        .subscribe(value => {
          triggeredWith = value;
          triggerCount++;
        })
        .attachToRoot();

      expect(triggeredWith).toEqual({ testData: 'sample1' });
      expect(triggerCount).toEqual(1);

      variable.set({ testData: 'sample1' });
      expect(triggeredWith).toEqual({ testData: 'sample1' });
      expect(triggerCount).toEqual(2);
    });

    test('notify on change', () => {
      let variable = new Variable<SampleModel>(SampleData, { notifyOnChange: true });

      let triggeredWith: any;
      let triggerCount = 0;
      variable.set({ testData: 'sample1' });

      variable
        .subscribe(value => {
          triggeredWith = value;
          triggerCount++;
        })
        .attachToRoot();

      expect(triggeredWith).toEqual({ testData: 'sample1' });
      expect(triggerCount).toEqual(1);

      variable.set({ testData: 'sample1' });
      expect(triggeredWith).toEqual({ testData: 'sample1' });
      expect(triggerCount).toEqual(1);

      variable.set({ testData: 'sample2' });
      expect(triggeredWith).toEqual({ testData: 'sample2' });
      expect(triggerCount).toEqual(2);
    });

    test('listen only new changes', () => {
      let variable = new Variable<SampleModel>(SampleData, { notifyOnChange: true });

      let triggeredWith: any;
      let data = { testData: 'sample' };
      variable.set(data);

      variable
        .subscribe(
          value => {
            triggeredWith = value;
          },
          { listenOnlyNewChanges: true }
        )
        .attachToRoot();

      expect(triggeredWith).toEqual(undefined);
    });
  });

  describe(`Current Value`, () => {
    test('initial value', () => {
      let variable = new Variable<number>(1);
      expect(variable.value).toEqual(1);
    });

    test('get current value', () => {
      let variable = new Variable<number>(1);
      expect(variable.value).toEqual(1);
      variable.value = 2;
      expect(variable.value).toEqual(2);
    });

    test('should be set before notification', () => {
      let heap: number[] = [];

      let variable = new Variable<number>(1);
      variable
        .subscribe(value => {
          console.log('value', value);
          heap.push(value);
          heap.push(variable.value);
        })
        .attachToRoot();

      variable.value = 2;

      expect(heap).toEqual([1, 1, 2, 2]);
    });
  });
});
