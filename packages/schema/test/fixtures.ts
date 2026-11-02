/** 기준 설비 1종(컨베이어 스테이션)을 흉내 낸 최소 예시. 값은 예시이며 verified=false */
import type { FactoryInput, MachineInput } from '../src/index.js';

export const ID = {
  machine: '01932b2a-1c4e-7a3b-9f0e-0123456789ab',
  frame: '01932b2a-1c4e-7a3b-9f0e-0123456789ac',
  belt: '01932b2a-1c4e-7a3b-9f0e-0123456789ad',
  cyl: '01932b2a-1c4e-7a3b-9f0e-0123456789ae',
  jBelt: '01932b2a-1c4e-7a3b-9f0e-0123456789af',
  jCyl: '01932b2a-1c4e-7a3b-9f0e-0123456789b0',
  factory: '01932b2a-1c4e-7a3b-9f0e-0123456789b1',
  inst1: '01932b2a-1c4e-7a3b-9f0e-0123456789b2',
  inst2: '01932b2a-1c4e-7a3b-9f0e-0123456789b3',
  wall: '01932b2a-1c4e-7a3b-9f0e-0123456789b4',
  door: '01932b2a-1c4e-7a3b-9f0e-0123456789b5',
  flow: '01932b2a-1c4e-7a3b-9f0e-0123456789b6',
} as const;

export const conveyorStation: MachineInput = {
  schema: 'bse-twin/machine@1',
  meta: { id: ID.machine, name: '컨베이어 스테이션', bbox: [2000, 800, 1200], fidelity: 'L2' },
  card: { cycle_time: 12, footprint: [2000, 800], inlet: 'in', outlet: 'out' },
  nodes: [
    {
      id: ID.frame,
      type: 'block',
      name: '프레임',
      blockType: 'frame-box',
      params: { w: 2000, d: 800, h: 700 },
    },
    {
      id: ID.belt,
      type: 'block',
      name: '벨트',
      blockType: 'belt-conveyor',
      params: { length: 2000, width: 600 },
      parent: ID.frame,
      transform: { position: [0, 0, 700] },
      sockets: [
        { id: 'in', kind: 'inlet', position: [-1000, 0, 0], normal: [-1, 0, 0] },
        { id: 'out', kind: 'outlet', position: [1000, 0, 0], normal: [1, 0, 0] },
      ],
    },
    {
      id: ID.cyl,
      type: 'block',
      name: '스토퍼 실린더',
      blockType: 'air-cylinder',
      params: { bore: 32, stroke: 50 },
      parent: ID.frame,
    },
  ],
  joints: [
    {
      id: ID.jBelt,
      node: ID.belt,
      type: 'surface',
      axis: [1, 0, 0],
      mode: 'continuous',
      max: 1,
      vmax: 300,
      amax: 1000,
    },
    {
      id: ID.jCyl,
      node: ID.cyl,
      type: 'lin',
      axis: [0, 0, 1],
      mode: 'onoff',
      max: 50,
      vmax: 200,
      amax: 2000,
    },
  ],
  io: [
    { tag: 'CV1_RUN', dir: 'out', type: 'bool', binding: { kind: 'joint', target: ID.jBelt } },
    { tag: 'STP1_FWD', dir: 'out', type: 'bool', binding: { kind: 'joint', target: ID.jCyl } },
    { tag: 'STP1_FWD_LS', dir: 'in', type: 'bool', binding: { kind: 'joint', target: ID.jCyl } },
  ],
};

export const smallFactory: FactoryInput = {
  schema: 'bse-twin/factory@1',
  meta: { id: ID.factory, name: '기준 공장', site: '시험동', levels: [{ id: 'L1', name: '1층' }] },
  building: {
    walls: [
      {
        id: ID.wall,
        level: 'L1',
        polyline: [
          [0, 0],
          [20000, 0],
        ],
        height: 6000,
      },
    ],
    openings: [
      { id: ID.door, wall: ID.wall, kind: 'door', offset: 5000, width: 1200, height: 2100 },
    ],
  },
  machines: [
    { id: ID.inst1, ref: `${ID.machine}@0.1.0`, tagPrefix: 'ST01.M1' },
    {
      id: ID.inst2,
      ref: `${ID.machine}@0.1.0`,
      tagPrefix: 'ST01.M2',
      transform: { position: [2500, 0, 0] },
    },
  ],
  flows: [{ id: ID.flow, from: `${ID.inst1}.out`, to: `${ID.inst2}.in` }],
};
