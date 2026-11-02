import { describe, expect, it } from 'vitest';
import { Machine } from '@bse/schema';
import { createLibrary } from '@bse/blocks';
import {
  MachineEditor,
  createRng,
  createSeededIdFactory,
  newMachine,
  uuidV7,
} from '../src/index.js';

const lib = createLibrary();
const make = () => {
  const newId = createSeededIdFactory(createRng(7));
  return new MachineEditor(newMachine(newId(), '시험 설비', [3000, 1200, 1800]), { lib, newId });
};

describe('UUID v7', () => {
  it('형식이 맞고 시각순으로 커진다', () => {
    const rng = createRng(1);
    const a = uuidV7(1_700_000_000_000, () => rng.next());
    const b = uuidV7(1_700_000_000_001, () => rng.next());
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });
  it('같은 시드 → 같은 id 열', () => {
    const f1 = createSeededIdFactory(createRng(3));
    const f2 = createSeededIdFactory(createRng(3));
    expect([f1(), f1()]).toEqual([f2(), f2()]);
  });
});

describe('편집 명령 실행기', () => {
  it('add_block: 노드 + 관절 + 태그 초안이 생기고 접두어가 번호를 단다', () => {
    const ed = make();
    const r1 = ed.dispatch({
      cmd: 'add_block',
      blockType: 'compact-cylinder',
      params: { stroke: 75 },
    });
    const r2 = ed.dispatch({ cmd: 'add_block', blockType: 'compact-cylinder' });
    expect(r1.ok && r2.ok).toBe(true);
    expect(ed.doc.nodes).toHaveLength(2);
    expect(ed.doc.joints).toHaveLength(2);
    expect(ed.doc.joints[0]).toMatchObject({
      type: 'lin',
      min: 0,
      max: 75,
      verified: { vmax: false, amax: false },
    });
    const tags = ed.doc.io.map((e) => e.tag);
    expect(tags).toEqual(
      expect.arrayContaining(['CYL1_FWD', 'CYL1_FWD_LS', 'CYL2_FWD', 'START', 'EMO']),
    );
    expect(ed.doc.io.find((e) => e.tag === 'CYL1_FWD')?.binding).toEqual({
      kind: 'joint',
      target: ed.doc.joints[0]!.id,
    });
  });

  it('잘못된 블록·파라미터는 거부하고 문서는 그대로다', () => {
    const ed = make();
    expect(ed.dispatch({ cmd: 'add_block', blockType: 'no-such-block' })).toMatchObject({
      ok: false,
    });
    expect(
      ed.dispatch({ cmd: 'add_block', blockType: 'stopper', params: { stroke: 99999 } }),
    ).toMatchObject({ ok: false });
    expect(ed.dispatch({ cmd: 'add_block', blockType: 'Bad Type' })).toMatchObject({ ok: false });
    expect(ed.doc.nodes).toHaveLength(0);
    expect(ed.canUndo).toBe(false);
  });

  it('set_param 은 소켓과 관절 범위를 같이 바꾼다', () => {
    const ed = make();
    ed.dispatch({ cmd: 'add_block', blockType: 'roller-conveyor', params: { length: 2000 } });
    const id = ed.doc.nodes[0]!.id;
    expect(ed.dispatch({ cmd: 'set_param', id, key: 'length', value: 3000 })).toMatchObject({
      ok: true,
    });
    expect(ed.doc.nodes[0]!.sockets.find((s) => s.id === 'out')?.position[0]).toBe(1500);
    ed.dispatch({ cmd: 'add_block', blockType: 'stopper' });
    const st = ed.doc.nodes[1]!;
    ed.dispatch({ cmd: 'set_param', id: st.id, key: 'stroke', value: 40 });
    expect(ed.doc.joints.find((j) => j.node === st.id)?.max).toBe(40);
    expect(ed.dispatch({ cmd: 'set_param', id: st.id, key: 'nope', value: 1 })).toMatchObject({
      ok: false,
    });
  });

  it('snap: 소켓 종류가 맞으면 부모가 되고 위치가 맞춰진다', () => {
    const ed = make();
    ed.dispatch({ cmd: 'add_block', blockType: 'robot-6axis' });
    ed.dispatch({ cmd: 'add_block', blockType: 'gripper-parallel' });
    const [robot, grip] = ed.doc.nodes;
    const r = ed.dispatch({
      cmd: 'snap',
      id: grip!.id,
      socket: 'base',
      targetId: robot!.id,
      targetSocket: 'flange',
    });
    expect(r).toMatchObject({ ok: true });
    const g = ed.doc.nodes[1]!;
    expect(g.parent).toBe(robot!.id);
    expect(g.transform.position).toEqual(robot!.sockets.find((s) => s.id === 'flange')!.position);
    const bad = ed.dispatch({
      cmd: 'snap',
      id: robot!.id,
      socket: 'base',
      targetId: grip!.id,
      targetSocket: 'grip',
    });
    expect(bad.ok).toBe(false);
  });

  it('undo / redo 는 문서를 통째로 되돌린다', () => {
    const ed = make();
    ed.dispatch({ cmd: 'add_block', blockType: 'frame-table' });
    ed.dispatch({ cmd: 'add_block', blockType: 'belt-conveyor' });
    expect(ed.doc.nodes).toHaveLength(2);
    expect(ed.dispatch({ cmd: 'undo' })).toMatchObject({ ok: true });
    expect(ed.doc.nodes).toHaveLength(1);
    expect(ed.doc.io.some((e) => e.tag === 'CV1_RUN')).toBe(false);
    ed.dispatch({ cmd: 'redo' });
    expect(ed.doc.nodes).toHaveLength(2);
    expect(ed.dispatch({ cmd: 'redo' })).toMatchObject({ ok: false });
  });

  it('remove 는 자손·관절·바인딩 태그를 함께 지운다', () => {
    const ed = make();
    ed.dispatch({ cmd: 'add_block', blockType: 'roller-conveyor' });
    const cv = ed.doc.nodes[0]!.id;
    ed.dispatch({ cmd: 'add_block', blockType: 'stopper', parent: cv });
    ed.dispatch({ cmd: 'remove', ids: [cv] });
    expect(ed.doc.nodes).toHaveLength(0);
    expect(ed.doc.joints).toHaveLength(0);
    expect(ed.doc.io.some((e) => e.tag.startsWith('STP1') || e.tag.startsWith('CV1'))).toBe(false);
  });

  it('rename_tag·bind_tag·add_joint·set_joint', () => {
    const ed = make();
    ed.dispatch({ cmd: 'add_block', blockType: 'plate' });
    const node = ed.doc.nodes[0]!.id;
    const aj = ed.dispatch({
      cmd: 'add_joint',
      node,
      type: 'lin',
      axis: [0, 0, 1],
      mode: 'onoff',
      max: 100,
      vmax: 200,
      amax: 1000,
    });
    expect(aj.ok && aj.created.length).toBe(1);
    const jid = ed.doc.joints[0]!.id;
    expect(ed.dispatch({ cmd: 'set_joint', id: jid, patch: { home: 500 } })).toMatchObject({
      ok: false,
    });
    expect(
      ed.dispatch({ cmd: 'set_joint', id: jid, patch: { vmax: 250, verified: { vmax: true } } }),
    ).toMatchObject({ ok: true });
    expect(ed.doc.joints[0]).toMatchObject({ vmax: 250, verified: { vmax: true, amax: false } });
    ed.dispatch({ cmd: 'bind_tag', tag: 'LIFT_UP', kind: 'joint', target: jid });
    ed.dispatch({ cmd: 'rename_tag', from: 'LIFT_UP', to: 'LIFT1_UP' });
    expect(ed.doc.io.find((e) => e.tag === 'LIFT1_UP')?.binding?.target).toBe(jid);
    expect(ed.dispatch({ cmd: 'rename_tag', from: 'LIFT1_UP', to: 'START' })).toMatchObject({
      ok: false,
    });
  });

  it('공장·시뮬 명령은 설비 범위에서 거부된다', () => {
    const ed = make();
    expect(
      ed.dispatch({
        cmd: 'draw_wall',
        level: 'L1',
        polyline: [
          [0, 0],
          [1, 1],
        ],
        height: 3000,
      }),
    ).toMatchObject({ ok: false });
    expect(ed.dispatch({ cmd: 'force_tag', tag: 'START', value: true })).toMatchObject({
      ok: false,
    });
  });

  it('내보낸 machine.json 은 스키마를 통과한다', () => {
    const ed = make();
    ed.dispatch({ cmd: 'add_block', blockType: 'servo-press' });
    ed.dispatch({ cmd: 'make_card' });
    const parsed = Machine.parse(JSON.parse(ed.exportJson()));
    expect(parsed.card.cycle_time).toBe(8);
    expect(parsed.schema).toBe('bse-twin/machine@1');
    expect(ed.log.every((l) => l.result.ok)).toBe(true);
  });
});
