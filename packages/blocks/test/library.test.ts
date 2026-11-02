import { describe, expect, it } from 'vitest';
import { createLibrary, extents } from '../src/index.js';

const lib = createLibrary();

describe('블록 라이브러리 (1차)', () => {
  it('기준 설비 3종에 필요한 블록이 등록된다', () => {
    for (const id of [
      'frame-table',
      'roller-conveyor',
      'belt-conveyor',
      'stopper',
      'photo-sensor',
      'robot-6axis',
      'gripper-parallel',
      'pallet-tray',
      'servo-press',
      'light-curtain',
      'safety-door',
      'jig-fixture',
      'ng-pusher',
      'work-box',
      'source',
      'sink',
    ])
      expect(lib.get(id), id).toBeDefined();
    expect(lib.size).toBeGreaterThanOrEqual(30);
  });

  it('모든 블록: 기본값으로 지오메트리가 나오고 크기가 양수다', () => {
    for (const def of lib.list()) {
      const prims = lib.geometry(def.meta.id, lib.defaultParams(def.meta.id));
      expect(prims.length, def.meta.id).toBeGreaterThan(0);
      const [w, d, h] = extents(prims);
      expect(w > 0 && d > 0 && h > 0, `${def.meta.id} 크기 ${w}×${d}×${h}`).toBe(true);
    }
  });

  it('치수표 값은 전부 미확인(verified=false) 으로 시작한다', () => {
    for (const def of lib.list())
      for (const row of def.geometry.dimTable) expect(row.verified, def.meta.id).toBe(false);
  });

  it('움직이는 부품 이름은 관절 이름과 맞는다', () => {
    for (const def of lib.list()) {
      const names = new Set(def.joints.map((j) => j.name));
      for (const p of lib.geometry(def.meta.id, lib.defaultParams(def.meta.id)))
        if (p.part) expect(names.has(p.part), `${def.meta.id}: part ${p.part}`).toBe(true);
    }
  });

  it('파라미터 검증: 범위 밖·선택지 밖은 오류, 모르는 키는 버린다', () => {
    const ok = lib.validateParams('roller-conveyor', {
      length: 3000,
      pitch: 75,
      drive: 'free',
      junk: 1,
    });
    expect(ok.errors).toEqual([]);
    expect(ok.params['length']).toBe(3000);
    expect(ok.params['junk']).toBeUndefined();
    const bad = lib.validateParams('roller-conveyor', { length: 10, drive: 'magic' });
    expect(bad.errors).toHaveLength(2);
  });

  it('컨베이어는 길이에 따라 투입·배출 소켓이 양 끝에 생긴다', () => {
    const s = lib.sockets('roller-conveyor', {
      ...lib.defaultParams('roller-conveyor'),
      length: 3000,
      height: 800,
    });
    expect(s.find((x) => x.id === 'in')?.position).toEqual([-1500, 0, 800]);
    expect(s.find((x) => x.id === 'out')?.position).toEqual([1500, 0, 800]);
  });

  it('실린더를 놓으면 관절 1개와 태그 4개(FWD·BWD·LS×2) 초안이 나온다', () => {
    const j = lib.joints('compact-cylinder', {
      ...lib.defaultParams('compact-cylinder'),
      stroke: 75,
    });
    expect(j).toHaveLength(1);
    expect(j[0]).toMatchObject({
      type: 'lin',
      mode: 'onoff',
      min: 0,
      max: 75,
      vmax: 300,
      amax: 3000,
    });
    const io = lib.io('compact-cylinder', 'CYL1').map((x) => x.tag);
    expect(io).toEqual(['CYL1_FWD', 'CYL1_BWD', 'CYL1_FWD_LS', 'CYL1_BWD_LS']);
  });

  it('6축 로봇은 위치형 회전 관절 6개 (±범위) 와 프로그램 태그를 만든다', () => {
    const j = lib.joints('robot-6axis', lib.defaultParams('robot-6axis'));
    expect(j).toHaveLength(6);
    expect(j[0]).toMatchObject({ type: 'rot', mode: 'position', min: -170, max: 170 });
    expect(lib.io('robot-6axis', 'RB1').map((x) => x.tag)).toContain('RB1_START');
  });
});
