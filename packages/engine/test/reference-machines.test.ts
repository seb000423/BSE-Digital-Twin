/**
 * 게이트 1 초안 (지침서 10.1절): 기준 설비 3종을 편집 명령만으로 조립하고, 태그를 켜서 동작을 확인한다.
 * 치수·속도는 예시값(verified=false). 오너의 현장 자료가 오면 이 값들을 바꾼다.
 */
import { describe, expect, it } from 'vitest';
import { createLibrary } from '@bse/blocks';
import {
  MachineEditor,
  createRng,
  createSeededIdFactory,
  getTemplate,
  newMachine,
  type TemplateId,
} from '../src/index.js';

const lib = createLibrary();
/** 템플릿(홈 화면 카드와 같은 함수)으로 조립한 편집기 */
const fromTemplate = (id: TemplateId) => {
  const t = getTemplate(id);
  const newId = createSeededIdFactory(createRng(42));
  const ed = new MachineEditor(newMachine(newId(), t.name, t.bbox), { lib, newId });
  t.build(ed);
  return ed;
};
const byType = (ed: MachineEditor, blockType: string) =>
  ed.doc.nodes.find((n) => n.blockType === blockType)!.id;
const must = (ed: MachineEditor, cmd: unknown): string[] => {
  const r = ed.dispatch(cmd);
  if (!r.ok) throw new Error(`${JSON.stringify(cmd)} → ${r.error}`);
  return r.created;
};

describe('기준 설비 1: 컨베이어 스테이션', () => {
  const ed = fromTemplate('conveyor-station');
  const cv = byType(ed, 'roller-conveyor');

  it('태그 표가 만들어진다 (컨베이어 RUN/DIR/SPEED, 스토퍼 UP/DOWN/LS, 센서 ON, 설비 공통)', () => {
    const tags = ed.doc.io.map((e) => e.tag);
    for (const t of [
      'CV1_RUN',
      'CV1_DIR',
      'CV1_SPEED',
      'STP1_UP',
      'STP1_DOWN',
      'STP1_UP_LS',
      'STP1_DOWN_LS',
      'PS1_ON',
      'SRC1_COUNT',
      'SNK1_COUNT',
      'START',
      'EMO',
      'LMP1_G',
    ])
      expect(tags, t).toContain(t);
    expect(ed.doc.card.inlet).toBe(`${cv}.in`);
  });

  it('RUN 을 켜면 워크가 흐르고, 센서를 지나며, 올라온 스토퍼 앞에서 멈춘 뒤, 내리면 싱크에 도착한다', () => {
    must(ed, { cmd: 'run_demo', seed: 1 });
    const rt = ed.run!;
    must(ed, { cmd: 'force_tag', tag: 'STP1_UP', value: true });
    must(ed, { cmd: 'force_tag', tag: 'CV1_RUN', value: true });
    rt.advance(0.5);
    expect(rt.signals.get('STP1_UP_LS')).toBe(true);
    expect(rt.works.length).toBe(1); // 소스가 첫 워크를 냈다
    expect(rt.signals.get('PS1_ON')).toBe(false);
    rt.advance(8); // 1900mm 를 300mm/s 로 ≈ 6.3s(가속 포함), 스토퍼(1000) 앞에서 멈춤
    const w = rt.works[0]!;
    expect(w.x).toBeLessThanOrEqual(1000 - 50 - 10 + 1e-6);
    expect(w.x).toBeGreaterThan(900);
    expect(rt.signals.get('SNK1_COUNT')).toBe(0);
    // 센서(600) 를 지나는 동안 ON 이 한 번은 켜졌는지: 처음부터 다시 돌려 확인
    must(ed, { cmd: 'force_tag', tag: 'STP1_UP', value: false });
    must(ed, { cmd: 'force_tag', tag: 'STP1_DOWN', value: true });
    rt.advance(3);
    expect(rt.signals.get('STP1_DOWN_LS')).toBe(true);
    expect(rt.signals.get('SNK1_COUNT')).toBe(1);
  });

  it('같은 시드면 결과가 같다 (결정성)', () => {
    const run = () => {
      must(ed, { cmd: 'run_demo', seed: 9 });
      const rt = ed.run!;
      must(ed, { cmd: 'force_tag', tag: 'CV1_RUN', value: true });
      const seen: boolean[] = [];
      for (let i = 0; i < 1200; i++) {
        rt.step();
        seen.push(rt.signals.get('PS1_ON') === true);
      }
      return { seen, x: rt.works.map((w) => w.x) };
    };
    const a = run();
    const b = run();
    expect(a).toEqual(b);
    expect(a.seen.some(Boolean)).toBe(true);
  });
});

