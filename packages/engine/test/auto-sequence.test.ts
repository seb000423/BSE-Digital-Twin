/**
 * 자동 운전 (동작 순서): "자동 만들기"가 만든 순서를 런타임이 돌려서 기준 설비가 한 사이클 이상 도는지.
 * 결정적: 같은 시드 → 같은 결과.
 */
import { describe, expect, it } from 'vitest';
import { createLibrary } from '@bse/blocks';
import {
  MachineEditor,
  createRng,
  createSeededIdFactory,
  generateSequence,
  getTemplate,
  newMachine,
  type TemplateId,
} from '../src/index.js';

const lib = createLibrary();
const fromTemplate = (id: TemplateId) => {
  const t = getTemplate(id);
  const newId = createSeededIdFactory(createRng(7));
  const ed = new MachineEditor(newMachine(newId(), t.name, t.bbox), { lib, newId });
  t.build(ed);
  return ed;
};

describe('자동 운전', () => {
  it('컨베이어 스테이션: 준비 → 워크 도착 대기 → 스토퍼 내림 → 통과 대기 → 스토퍼 올림', () => {
    const ed = fromTemplate('conveyor-station');
    const steps = generateSequence(ed.doc);
    expect(steps.map((s) => s.name)).toEqual([
      '준비 · 컨베이어 운전, 스토퍼 올림',
      '워크 도착 대기 (PS1)',
      '스토퍼 내림 · 통과 (STP1)',
      '통과 대기 (PS1 꺼짐)',
      '스토퍼 올림 (STP1)',
    ]);
    expect(steps[0]!.set.map((x) => x.tag).sort()).toEqual([
      'CV1_DIR',
      'CV1_RUN',
      'STP1_DOWN',
      'STP1_UP',
    ]);
  });

  it('generate_sequence 명령은 문서에 들어가고 실행 취소된다', () => {
    const ed = fromTemplate('conveyor-station');
    expect(ed.doc.sequence.steps).toHaveLength(0);
    expect(ed.dispatch({ cmd: 'generate_sequence' }).ok).toBe(true);
    expect(ed.doc.sequence.steps.length).toBeGreaterThan(1);
    ed.dispatch({ cmd: 'undo' });
    expect(ed.doc.sequence.steps).toHaveLength(0);
  });

  it('auto 로 돌리면 스텝이 넘어가고 워크가 싱크까지 간다 (결정적)', () => {
    const ed = fromTemplate('conveyor-station');
    ed.dispatch({ cmd: 'generate_sequence' });
    expect(ed.dispatch({ cmd: 'auto', on: true }).ok).toBe(false); // 실행 모드가 아님
    ed.dispatch({ cmd: 'run_demo', seed: 3, speed: 1 });
    expect(ed.dispatch({ cmd: 'auto', on: true }).ok).toBe(true);
    const rt = ed.run!;
    rt.advance(0.5);
    expect(rt.signals.get('CV1_RUN')).toBe(true);
    expect(rt.signals.get('STP1_UP')).toBe(true);
    expect(rt.auto.step).toBe(1); // 워크 도착 대기
    const seen = new Set<number>();
    for (let i = 0; i < 600; i++) {
      rt.advance(0.05);
      seen.add(rt.auto.step);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4]); // 준비(0)로는 돌아가지 않고 1~4 반복
    expect(rt.signals.get('SNK1_COUNT')).toBeGreaterThan(0);
    const snapshot = { t: rt.time, step: rt.auto.step, works: rt.works.length };

    // 같은 시드로 다시 돌리면 같다
    const ed2 = fromTemplate('conveyor-station');
    ed2.dispatch({ cmd: 'generate_sequence' });
    ed2.dispatch({ cmd: 'run_demo', seed: 3, speed: 1 });
    ed2.dispatch({ cmd: 'auto', on: true });
    ed2.run!.advance(30.5);
    expect({ t: ed2.run!.time, step: ed2.run!.auto.step, works: ed2.run!.works.length }).toEqual(
      snapshot,
    );
  });

  it('reset_works 는 시뮬이 만든 워크를 치우고 카운트를 0 으로', () => {
    const ed = fromTemplate('conveyor-station');
    ed.dispatch({ cmd: 'run_demo', seed: 1, speed: 1 });
    ed.dispatch({ cmd: 'force_tag', tag: 'CV1_RUN', value: true });
    ed.run!.advance(12);
    expect(ed.run!.works.length + Number(ed.run!.signals.get('SNK1_COUNT'))).toBeGreaterThan(0);
    expect(ed.dispatch({ cmd: 'reset_works' }).ok).toBe(true);
    expect(ed.run!.works).toHaveLength(0);
    expect(ed.run!.signals.get('SRC1_COUNT')).toBe(0);
    expect(ed.run!.signals.get('SNK1_COUNT')).toBe(0);
  });
});
