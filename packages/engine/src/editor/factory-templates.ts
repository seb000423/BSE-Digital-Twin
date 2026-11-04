/**
 * 공장 뼈대 만들기 (팩토리빌더 1차): 숫자 몇 개(가로·세로·높이·기둥 간격)로 바닥 → 둘레 벽 → 기둥 → 지붕 → 문을
 * 편집 명령만으로 올린다. 홈의 "새 공장"과 회귀 테스트가 같은 함수를 쓴다. 좌표: 공장 원점 = 바닥 가운데, X 투입→배출.
 */
import type { FactoryEditor } from './factory-session.js';

export interface ShellOptions {
  /** 건물 가로 (X, mm) */
  width: number;
  /** 건물 세로 (Y, mm) */
  depth: number;
  /** 처마 높이 (mm) */
  height: number;
  /** 기둥 간격 [X, Y] (mm). 0 이면 기둥 없음 */
  bay: [number, number];
  level?: string;
  /** 지붕을 얹을지 (기본 true) */
  roof?: boolean;
}

export const DEFAULT_SHELL: ShellOptions = {
  width: 24000,
  depth: 16000,
  height: 7000,
  bay: [8000, 7000],
};

const must = (ed: FactoryEditor, cmd: unknown): string[] => {
  const r = ed.dispatch(cmd);
  if (!r.ok) throw new Error(`${JSON.stringify(cmd)} → ${r.error}`);
  return r.created;
};

/** 바닥·둘레 벽(폴리라인 하나)·기둥 격자·지붕·셔터 1·출입문 1·비상구 1 */
export function buildShell(ed: FactoryEditor, o: ShellOptions = DEFAULT_SHELL): void {
  const level = o.level ?? ed.doc.meta.levels[0]?.id ?? 'L1';
  const hw = o.width / 2;
  const hd = o.depth / 2;
  const rect: [number, number][] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  must(ed, { cmd: 'draw_slab', level, polygon: rect });
  const [wall] = must(ed, {
    cmd: 'draw_wall',
    level,
    polyline: [...rect, rect[0]!],
    height: o.height,
    thickness: 200,
  });
  if (o.bay[0] > 0 && o.bay[1] > 0) {
    const nx = Math.max(0, Math.floor((o.width - 2000) / o.bay[0]) - 1);
    const ny = Math.max(0, Math.floor((o.depth - 2000) / o.bay[1]) - 1);
    if (nx > 0 && ny > 0)
      must(ed, {
        cmd: 'place_columns',
        level,
        origin: [-((nx - 1) * o.bay[0]) / 2, -((ny - 1) * o.bay[1]) / 2],
        pitch: o.bay,
        count: [nx, ny],
        height: o.height,
      });
  }
  if (o.roof !== false) must(ed, { cmd: 'draw_roof', polygon: rect, height: o.height });
  // 개구부: 앞벽(투입 쪽, X-) 가운데 셔터, 옆벽(Y-) 출입문, 뒷벽(X+) 비상구. offset 은 폴리라인 시작점(-hw,-hd)부터
  const shutterW = Math.min(5000, o.width * 0.2);
  const doorH = Math.min(2400, o.height - 500);
  const shutterH = Math.min(4500, o.height - 500);
  must(ed, {
    cmd: 'add_opening',
    wall,
    kind: 'shutter',
    offset: o.width * 0.5 - shutterW / 2,
    width: shutterW,
    height: shutterH,
  });
  must(ed, {
    cmd: 'add_opening',
    wall,
    kind: 'door',
    offset: o.width + o.depth * 0.25,
    width: 1200,
    height: doorH,
  });
  must(ed, {
    cmd: 'add_opening',
    wall,
    kind: 'emergency_exit',
    offset: o.width + o.depth + o.width * 0.75,
    width: 1000,
    height: doorH,
  });
}

/** 설비를 X 방향 한 줄로 놓고 앞뒤로 흐름을 잇는다. footprint 는 [W, D] mm */
export function placeLine(
  ed: FactoryEditor,
  machines: { ref: string; footprint: [number, number] }[],
  gap = 1500,
  y = 0,
): string[] {
  const total = machines.reduce((s, m) => s + m.footprint[0], 0) + gap * (machines.length - 1);
  let x = -total / 2;
  const ids: string[] = [];
  for (const m of machines) {
    const cx = x + m.footprint[0] / 2;
    const [id] = must(ed, {
      cmd: 'place_machine',
      ref: m.ref,
      transform: { position: [cx, y, 0] },
    });
    ids.push(id!);
    x += m.footprint[0] + gap;
  }
  for (let i = 1; i < ids.length; i++)
    must(ed, { cmd: 'connect_flow', from: `${ids[i - 1]}.out`, to: `${ids[i]}.in` });
  return ids;
}
