/**
 * 팩토리빌더 1차: 뼈대 만들기 → 설비 배치 → 흐름 → 옮기기·지우기·실행 취소. 결과는 Factory 스키마로 다시 검증.
 */
import { describe, expect, it } from 'vitest';
import { Factory } from '@bse/schema';
import {
  FactoryEditor,
  buildShell,
  createRng,
  createSeededIdFactory,
  newFactory,
  nextTagPrefix,
  placeLine,
  polylineLength,
} from '../src/index.js';

const make = () => {
  const newId = createSeededIdFactory(createRng(11));
  return new FactoryEditor(newFactory(newId(), '시험 공장'), { newId });
};
const ref = (ed: FactoryEditor) => `${ed.doc.meta.id}@0.1.0`;

describe('팩토리빌더', () => {
  it('뼈대: 바닥 1 · 둘레 벽 1(4변) · 기둥 격자 · 지붕 · 개구부 3', () => {
    const ed = make();
    buildShell(ed, { width: 36000, depth: 24000, height: 8000, bay: [9000, 8000] });
    const b = ed.doc.building;
    expect(b.slabs).toHaveLength(1);
    expect(b.walls).toHaveLength(1);
    expect(polylineLength(b.walls[0]!.polyline)).toBe(120000);
    expect(b.columns.length).toBe(2 * 1); // (36-2)/9=3 → 2 칸, (24-2)/8=2 → 1
    expect(b.roofs).toHaveLength(1);
    expect(b.openings.map((o) => o.kind)).toEqual(['shutter', 'door', 'emergency_exit']);
    expect(() => Factory.parse(ed.doc)).not.toThrow();
  });

  it('개구부는 벽 길이·높이를 벗어나면 거부', () => {
    const ed = make();
    const r = ed.dispatch({
      cmd: 'draw_wall',
      level: 'L1',
      polyline: [
        [0, 0],
        [10000, 0],
      ],
      height: 6000,
    });
    expect(r.ok && r.created[0]).toBeTruthy();
    const wall = r.ok ? r.created[0]! : '';
    expect(
      ed.dispatch({
        cmd: 'add_opening',
        wall,
        kind: 'door',
        offset: 9500,
        width: 1000,
        height: 2000,
      }).ok,
    ).toBe(false);
    expect(
      ed.dispatch({
        cmd: 'add_opening',
        wall,
        kind: 'door',
        offset: 100,
        width: 1000,
        height: 7000,
      }).ok,
    ).toBe(false);
    expect(
      ed.dispatch({
        cmd: 'add_opening',
        wall,
        kind: 'door',
        offset: 100,
        width: 1000,
        height: 2000,
      }).ok,
    ).toBe(true);
  });

  it('설비 배치: 접두어 ST01.M1 부터 자동, 중복 거부, 흐름 연결, 옮기기, 지우면 흐름도 같이', () => {
    const ed = make();
    const ids = placeLine(ed, [
      { ref: ref(ed), footprint: [4000, 1200] },
      { ref: ref(ed), footprint: [2500, 2500] },
      { ref: ref(ed), footprint: [2400, 2000] },
    ]);
    expect(ed.doc.machines.map((m) => m.tagPrefix)).toEqual(['ST01.M1', 'ST02.M1', 'ST03.M1']);
    expect(nextTagPrefix(ed.doc)).toBe('ST04.M1');
    expect(ed.doc.flows).toHaveLength(2);
    expect(ed.doc.machines[0]!.transform.position[0]).toBeLessThan(
      ed.doc.machines[2]!.transform.position[0],
    );
    expect(ed.dispatch({ cmd: 'place_machine', ref: ref(ed), tagPrefix: 'ST01.M1' }).ok).toBe(
      false,
    );
    expect(ed.dispatch({ cmd: 'connect_flow', from: `${ids[0]}.out`, to: `${ids[1]}.in` }).ok).toBe(
      false,
    ); // 이미 있음
    expect(
      ed.dispatch({
        cmd: 'move',
        id: ids[1]!,
        transform: { position: [0, 5000, 0], rotation: [0, 0, 90] },
      }).ok,
    ).toBe(true);
    expect(ed.doc.machines[1]!.transform.rotation[2]).toBe(90);
    expect(ed.dispatch({ cmd: 'remove', ids: [ids[1]!] }).ok).toBe(true);
    expect(ed.doc.machines).toHaveLength(2);
    expect(ed.doc.flows).toHaveLength(0);
    expect(ed.dispatch({ cmd: 'undo' }).ok).toBe(true);
    expect(ed.doc.machines).toHaveLength(3);
    expect(ed.doc.flows).toHaveLength(2);
    expect(() => Factory.parse(JSON.parse(ed.exportJson()))).not.toThrow();
  });

  it('같은 시드면 같은 문서 (결정적)', () => {
    const a = make();
    const b = make();
    buildShell(a);
    buildShell(b);
    expect(a.exportJson()).toBe(b.exportJson());
  });
});
