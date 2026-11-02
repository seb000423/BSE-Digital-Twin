import { describe, expect, it } from 'vitest';
import { Machine, emptyMachineSpec } from '../src/index.js';
import { ID, conveyorStation } from './fixtures.js';

describe('machine.json', () => {
  it('기준 설비 예시가 통과하고 기본값이 채워진다', () => {
    const m = Machine.parse(conveyorStation);
    expect(m.meta.version).toBe('0.1.0');
    expect(m.spec).toEqual(emptyMachineSpec()); // spec 13섹션은 항상 존재, null
    expect(m.ext).toEqual({ aas: null, usd: null });
    expect(m.joints[0]?.verified).toEqual({ vmax: false, amax: false }); // 미확인 값은 verified=false
    expect(m.nodes[1]?.transform.rotation).toEqual([0, 0, 0]);
    expect(m.nodes[0]?.transform).toEqual({ position: [0, 0, 0], rotation: [0, 0, 0] }); // 생략 → 안쪽 기본값까지
    expect(m.spec.meta).toEqual({ spec_version: '1.0', verified: false });
    expect(Object.keys(m.spec)).toHaveLength(13);
  });
  it('스키마 id 가 다르면 거부한다', () => {
    expect(Machine.safeParse({ ...conveyorStation, schema: 'bse-twin/machine@2' }).success).toBe(
      false,
    );
  });
  it('없는 부모·없는 관절 노드·중복 태그를 잡는다', () => {
    const bad = structuredClone(conveyorStation);
    bad.nodes![2]!.parent = ID.factory;
    bad.joints![1]!.node = ID.factory;
    bad.io!.push({ tag: 'CV1_RUN', dir: 'in', type: 'bool' });
    const r = Machine.safeParse(bad);
    expect(r.success).toBe(false);
    const msgs = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(msgs.some((s) => s.startsWith('부모 노드 없음'))).toBe(true);
    expect(msgs.some((s) => s.startsWith('관절의 노드 없음'))).toBe(true);
    expect(msgs.some((s) => s.startsWith('태그 중복'))).toBe(true);
  });
  it('surface 관절은 max 없이, rot·lin 은 max 필수', () => {
    const bad = structuredClone(conveyorStation);
    delete bad.joints![1]!.max;
    expect(Machine.safeParse(bad).success).toBe(false);
  });
  it('관절 축은 단위 벡터, home 은 범위 안', () => {
    const bad = structuredClone(conveyorStation);
    bad.joints![1]!.axis = [0, 0, 2];
    expect(Machine.safeParse(bad).success).toBe(false);
    const bad2 = structuredClone(conveyorStation);
    bad2.joints![1]!.home = 80;
    expect(Machine.safeParse(bad2).success).toBe(false);
  });
});
