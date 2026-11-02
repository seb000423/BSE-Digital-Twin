/**
 * 3·4. 액추에이터 — 공압 실린더 5형식(지오메트리만 다르고 관절·I/O·치수표 구조는 하나), 회전 실린더, 클램프,
 * 평행 그리퍼, 진공 패드, 전동 액추에이터(위치형). 지침서 6.2절·6.4절. 모터는 블록이 아니라 축의 drive 속성.
 */
import { box, boxOnFloor, cyl, type Primitive } from '../geometry.js';
import {
  floorMount,
  IO,
  lin,
  motion,
  N,
  num,
  int,
  opt,
  rot,
  S,
  socket,
  type BlockSpec,
} from '../spec.js';

/** 실린더 치수 표 (형식별 대표 치수, 카탈로그 미확인 → verified=false) */
const BORE = ['16', '20', '25', '32', '40', '50', '63', '80', '100'];
const cylDim = BORE.map((b) => ({
  key: `보어 ${b}`,
  values: { body_w: Number(b) + 12, rod_d: Math.round(Number(b) * 0.4) },
  verified: false,
  source: null,
}));
const cylParams = () => [
  opt('bore', '보어', BORE, '32'),
  num('stroke', '스트로크', 50, 5, 2000),
  ...motion(300, 3000),
  num('cushion_time', '쿠션 시간', 0.1, 0, 2, 's'),
];
const bodyW = (p: Record<string, number | string | boolean>) => N(p, 'bore', 32) + 12;

/** 실린더 공통 바디 + 로드 (축 +Z = 전진 방향). 블록 원점 = 바디 뒤쪽 바닥 중심 */
function cylinderPrims(
  p: Record<string, number | string | boolean>,
  shape: 'compact' | 'round' | 'guide' | 'rodless' | 'slide',
): Primitive[] {
  const b = bodyW(p);
  const s = N(p, 'stroke', 50);
  const rod = Math.max(6, Math.round(N(p, 'bore', 32) * 0.4));
  const out: Primitive[] = [];
  switch (shape) {
    case 'round':
      out.push(
        cyl(b / 2, s + 40, [0, 0, (s + 40) / 2], 0),
        cyl(rod / 2, s + 20, [0, 0, s + 40 + 10], 2, { part: 'rod' }),
      );
      break;
    case 'guide':
      out.push(
        boxOnFloor(b * 2.2, b, s + 40, 0, 0, 0, 0),
        box([b * 2.2, 16, b], [0, 0, s + 48], 1, { part: 'rod' }),
      );
      for (const sx of [-1, 1])
        out.push(cyl(rod / 2, s + 20, [sx * b * 0.8, 0, s + 40 + 10], 2, { part: 'rod' }));
      break;
    case 'rodless':
      // 가로로 긴 레일 + 슬라이더 (축 +X)
      out.push(
        box([s + 80, b, b * 0.8], [s / 2, 0, b * 0.4], 0),
        box([b * 1.6, b * 1.2, 16], [0, 0, b * 0.8 + 8], 1, { part: 'rod' }),
      );
      break;
    case 'slide':
      out.push(
        boxOnFloor(b * 1.5, s + 60, 30, 0, s / 2, 0, 0),
        box([b * 1.5, b * 1.5, 12], [0, 0, 36], 1, { part: 'rod' }),
      );
      break;
    default:
      out.push(
        boxOnFloor(b, b, s + 30, 0, 0, 0, 0),
        cyl(rod / 2, s + 20, [0, 0, s + 30 + 10], 2, { part: 'rod' }),
      );
  }
  return out;
}

const cylinderBlock = (
  id: string,
  name: string,
  shape: 'compact' | 'round' | 'guide' | 'rodless' | 'slide',
  axis: [number, number, number],
): BlockSpec => ({
  prefix: shape === 'rodless' ? 'RL' : shape === 'slide' ? 'SLD' : 'CYL',
  def: {
    meta: { id, name, category: 'actuator_pneumatic' },
    params: cylParams(),
    geometry: { fn: `cylinder_${shape}`, dimTable: cylDim },
    joints: [lin('rod', axis, 'stroke')],
    ioTemplate: [...IO.onoff_axis],
  },
  geometry: (p) => cylinderPrims(p, shape),
  sockets: (p) => [
    floorMount(),
    socket(
      'tool',
      'tool',
      [axis[0] * (N(p, 'stroke', 50) + 60), 0, axis[2] * (N(p, 'stroke', 50) + 60)],
      axis,
      ['mount'],
    ),
  ],
});

