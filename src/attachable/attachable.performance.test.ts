import { UnitTestHelper } from 'helpers-lib';
import { beforeEach, describe, test } from 'vitest';

import type { Attachable as AttachableType } from './attachable';
import type { IDAttachable as IDAttachableType } from './id-attachable';

describe.skipIf(!process.env.MANUAL)('Performance Tests', () => {
  let Attachable: typeof AttachableType;
  let IDAttachable: typeof IDAttachableType;

  beforeEach(async () => {
    let imports = await import('../../dist/index');
    Attachable = imports.Attachable as any;
    IDAttachable = imports.IDAttachable as any;
  });

  test('Attachable create and destroy', async () => {
    await UnitTestHelper.testPerformance(() => {
      let object = new Attachable().attachToRoot();
      object.destroy();
    });
    // Min:  0.10060000419616699
    // queueMicrotask: 0.06649994850158691
    // promise then: 0.028399944305419922

    // after 10k repeat: 0.4475998878479004
  }, 60000);

  test('Attachable create, attach and destroy', async () => {
    await UnitTestHelper.testPerformance(() => {
      let parent = new Attachable().attachToRoot();
      new Attachable().attach(parent);
      parent.destroy();
    });
    // Min:  0.24699997901916504
    // lazy circular dep check: 0.24099993705749512
    // number ids: 0.33319997787475586
    // attach by id seperation: 0.21379995346069336

    // after 10k repeat: 1.4460999965667725
  }, 60000);

  test('IDAttachable create and destroy', async () => {
    await UnitTestHelper.testPerformance(() => {
      let object = new IDAttachable().attachToRoot();
      object.destroy();
    });
    // Min:  0.38810014724731445
    // queueMicrotask: 0.35089993476867676
    // storage change: 0.2955000400543213
    // id gen change: 0.19920015335083008
    // number ids: 0.1679999828338623

    // after 10k repeat: 1.1577999591827393
  }, 60000);

  test('IDAttachable create, attach directly and destroy', async () => {
    await UnitTestHelper.testPerformance(() => {
      let parent = new IDAttachable().attachToRoot();
      new Attachable().attach(parent);
      parent.destroy();
    });
    // 0.32539987564086914

    // after 10k repeat: 2.110300064086914
  }, 60000);

  test('IDAttachable create, attach by id and destroy', async () => {
    await UnitTestHelper.testPerformance(() => {
      let parent = new IDAttachable().attachToRoot();
      new Attachable().attachByID(parent.id);
      parent.destroy();
    });
    // Min:  0.601099967956543
    // storage change: 0.5199000835418701
    // id gen change: 0.4216001033782959
    // number ids: 0.3815000057220459
    // attach by id seperation: 0.3644998073577881

    // after 10k repeat: 2.153200149536133
  }, 60000);

  test('onDestroy callback', async () => {
    await UnitTestHelper.testPerformance(() => {
      let attachable = new IDAttachable().attachToRoot();
      attachable
        .onDestroy()
        .tap(() => {})
        .attachToRoot();
      attachable.destroy();
    });
    // Min:  0.7037999629974365
    // queueMicrotask: 0.6399998664855957
    // single event: 0.6326999664306641
    // storage change: 0.5597000122070312
    // id gen change: 0.47520017623901367
    // number ids: 0.43039989471435547

    // after 10k repeat: 10.342999935150146
    // no callback: 10.265200138092041
  }, 60000);
});
