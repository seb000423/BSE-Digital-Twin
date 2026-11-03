/**
 * 간이 동작 순서 자동 생성 (V1, "자동 만들기"): 블록과 태그만 보고 설비가 한 사이클 도는 순서를 만든다.
 * 스텝 = 출력 세트(set) + 전이 조건(wait, 모두 만족하면 다음) + timeout_ms(조건이 없으면 그냥 기다리는 시간).
 * 규칙은 기준 설비 3종(컨베이어 스테이션 · 픽앤플레이스 · 프레스)을 돌리는 데 필요한 만큼만. 정식 SFC 는 R2.
 * 마지막 스텝 뒤에는 두 번째 스텝(준비 다음)으로 돌아가 반복한다 (런타임이 처리).
 */
import type { Machine, MachineNode, SequenceStep } from '@bse/schema';

const CONVEYORS = new Set(['roller-conveyor', 'belt-conveyor']);

type Tag = { tag: string; value: boolean | number };

export function generateSequence(doc: Machine): SequenceStep[] {
  const tags = new Set(doc.io.map((e) => e.tag));
  const has = (t: string) => tags.has(t);
  const prefixOf = (n: MachineNode): string => {
    const b = n.components['block'];
    return b && typeof b === 'object' && 'prefix' in b
      ? String((b as { prefix: string }).prefix)
      : '';
  };
  const blocks = doc.nodes.filter((n) => n.type === 'block' && n.blockType);
  const steps: SequenceStep[] = [];
  let seq = 0;
  const step = (name: string, set: Tag[] = [], wait: Tag[] = [], timeout_ms?: number) => {
    const s: SequenceStep = { id: `s${++seq}`, name, set, wait };
    if (timeout_ms) s.timeout_ms = timeout_ms;
    steps.push(s);
  };

  // 1. 준비: 컨베이어 운전, 스토퍼 올림, 서보 켜기
  const prep: Tag[] = [];
  const conveyors = blocks.filter((n) => CONVEYORS.has(n.blockType!));
  const stoppers = blocks.filter((n) => n.blockType === 'stopper');
  for (const c of conveyors) {
    const p = prefixOf(c);
    if (has(`${p}_RUN`)) prep.push({ tag: `${p}_RUN`, value: true });
    if (has(`${p}_DIR`)) prep.push({ tag: `${p}_DIR`, value: false });
  }
  for (const s of stoppers) {
    const p = prefixOf(s);
    if (has(`${p}_UP`)) prep.push({ tag: `${p}_UP`, value: true });
    if (has(`${p}_DOWN`)) prep.push({ tag: `${p}_DOWN`, value: false });
  }
  for (const n of blocks) {
    const p = prefixOf(n);
    if (has(`${p}_SVON`)) prep.push({ tag: `${p}_SVON`, value: true });
  }
  const prepName = [
    conveyors.length ? '컨베이어 운전' : '',
    stoppers.length ? '스토퍼 올림' : '',
    prep.some((t) => t.tag.endsWith('_SVON')) ? '서보 켜기' : '',
  ]
    .filter(Boolean)
    .join(', ');
  step(prepName ? `준비 · ${prepName}` : '준비', prep, [], 300);

  // 2. 컨베이어마다: 센서 → (공정) → 스토퍼 통과. 같은 컨베이어 위의 자식 블록을 X 순서로
  for (const c of conveyors) {
    const kids = blocks
      .filter((n) => n.parent === c.id)
      .sort((a, b) => a.transform.position[0] - b.transform.position[0]);
    const sensors = kids.filter((n) => has(`${prefixOf(n)}_ON`));
    const procs = kids.filter((n) => has(`${prefixOf(n)}_START`) && has(`${prefixOf(n)}_DONE`));
    const stps = kids.filter((n) => n.blockType === 'stopper');
    const ps = sensors[0];
    if (ps)
      step(`워크 도착 대기 (${prefixOf(ps)})`, [], [{ tag: `${prefixOf(ps)}_ON`, value: true }]);
    for (const pr of procs) {
      const p = prefixOf(pr);
      step(
        `가공 시작 (${p})`,
        [{ tag: `${p}_START`, value: true }],
        [{ tag: `${p}_BUSY`, value: true }],
        1000,
      );
      step(
        `가공 완료 대기 (${p})`,
        [{ tag: `${p}_START`, value: false }],
        [{ tag: `${p}_DONE`, value: true }],
      );
    }
    for (const st of stps) {
      const p = prefixOf(st);
      step(
        `스토퍼 내림 · 통과 (${p})`,
        [
          { tag: `${p}_UP`, value: false },
          { tag: `${p}_DOWN`, value: true },
        ],
        has(`${p}_DOWN_LS`) ? [{ tag: `${p}_DOWN_LS`, value: true }] : [],
        has(`${p}_DOWN_LS`) ? undefined : 500,
      );
      step(
        ps ? `통과 대기 (${prefixOf(ps)} 꺼짐)` : '통과 대기',
        [],
        ps ? [{ tag: `${prefixOf(ps)}_ON`, value: false }] : [],
        ps ? 3000 : 1500,
      );
      step(
        `스토퍼 올림 (${p})`,
        [
          { tag: `${p}_DOWN`, value: false },
          { tag: `${p}_UP`, value: true },
        ],
        has(`${p}_UP_LS`) ? [{ tag: `${p}_UP_LS`, value: true }] : [],
        has(`${p}_UP_LS`) ? undefined : 500,
      );
    }
  }

  // 3. 로봇: 시작 → 동작 중 → 위치 도달
  for (const r of blocks.filter((n) => n.blockType === 'robot-6axis')) {
    const p = prefixOf(r);
    if (!has(`${p}_START`)) continue;
    step(
      `로봇 동작 (${p})`,
      [{ tag: `${p}_START`, value: true }],
      [{ tag: `${p}_RUNNING`, value: true }],
      1000,
    );
    step(
      `로봇 완료 대기 (${p})`,
      [{ tag: `${p}_START`, value: false }],
      [{ tag: `${p}_INPOS`, value: true }],
    );
  }

  // 4. 컨베이어에 안 붙은 공정 블록(프레스 등): 시작 → 완료
  const onConv = new Set(conveyors.map((c) => c.id));
  for (const pr of blocks.filter(
    (n) =>
      n.blockType !== 'robot-6axis' &&
      !onConv.has(n.parent ?? '') &&
      has(`${prefixOf(n)}_START`) &&
      has(`${prefixOf(n)}_DONE`),
  )) {
    const p = prefixOf(pr);
    step(
      `가공 시작 (${p})`,
      [{ tag: `${p}_START`, value: true }],
      [{ tag: `${p}_BUSY`, value: true }],
      1000,
    );
    step(
      `가공 완료 대기 (${p})`,
      [{ tag: `${p}_START`, value: false }],
      [{ tag: `${p}_DONE`, value: true }],
    );
  }

  if (steps.length === 1) step('사이클 끝 · 1 초 기다림', [], [], 1000);
  return steps;
}