export const compactCylinder = cylinderBlock(
  'compact-cylinder',
  '실린더 박형(컴팩트)',
  'compact',
  [0, 0, 1],
);
export const roundCylinder = cylinderBlock(
  'round-cylinder',
  '실린더 원형(튜브)',
  'round',
  [0, 0, 1],
);
export const guideCylinder = cylinderBlock(
  'guide-cylinder',
  '실린더 가이드 부착',
  'guide',
  [0, 0, 1],
);
export const rodlessCylinder = cylinderBlock(
  'rodless-cylinder',
  '로드리스 실린더',
  'rodless',
  [1, 0, 0],
);
export const slideTable = cylinderBlock('slide-table', '슬라이드 테이블', 'slide', [0, 1, 0]);

export const rotaryActuator: BlockSpec = {
  prefix: 'ROT',
  def: {
    meta: { id: 'rotary-actuator', name: '회전 실린더', category: 'actuator_pneumatic' },
    params: [
      opt('size', '사이즈', ['10', '20', '30', '50'], '20'),
      opt('angle', '회전 각', ['90', '180', '270'], '90'),
      ...motion(180, 720, true),
    ],
    geometry: { fn: 'rotaryActuator' },
    joints: [rot('table', [0, 0, 1], 'angle')],
    ioTemplate: [...IO.onoff_rotate],
  },
  geometry: (p) => {
    const s = N(p, 'size', 20) + 40;
    return [
      boxOnFloor(s, s, s * 0.8, 0, 0, 0, 0),
      cyl(s * 0.4, 10, [0, 0, s * 0.8 + 5], 1, { part: 'table' }),
      box([s * 0.7, 8, 8], [s * 0.2, 0, s * 0.8 + 14], 2, { part: 'table' }),
    ];
  },
  sockets: (p) => [
    floorMount(),
    socket('tool', 'tool', [0, 0, (N(p, 'size', 20) + 40) * 0.8 + 18], [0, 0, 1], ['mount']),
  ],
};

export const clampCylinder: BlockSpec = {
  prefix: 'CLP',
  def: {
    meta: { id: 'clamp-cylinder', name: '클램프 실린더', category: 'actuator_pneumatic' },
    params: [
      opt('kind', '형식', ['lever', 'swing', 'pin'], 'swing'),
      opt('size', '사이즈', ['20', '32', '40', '50'], '32'),
      num('swing', '회전 각', 90, 0, 90, 'deg'),
      ...motion(180, 720, true),
    ],
    geometry: { fn: 'clampCylinder' },
    joints: [rot('arm', [0, 0, 1], 'swing')],
    ioTemplate: [...IO.clamp],
  },
  geometry: (p) => {
    const s = N(p, 'size', 32) + 20;
    return [
      cyl(s / 2, s * 2, [0, 0, s], 0),
      box([s * 1.6, 12, 10], [s * 0.6, 0, s * 2 + 10], 2, { part: 'arm' }),
    ];
  },
  sockets: () => [floorMount()],
};

export const gripperParallel: BlockSpec = {
  prefix: 'GRP',
  def: {
    meta: { id: 'gripper-parallel', name: '그리퍼 평행', category: 'actuator_pneumatic' },
    params: [
      opt('fingers', '손가락 수', ['2', '3'], '2'),
      opt('size', '사이즈', ['10', '16', '20', '25', '32'], '20'),
      num('stroke', '개폐 스트로크 (편측)', 10, 2, 100),
      ...motion(100, 1000),
    ],
    geometry: { fn: 'gripperParallel' },
    joints: [lin('finger', [0, 1, 0], 'stroke')],
    ioTemplate: [...IO.gripper],
  },
  geometry: (p) => {
    const s = N(p, 'size', 20) + 30;
    const st = N(p, 'stroke', 10);
    return [
      boxOnFloor(s, s * 1.6, s, 0, 0, 0, 0),
      box([s * 0.6, 8, s * 0.8], [0, -(st + 6), s + s * 0.4], 2, { part: 'finger' }),
      box([s * 0.6, 8, s * 0.8], [0, st + 6, s + s * 0.4], 2, { part: 'finger' }),
    ];
  },
  sockets: (p) => [
    socket('base', 'mount', [0, 0, 0], [0, 0, -1], ['tool']),
    socket('grip', 'tool', [0, 0, (N(p, 'size', 20) + 30) * 1.6], [0, 0, 1], []),
  ],
};

