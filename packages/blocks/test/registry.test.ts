import { describe, expect, it } from 'vitest';
import { BlockRegistry } from '../src/index.js';

const airCylinder = {
  meta: { id: 'air-cylinder', name: '공압 실린더', category: 'actuator_pneumatic' },
  params: [
    {
      key: 'bore',
      label: '보어',
      type: 'enum',
      unit: 'mm',
      options: ['20', '25', '32', '40', '50', '63'],
      default: '32',
    },
    {
      key: 'stroke',
      label: '스트로크',
      type: 'number',
      unit: 'mm',
      min: 5,
      max: 1000,
      default: 50,
    },
  ],
  geometry: {
    fn: 'airCylinder',
    dimTable: [{ key: '32', values: { body_w: 40, rod_d: 12 }, verified: false }],
  },
  joints: [{ name: 'rod', type: 'lin', axis: [0, 0, 1], mode: 'onoff', rangeFrom: 'stroke' }],
  ioTemplate: [
    { tag: '{n}_FWD', dir: 'out', type: 'bool', binding: 'joint' },
    { tag: '{n}_BWD', dir: 'out', type: 'bool', binding: 'joint' },
    { tag: '{n}_FWD_LS', dir: 'in', type: 'bool', binding: 'sensor' },
    { tag: '{n}_BWD_LS', dir: 'in', type: 'bool', binding: 'sensor' },
  ],
};

describe('블록 레지스트리', () => {
  it('정의를 검증해 등록한다', () => {
    const r = new BlockRegistry();
    const d = r.register(airCylinder);
    expect(d.meta.fidelity).toBe('L2');
    expect(d.geometry.dimTable[0]?.verified).toBe(false);
    expect(r.list()).toHaveLength(1);
    expect(() => r.register(airCylinder)).toThrow(/중복/);
  });
  it('kebab-case 가 아닌 id 는 거부', () => {
    expect(() =>
      new BlockRegistry().register({
        ...airCylinder,
        meta: { ...airCylinder.meta, id: 'AirCylinder' },
      }),
    ).toThrow();
  });
});
