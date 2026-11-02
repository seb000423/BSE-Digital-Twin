/** 1. 구조 블록 — 프레임·패널·제어반·조작반·타워램프·안전 도어·플레이트 (블록 목록 1차) */
import { box, boxOnFloor, cyl, legs, type Primitive } from '../geometry.js';
import { floorMount, IO, lin, N, num, int, opt, rot, S, socket, type BlockSpec } from '../spec.js';

export const frameTable: BlockSpec = {
  prefix: 'FRM',
  def: {
    meta: { id: 'frame-table', name: '프레임 (테이블형)', category: 'structure' },
    params: [
      num('w', '폭 W', 1200, 200, 6000),
      num('d', '깊이 D', 800, 200, 4000),
      num('h', '높이 H', 750, 100, 3000),
      opt('kind', '형식', ['table', 'gantry', 'cabinet'], 'table'),
      num('top_t', '상판 두께', 20, 5, 100),
    ],
    geometry: {
      fn: 'frameTable',
      dimTable: [
        { key: '40각 프로파일', values: { leg: 40 }, verified: false, source: null },
        { key: '45각 프로파일', values: { leg: 45 }, verified: false, source: null },
      ],
    },
    sockets: [],
  },
  geometry: (p) => {
    const w = N(p, 'w', 1200);
    const d = N(p, 'd', 800);
    const h = N(p, 'h', 750);
    const t = N(p, 'top_t', 20);
    const kind = S(p, 'kind', 'table');
    const out: Primitive[] = [];
    if (kind === 'cabinet') {
      out.push(boxOnFloor(w, d, h - t, 0, 0, 0, 0));
    } else if (kind === 'gantry') {
      out.push(...legs(w, 120, h - t, 60, 60));
    } else {
      out.push(...legs(w, d, h - t, 40, 50));
      // 하단 보강 가로대
      out.push(
        box([w - 100, 40, 40], [0, d / 2 - 50, 150], 0),
        box([w - 100, 40, 40], [0, -d / 2 + 50, 150], 0),
      );
    }
    out.push(box([w, d, t], [0, 0, h - t / 2], 1));
    return out;
  },
  sockets: (p) => [
    floorMount(),
    socket('top', 'surface', [0, 0, N(p, 'h', 750)], [0, 0, 1], ['mount']),
  ],
};

export const fencePanel: BlockSpec = {
  prefix: 'FNC',
  def: {
    meta: { id: 'fence-panel', name: '가드·펜스 패널', category: 'structure' },
    params: [
      num('w', '폭', 1000, 200, 3000),
      num('h', '높이', 2000, 500, 3000),
      opt('kind', '종류', ['mesh', 'polycarbonate', 'sheet'], 'mesh'),
    ],
    geometry: { fn: 'fencePanel' },
    sockets: [],
  },
  geometry: (p) => {
    const w = N(p, 'w', 1000);
    const h = N(p, 'h', 2000);
    const tone = S(p, 'kind', 'mesh') === 'mesh' ? 0 : 1;
    return [
      boxOnFloor(40, 40, h, -w / 2 + 20, 0, 0, 0),
      boxOnFloor(40, 40, h, w / 2 - 20, 0, 0, 0),
      box([w - 80, 10, h - 150], [0, 0, 100 + (h - 150) / 2], tone),
    ];
  },
  sockets: () => [floorMount()],
};

export const controlCabinet: BlockSpec = {
  prefix: 'CP',
  def: {
    meta: { id: 'control-cabinet', name: '제어반 외함', category: 'structure' },
    params: [
      num('w', '폭', 500, 300, 2400),
      num('d', '깊이', 400, 200, 800),
      num('h', '높이', 1800, 400, 2200),
      opt('mount', '설치', ['floor', 'wall'], 'floor'),
    ],
    geometry: {
      fn: 'controlCabinet',
      dimTable: [{ key: '사내 표준 폭 500', values: { w: 500 }, verified: false, source: null }],
    },
    joints: [rot('door', [0, 0, 1], 'door_angle')],
    ioTemplate: [...IO.door],
  },
  geometry: (p) => {
    const w = N(p, 'w', 500);
    const d = N(p, 'd', 400);
    const h = N(p, 'h', 1800);
    const z0 = S(p, 'mount', 'floor') === 'wall' ? 1000 : 100;
    return [
      boxOnFloor(w, d, 100, 0, 0, 0, 0),
      box([w, d - 10, h - z0], [0, 5, z0 + (h - z0) / 2], 0),
      box([w - 20, 10, h - z0 - 20], [0, -d / 2 + 5, z0 + (h - z0) / 2], 1, { part: 'door' }),
    ];
  },
  sockets: () => [floorMount()],
};
// 도어 열림 각은 고정 파라미터
controlCabinet.def.params?.push(num('door_angle', '도어 열림 각', 120, 30, 180, 'deg'));

