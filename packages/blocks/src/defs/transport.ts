/** 2. 반송 블록 — 벨트·롤러 컨베이어, 스토퍼, 리프터 (블록 목록 1차) */
import { box, boxOnFloor, cyl, legs, type Primitive } from '../geometry.js';
import {
  floorMount,
  inOut,
  IO,
  lin,
  motion,
  N,
  num,
  int,
  opt,
  S,
  surface,
  type BlockSpec,
} from '../spec.js';

/** 컨베이어 공통: 길이 · 폭 · 이송면 높이 · 속도, 이송면 관절(surface) + RUN/DIR/SPEED */
const conveyorParams = (width: number) => [
  num('length', '길이', 2000, 300, 20000),
  num('width', '폭', width, 100, 1500),
  num('height', '이송면 높이', 750, 100, 2000),
  num('speed', '이송 속도', 300, 1, 3000, 'mm/s'),
  ...motion(300, 1000),
];

export const beltConveyor: BlockSpec = {
  prefix: 'CV',
  def: {
    meta: { id: 'belt-conveyor', name: '벨트 컨베이어', category: 'transport' },
    params: [
      ...conveyorParams(400),
      opt('belt', '벨트', ['flat', 'timing'], 'flat'),
      num('leg_pitch', '다리 간격', 1500, 300, 5000),
    ],
    geometry: {
      fn: 'beltConveyor',
      dimTable: [
        {
          key: '폭 100~800 규격',
          values: { frame_h: 100, side: 30 },
          verified: false,
          source: null,
        },
      ],
    },
    joints: [surface('belt', [1, 0, 0])],
    ioTemplate: [...IO.speed_axis],
  },
  geometry: (p) => conveyorBody(p, 'belt'),
  sockets: (p) => [floorMount(), ...inOut(N(p, 'length', 2000), N(p, 'height', 750))],
};

export const rollerConveyor: BlockSpec = {
  prefix: 'CV',
  def: {
    meta: { id: 'roller-conveyor', name: '롤러 컨베이어', category: 'transport' },
    params: [
      ...conveyorParams(600),
      opt('drive', '구동', ['driven', 'free', 'accumulate'], 'driven'),
      num('pitch', '롤러 피치', 100, 30, 300),
      int('zones', '존 수', 1, 1, 20),
    ],
    geometry: {
      fn: 'rollerConveyor',
      dimTable: [
        { key: '롤러 Ø38', values: { roller_d: 38, load_kg: 30 }, verified: false, source: null },
        { key: '롤러 Ø50', values: { roller_d: 50, load_kg: 60 }, verified: false, source: null },
        { key: '롤러 Ø60', values: { roller_d: 60 }, verified: false, source: null },
      ],
    },
    joints: [surface('rollers', [1, 0, 0])],
    ioTemplate: [...IO.speed_axis],
  },
  geometry: (p) => conveyorBody(p, 'roller'),
  sockets: (p) => [floorMount(), ...inOut(N(p, 'length', 2000), N(p, 'height', 750))],
};

function conveyorBody(p: Record<string, unknown>, kind: 'belt' | 'roller'): Primitive[] {
  const q = p as Record<string, number | string | boolean>;
  const L = N(q, 'length', 2000);
  const W = N(q, 'width', kind === 'belt' ? 400 : 600);
  const H = N(q, 'height', 750);
  const out: Primitive[] = [];
  // 다리: 1500mm 마다 한 쌍
  const legPitch = N(q, 'leg_pitch', 1500);
  const nLeg = Math.max(2, Math.ceil(L / legPitch) + 1);
  for (let k = 0; k < nLeg; k++) {
    const x = -L / 2 + 100 + ((L - 200) * k) / (nLeg - 1);
    out.push(
      boxOnFloor(40, 40, H - 100, x, W / 2 - 20, 0, 0),
      boxOnFloor(40, 40, H - 100, x, -W / 2 + 20, 0, 0),
    );
  }
  // 양쪽 사이드 프레임
  out.push(
    box([L, 30, 100], [0, W / 2 - 15, H - 50], 0),
    box([L, 30, 100], [0, -W / 2 + 15, H - 50], 0),
  );
  if (kind === 'belt') {
    out.push(box([L, W - 60, 30], [0, 0, H - 15], 1, { part: 'belt' }));
  } else {
    const pitch = N(q, 'pitch', 100);
    const rd = 38;
    for (let x = -L / 2 + pitch / 2; x < L / 2; x += pitch)
      out.push(
        cyl(rd / 2, W - 60, [x, 0, H - rd / 2 - 5], 1, { rotation: [90, 0, 0], part: 'rollers' }),
      );
  }
  return out;
}

export const stopper: BlockSpec = {
  prefix: 'STP',
  def: {
    meta: { id: 'stopper', name: '스토퍼', category: 'transport' },
    params: [
      num('width', '폭', 60, 20, 600),
      num('stroke', '스트로크', 30, 5, 200),
      opt('kind', '형식', ['cylinder', 'damper'], 'cylinder'),
      ...motion(200, 2000),
    ],
    geometry: {
      fn: 'stopper',
      dimTable: [{ key: '보어 20', values: { body: 40 }, verified: false, source: null }],
    },
    joints: [lin('pin', [0, 0, 1], 'stroke')],
    ioTemplate: [...IO.lifter],
  },
  geometry: (p) => {
    const w = N(p, 'width', 60);
    const s = N(p, 'stroke', 30);
    return [
      boxOnFloor(50, 50, 60, 0, 0, 0, 0),
      box([w, 12, s + 10], [0, 0, 60 + (s + 10) / 2 - s], 2, { part: 'pin' }),
    ];
  },
  sockets: () => [floorMount()],
};

export const lifter: BlockSpec = {
  prefix: 'LFT',
  def: {
    meta: { id: 'lifter', name: '리프터 (테이블)', category: 'transport' },
    params: [
      num('w', '테이블 폭', 600, 200, 3000),
      num('d', '테이블 깊이', 600, 200, 3000),
      num('stroke', '스트로크', 300, 20, 3000),
      opt('kind', '형식', ['cylinder', 'electric', 'scissor'], 'cylinder'),
      ...motion(150, 500),
    ],
    geometry: { fn: 'lifter' },
    joints: [lin('table', [0, 0, 1], 'stroke')],
    ioTemplate: [...IO.lifter],
  },
  geometry: (p) => {
    const w = N(p, 'w', 600);
    const d = N(p, 'd', 600);
    const kind = S(p, 'kind', 'cylinder');
    const base: Primitive[] = [boxOnFloor(w, d, 40, 0, 0, 0, 0)];
    if (kind === 'scissor') base.push(...legs(w * 0.8, d * 0.8, 200, 30, 0, 40));
    else base.push(cyl(40, 200, [0, 0, 140], 0));
    base.push(box([w, d, 30], [0, 0, 255], 1, { part: 'table' }));
    return base;
  },
  sockets: () => [floorMount()],
};

export const transportBlocks: BlockSpec[] = [beltConveyor, rollerConveyor, stopper, lifter];
