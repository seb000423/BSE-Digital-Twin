/**
 * 기준 설비 3종 템플릿 (지침서 6.6절, 게이트 1): 편집 명령만으로 조립한다.
 * 치수·속도는 예시값(verified=false). 오너의 현장 자료가 오면 이 값들을 바꾼다.
 * 홈 화면의 설비 카드와 회귀 테스트가 같은 함수를 쓴다.
 */
import type { MachineEditor } from './session.js';

export type TemplateId = 'conveyor-station' | 'pick-place-cell' | 'press-station';

export interface MachineTemplate {
  id: TemplateId;
  name: string;
  bbox: [number, number, number];
  /** 한 줄 설명 (홈 카드) */
  summary: string;
  build: (ed: MachineEditor) => void;
}

const must = (ed: MachineEditor, cmd: unknown): string[] => {
  const r = ed.dispatch(cmd);
  if (!r.ok) throw new Error(`${JSON.stringify(cmd)} → ${r.error}`);
  return r.created;
};

export const MACHINE_TEMPLATES: readonly MachineTemplate[] = [
  {
    id: 'conveyor-station',
    name: '컨베이어 스테이션',
    bbox: [4000, 1200, 1800],
    summary: '롤러 컨베이어 · 소스 · 센서 · 스토퍼 · 싱크 · 제어반',
    build(ed) {
      const [cv] = must(ed, {
        cmd: 'add_block',
        blockType: 'roller-conveyor',
        params: { length: 3000, width: 600, speed: 300 },
      });
      must(ed, {
        cmd: 'add_block',
        blockType: 'source',
        parent: cv,
        params: { interval: 5 },
        transform: { position: [-1300, 0, 750] },
      });
      must(ed, {
        cmd: 'add_block',
        blockType: 'photo-sensor',
        parent: cv,
        transform: { position: [600, 0, 750] },
      });
      must(ed, {
        cmd: 'add_block',
        blockType: 'stopper',
        parent: cv,
        transform: { position: [1000, 0, 700] },
      });
      must(ed, {
        cmd: 'add_block',
        blockType: 'sink',
        parent: cv,
        transform: { position: [1400, 0, 750] },
      });
      must(ed, {
        cmd: 'add_block',
        blockType: 'control-cabinet',
        transform: { position: [0, 1000, 0] },
      });
      must(ed, {
        cmd: 'add_block',
        blockType: 'tower-lamp',
        transform: { position: [0, 1000, 1800] },
      });
      must(ed, { cmd: 'make_card' });
    },
  },
  {
    id: 'pick-place-cell',
    name: '픽앤플레이스 셀',
    bbox: [2500, 2500, 2200],
    summary: '6축 로봇 + 그리퍼 · 작업대 · 트레이 · 벨트 컨베이어 · 라이트 커튼',
    build(ed) {
      const [frame] = must(ed, {
        cmd: 'add_block',
        blockType: 'frame-table',
        params: { w: 1200, d: 800, h: 750 },
      });
      const [robot] = must(ed, {
        cmd: 'add_block',
        blockType: 'robot-6axis',
        params: { reach: 900, payload: 7, cycle: 4 },
        transform: { position: [0, -900, 0] },
      });
      const [grip] = must(ed, {
        cmd: 'add_block',
        blockType: 'gripper-parallel',
        params: { stroke: 15 },
      });
      must(ed, { cmd: 'snap', id: grip, socket: 'base', targetId: robot, targetSocket: 'flange' });
      must(ed, {
        cmd: 'add_block',
        blockType: 'pallet-tray',
        parent: frame,
        transform: { position: [-300, 0, 750] },
      });
      must(ed, {
        cmd: 'add_block',
        blockType: 'belt-conveyor',
        params: { length: 1500, width: 300 },
        transform: { position: [1200, 0, 0] },
      });
      must(ed, {
        cmd: 'add_block',
        blockType: 'light-curtain',
        params: { width: 2400 },
        transform: { position: [0, 1200, 0] },
      });
      must(ed, {
        cmd: 'add_block',
        blockType: 'fence-panel',
        transform: { position: [-1200, 0, 0], rotation: [0, 0, 90] },
      });
      must(ed, { cmd: 'make_card' });
    },
  },
  {
    id: 'press-station',
    name: '프레스 스테이션',
    bbox: [2400, 2000, 2800],
    summary: '서보 프레스 · 지그 · 안전문 · 라이트 커튼 · NG 푸셔 · 조작반',
    build(ed) {
      const [press] = must(ed, {
        cmd: 'add_block',
        blockType: 'servo-press',
        params: { stroke: 200, cycle: 8, ok_rate: 0.5 },
      });
      must(ed, {
        cmd: 'add_block',
        blockType: 'jig-fixture',
        parent: press,
        transform: { position: [0, 0, 840] },
      });
      must(ed, {
        cmd: 'add_block',
        blockType: 'safety-door',
        transform: { position: [0, -1000, 0] },
      });
      must(ed, {
        cmd: 'add_block',
        blockType: 'light-curtain',
        transform: { position: [-1000, 0, 0] },
      });
      must(ed, {
        cmd: 'add_block',
        blockType: 'ng-pusher',
        transform: { position: [900, 0, 840] },
      });
      must(ed, {
        cmd: 'add_block',
        blockType: 'op-panel',
        transform: { position: [1100, -900, 0] },
      });
      must(ed, { cmd: 'make_card' });
    },
  },
];

export function getTemplate(id: TemplateId): MachineTemplate {
  const t = MACHINE_TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`템플릿 없음: ${id}`);
  return t;
}
