import { describe, expect, it } from 'vitest';
import { Factory } from '../src/index.js';
import { ID, smallFactory } from './fixtures.js';

describe('factory.json', () => {
  it('기준 공장 예시가 통과한다', () => {
    const f = Factory.parse(smallFactory);
    expect(f.machines).toHaveLength(2);
    expect(f.nav).toEqual({ nodes: [], edges: [], docks: [] });
    expect(f.spec).toEqual({
      electrical: null,
      pneumatic: null,
      gas: null,
      water: null,
      meta: { spec_version: '1.0', verified: false },
    });
  });
  it('tagPrefix 중복과 벽 없는 개구부를 잡는다', () => {
    const bad = structuredClone(smallFactory);
    bad.machines![1]!.tagPrefix = 'ST01.M1';
    bad.building!.openings![0]!.wall = ID.door;
    const r = Factory.safeParse(bad);
    expect(r.success).toBe(false);
    const msgs = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(msgs.some((s) => s.startsWith('tagPrefix 중복'))).toBe(true);
    expect(msgs.some((s) => s.startsWith('개구부의 벽 없음'))).toBe(true);
  });
  it('설비 참조는 machineId@x.y.z 형식', () => {
    const bad = structuredClone(smallFactory);
    bad.machines![0]!.ref = 'conveyor';
    expect(Factory.safeParse(bad).success).toBe(false);
  });
});