describe('기준 설비 2: 픽앤플레이스 셀', () => {
  const ed = fromTemplate('pick-place-cell');
  const robot = byType(ed, 'robot-6axis');
  const grip = byType(ed, 'gripper-parallel');

  it('로봇 관절 6 + 그리퍼 관절 1, 태그에 PGM_NO·START·INPOS 와 OPEN/CLOSE 가 있다', () => {
    expect(ed.doc.joints.filter((j) => j.node === robot)).toHaveLength(6);
    expect(ed.doc.nodes.find((n) => n.id === grip)?.parent).toBe(robot);
    const tags = ed.doc.io.map((e) => e.tag);
    for (const t of [
      'RB1_PGM_NO',
      'RB1_START',
      'RB1_INPOS',
      'RB1_RUNNING',
      'GRP1_OPEN',
      'GRP1_CLOSE',
      'GRP1_CLOSE_LS',
      'LC1_SAFE',
      'PLT1_FULL',
    ])
      expect(tags, t).toContain(t);
    expect(ed.doc.joints.every((j) => !j.verified.vmax && !j.verified.amax)).toBe(true);
  });

  it('START 로 프로그램 1사이클(4 s)을 돌면 RUNNING → INPOS, 그리퍼 CLOSE 로 손가락이 닫히고 CLOSE_LS', () => {
    must(ed, { cmd: 'run_demo', seed: 1 });
    const rt = ed.run!;
    must(ed, { cmd: 'force_tag', tag: 'RB1_START', value: true });
    rt.advance(0.1);
    expect(rt.signals.get('RB1_RUNNING')).toBe(true);
    expect(rt.signals.get('RB1_INPOS')).toBe(false);
    rt.advance(4);
    expect(rt.signals.get('RB1_RUNNING')).toBe(false);
    expect(rt.signals.get('RB1_INPOS')).toBe(true);
    must(ed, { cmd: 'force_tag', tag: 'GRP1_CLOSE', value: true });
    rt.advance(1);
    const finger = ed.doc.joints.find((j) => j.node === grip)!;
    expect(rt.jointState(finger.id)?.pos).toBe(15);
    expect(rt.signals.get('GRP1_CLOSE_LS')).toBe(true);
    expect(rt.signals.get('GRP1_OPEN_LS')).toBe(false);
  });
});

describe('기준 설비 3: 프레스 스테이션', () => {
  const ed = fromTemplate('press-station');
  const press = byType(ed, 'servo-press');

  it('카드(L1)는 공정 시간 8 s 를 그대로 받는다', () => {
    expect(ed.doc.card.cycle_time).toBe(8);
    expect(ed.doc.card.footprint).toEqual([2400, 2000]);
  });

  it('슬라이드 위치 지령 → 내려가고 INPOS, START → 8 s 뒤 DONE 과 OK/NG 판정(시드 고정)', () => {
    must(ed, { cmd: 'run_demo', seed: 5 });
    const rt = ed.run!;
    const slide = ed.doc.joints.find((j) => j.node === press)!;
    must(ed, { cmd: 'force_tag', tag: 'PRS1_POS_CMD', value: 150 });
    rt.advance(3);
    expect(rt.jointState(slide.id)?.pos).toBe(150);
    expect(rt.signals.get('PRS1_POS_FB')).toBe(150);
    expect(rt.signals.get('PRS1_INPOS')).toBe(true);
    must(ed, { cmd: 'force_tag', tag: 'PRS1_START', value: true });
    rt.advance(0.05);
    expect(rt.signals.get('PRS1_BUSY')).toBe(true);
    rt.advance(8);
    expect(rt.signals.get('PRS1_BUSY')).toBe(false);
    expect(rt.signals.get('PRS1_DONE')).toBe(true);
    const ok = rt.signals.get('PRS1_OK');
    expect(ok !== rt.signals.get('PRS1_NG')).toBe(true);
    // 시드 고정 → 판정도 고정
    must(ed, { cmd: 'run_demo', seed: 5 });
    must(ed, { cmd: 'force_tag', tag: 'PRS1_START', value: true });
    ed.run!.advance(8.1);
    expect(ed.run!.signals.get('PRS1_OK')).toBe(ok);
  });

  it('클램프와 NG 푸셔는 온오프 관절로 움직인다', () => {
    must(ed, { cmd: 'run_demo', seed: 1 });
    const rt = ed.run!;
    must(ed, { cmd: 'force_tag', tag: 'JIG1_CLAMP', value: true });
    must(ed, { cmd: 'force_tag', tag: 'NGP1_PUSH', value: true });
    rt.advance(2);
    expect(rt.signals.get('JIG1_CLAMP_LS')).toBe(true);
    expect(rt.signals.get('NGP1_PUSH_LS')).toBe(true);
    expect(rt.signals.get('NGP1_BACK_LS')).toBe(false);
  });
});