export const opPanel: BlockSpec = {
  prefix: 'OP',
  def: {
    meta: { id: 'op-panel', name: 'OP 조작반', category: 'structure' },
    params: [
      num('w', '폭', 300, 150, 800),
      num('h', '높이', 1200, 600, 1600),
      int('buttons', '버튼 수', 6, 1, 24),
    ],
    geometry: { fn: 'opPanel' },
    ioTemplate: [
      { tag: 'START', dir: 'out', type: 'bool', binding: 'process' },
      { tag: 'STOP', dir: 'out', type: 'bool', binding: 'process' },
      { tag: 'RESET', dir: 'out', type: 'bool', binding: 'process' },
      { tag: 'EMO', dir: 'out', type: 'bool', binding: 'process' },
      { tag: 'AUTO_MAN', dir: 'out', type: 'bool', binding: 'process' },
    ],
  },
  geometry: (p) => {
    const w = N(p, 'w', 300);
    const h = N(p, 'h', 1200);
    return [
      cyl(30, h - 200, [0, 0, (h - 200) / 2], 0),
      boxOnFloor(250, 250, 20, 0, 0, 0, 0),
      box([w, 60, 200], [0, 0, h - 100], 1, { rotation: [-15, 0, 0] }),
    ];
  },
  sockets: () => [floorMount()],
};

export const towerLamp: BlockSpec = {
  prefix: 'LMP',
  def: {
    meta: { id: 'tower-lamp', name: '타워램프', category: 'structure' },
    params: [int('tiers', '단 수', 3, 1, 5), opt('buzzer', '부저', ['yes', 'no'], 'yes')],
    geometry: { fn: 'towerLamp' },
    ioTemplate: [
      { tag: '{n}_R', dir: 'out', type: 'bool', binding: 'process' },
      { tag: '{n}_Y', dir: 'out', type: 'bool', binding: 'process' },
      { tag: '{n}_G', dir: 'out', type: 'bool', binding: 'process' },
      { tag: '{n}_BUZZ', dir: 'out', type: 'bool', binding: 'process' },
    ],
  },
  geometry: (p) => {
    const tiers = N(p, 'tiers', 3);
    const out: Primitive[] = [cyl(15, 300, [0, 0, 150], 0)];
    for (let k = 0; k < tiers; k++) out.push(cyl(30, 50, [0, 0, 325 + k * 55], 2));
    return out;
  },
  sockets: () => [floorMount()],
};

export const safetyDoor: BlockSpec = {
  prefix: 'DR',
  def: {
    meta: { id: 'safety-door', name: '안전 도어', category: 'structure' },
    params: [
      num('w', '폭', 900, 500, 2000),
      num('h', '높이', 2000, 1000, 3000),
      opt('kind', '형식', ['hinge', 'slide'], 'hinge'),
      num('open', '열림 (각 또는 거리)', 90, 10, 2000),
      ...[
        num('vmax', '최대 속도', 500, 1, 5000, 'mm/s'),
        num('amax', '최대 가속 (mm/s²)', 1000, 1, 100000, ''),
      ],
    ],
    geometry: { fn: 'safetyDoor' },
    joints: [lin('door', [1, 0, 0], 'open')],
    ioTemplate: [...IO.door],
  },
  geometry: (p) => {
    const w = N(p, 'w', 900);
    const h = N(p, 'h', 2000);
    return [
      boxOnFloor(40, 40, h, -w / 2 - 20, 0, 0, 0),
      boxOnFloor(40, 40, h, w / 2 + 20, 0, 0, 0),
      box([w, 10, h - 100], [0, 0, 50 + (h - 100) / 2], 1, { part: 'door' }),
    ];
  },
  sockets: () => [floorMount()],
};

export const plate: BlockSpec = {
  prefix: 'PLT',
  def: {
    meta: { id: 'plate', name: '플레이트', category: 'structure' },
    params: [
      num('w', '폭', 300, 20, 3000),
      num('d', '깊이', 200, 20, 3000),
      num('t', '두께', 15, 2, 100),
    ],
    geometry: { fn: 'plate' },
  },
  geometry: (p) => [boxOnFloor(N(p, 'w', 300), N(p, 'd', 200), N(p, 't', 15), 0, 0, 0, 1)],
  sockets: (p) => [
    floorMount(),
    socket('top', 'surface', [0, 0, N(p, 't', 15)], [0, 0, 1], ['mount']),
  ],
};

export const structureBlocks: BlockSpec[] = [
  frameTable,
  fencePanel,
  controlCabinet,
  opPanel,
  towerLamp,
  safetyDoor,
  plate,
];