export const vacuumPad: BlockSpec = {
  prefix: 'VAC',
  def: {
    meta: { id: 'vacuum-pad', name: '진공 패드', category: 'actuator_pneumatic' },
    params: [
      num('dia', '패드 지름', 30, 5, 150),
      int('count', '수량', 1, 1, 16),
      num('pitch', '배치 간격', 50, 10, 500),
    ],
    geometry: { fn: 'vacuumPad' },
    ioTemplate: [...IO.vacuum],
  },
  geometry: (p) => {
    const d = N(p, 'dia', 30);
    const n = N(p, 'count', 1);
    const pitch = N(p, 'pitch', 50);
    const out: Primitive[] = [box([Math.max(d, (n - 1) * pitch + d), d, 10], [0, 0, 30], 0)];
    for (let k = 0; k < n; k++)
      out.push(cyl(d / 2, 20, [-((n - 1) * pitch) / 2 + k * pitch, 0, 10], 2));
    return out;
  },
  sockets: () => [
    socket('base', 'mount', [0, 0, 35], [0, 0, 1], ['tool']),
    socket('grip', 'tool', [0, 0, 0], [0, 0, -1], []),
  ],
};

const electric = (
  id: string,
  name: string,
  fn: string,
  axis: [number, number, number],
  build: (p: Record<string, number | string | boolean>) => Primitive[],
): BlockSpec => ({
  prefix: 'AX',
  def: {
    meta: { id, name, category: 'actuator_electric' },
    params: [
      opt('size', '사이즈', ['25', '32', '40', '50', '63'], '40'),
      num('stroke', '스트로크', 300, 20, 3000),
      ...motion(500, 5000),
      num('settle', '정착 시간', 0.05, 0, 1, 's'),
      opt('drive', '구동', ['servo', 'stepping'], 'servo'),
    ],
    geometry: { fn },
    joints: [lin('slider', axis, 'stroke', 'position')],
    ioTemplate: [...IO.position_axis],
  },
  geometry: build,
  sockets: (p) => [
    floorMount(),
    socket(
      'tool',
      'tool',
      [axis[0] * 60, 0, axis[2] * 60 + (N(p, 'size', 40) + 20)],
      [0, 0, 1],
      ['mount'],
    ),
  ],
});

export const electricRod = electric(
  'electric-rod',
  '전동 액추에이터 로드형',
  'electricRod',
  [0, 0, 1],
  (p) => {
    const s = N(p, 'size', 40);
    const st = N(p, 'stroke', 300);
    return [
      boxOnFloor(s + 10, s + 10, st + 60, 0, 0, 0, 0),
      cyl(s * 0.3, st + 20, [0, 0, st + 60 + 10], 2, { part: 'slider' }),
    ];
  },
);
export const electricSlider = electric(
  'electric-slider',
  '전동 액추에이터 슬라이더형',
  'electricSlider',
  [1, 0, 0],
  (p) => {
    const s = N(p, 'size', 40);
    const st = N(p, 'stroke', 300);
    return [
      box([st + 120, s + 20, s * 0.6], [st / 2, 0, s * 0.3], 0),
      box([s * 2, s + 20, 20], [0, 0, s * 0.6 + 10], 1, { part: 'slider' }),
      box([60, s + 20, s * 0.8], [st + 90, 0, s * 0.4], 0),
    ];
  },
);
export const ballscrewAxis = electric(
  'ballscrew-axis',
  '볼스크류 단축 로봇',
  'ballscrewAxis',
  [1, 0, 0],
  (p) => {
    const s = N(p, 'size', 40) + 20;
    const st = N(p, 'stroke', 300);
    const cover = S(p, 'drive', 'servo') === 'servo' ? 1 : 0;
    return [
      box([st + 160, s, s], [st / 2, 0, s / 2], cover ? 0 : 1),
      box([s * 1.5, s + 10, 25], [0, 0, s + 12], 1, { part: 'slider' }),
      box([80, s, s], [st + 120, 0, s / 2], 0),
    ];
  },
);

export const actuatorBlocks: BlockSpec[] = [
  compactCylinder,
  roundCylinder,
  guideCylinder,
  rodlessCylinder,
  slideTable,
  rotaryActuator,
  clampCylinder,
  gripperParallel,
  vacuumPad,
  electricRod,
  electricSlider,
  ballscrewAxis,
];
