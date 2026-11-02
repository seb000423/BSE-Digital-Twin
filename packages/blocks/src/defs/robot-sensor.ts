/**
 * 5. 로봇 · 6. 센서. V1 에서 로봇 IK 는 없다(기준서 9.3절): 6축은 관절 6개 + 프로그램 호출 태그까지만, URDF 로드는 V2.
 * 센서 외형은 원통(M8~M30) 또는 사각 하나 (6.4절). 검출은 레이·선분·영역.
 */
import { box, boxOnFloor, cyl } from '../geometry.js';
import { floorMount, IO, motion, N, num, int, opt, rot, socket, type BlockSpec } from '../spec.js';

export const robot6Axis: BlockSpec = {
  prefix: 'RB',
  def: {
    meta: {
      id: 'robot-6axis',
      name: '6축 다관절 로봇',
      category: 'robot',
      maker_note: '메이커 모델은 블록이 아님. 정확 외형은 URDF 로드(V2)',
    },
    params: [
      opt('kind', '용도', ['handling', 'welding', 'painting', 'cobot'], 'handling'),
      num('reach', '리치', 1400, 300, 4000),
      num('payload', '가반 하중', 10, 0.5, 1000, 'kg'),
      num('j_range', '관절 범위 (±)', 170, 30, 360, 'deg'),
      ...motion(180, 500, true),
      num('cycle', '프로그램 1사이클', 4, 0.1, 600, 's'),
    ],
    geometry: {
      fn: 'robot6Axis',
      dimTable: [
        {
          key: '소형 (리치 ~900, 7kg)',
          values: { base_d: 320, arm_w: 120 },
          verified: false,
          source: null,
        },
        {
          key: '중형 (리치 ~1500, 20kg)',
          values: { base_d: 420, arm_w: 160 },
          verified: false,
          source: null,
        },
        {
          key: '대형 (리치 ~2500, 100kg+)',
          values: { base_d: 620, arm_w: 240 },
          verified: false,
          source: null,
        },
      ],
    },
    joints: [
      rot('j1', [0, 0, 1], 'j_range', 'position'),
      rot('j2', [0, 1, 0], 'j_range', 'position'),
      rot('j3', [0, 1, 0], 'j_range', 'position'),
      rot('j4', [1, 0, 0], 'j_range', 'position'),
      rot('j5', [0, 1, 0], 'j_range', 'position'),
      rot('j6', [1, 0, 0], 'j_range', 'position'),
    ],
    ioTemplate: [...IO.robot],
    robot: { urdf: '', payload: 10, tcp_vmax: 2000, tcp_amax: 8000 },
  },
  geometry: (p) => {
    const reach = N(p, 'reach', 1400);
    const bd = Math.max(240, reach * 0.3);
    const aw = Math.max(80, reach * 0.11);
    const upper = reach * 0.45;
    const fore = reach * 0.42;
    return [
      cyl(bd / 2, bd * 0.4, [0, 0, bd * 0.2], 0),
      cyl(bd * 0.35, bd * 0.35, [0, 0, bd * 0.4 + bd * 0.175], 1, { part: 'j1' }),
      box([aw, aw * 1.3, upper], [0, 0, bd * 0.75 + upper / 2], 1, { part: 'j2' }),
      box([fore, aw * 0.9, aw * 0.9], [fore / 2, 0, bd * 0.75 + upper], 1, { part: 'j3' }),
      cyl(aw * 0.35, aw * 1.4, [fore + aw * 0.5, 0, bd * 0.75 + upper], 2, {
        rotation: [0, 90, 0],
        part: 'j5',
      }),
      box([aw * 0.6, aw * 0.6, aw * 0.6], [fore + aw * 1.3, 0, bd * 0.75 + upper], 2, {
        part: 'j6',
      }),
    ];
  },
  sockets: (p) => {
    const reach = N(p, 'reach', 1400);
    const bd = Math.max(240, reach * 0.3);
    const aw = Math.max(80, reach * 0.11);
    return [
      floorMount(),
      socket(
        'flange',
        'tool',
        [reach * 0.42 + aw * 1.6, 0, bd * 0.75 + reach * 0.45],
        [1, 0, 0],
        ['mount'],
      ),
    ];
  },
};

export const toolMount: BlockSpec = {
  prefix: 'TM',
  def: {
    meta: { id: 'tool-mount', name: '툴 마운트·브라켓', category: 'robot' },
    params: [num('offset', '오프셋', 60, 0, 500), num('angle', '각도', 0, -180, 180, 'deg')],
    geometry: { fn: 'toolMount' },
  },
  geometry: (p) => [box([N(p, 'offset', 60), 60, 12], [N(p, 'offset', 60) / 2, 0, 6], 1)],
  sockets: (p) => [
    socket('base', 'mount', [0, 0, 0], [-1, 0, 0], ['tool']),
    socket('tool', 'tool', [N(p, 'offset', 60), 0, 0], [1, 0, 0], ['mount']),
  ],
};

const sensorDim = ['8', '12', '18', '30'].map((m) => ({
  key: `M${m}`,
  values: { d: Number(m), len: Number(m) * 3 },
  verified: false,
  source: null,
}));

export const photoSensor: BlockSpec = {
  prefix: 'PS',
  def: {
    meta: { id: 'photo-sensor', name: '점 검출 센서', category: 'sensor' },
    params: [
      opt('shape', '외형', ['M8', 'M12', 'M18', 'M30', 'square'], 'M18'),
      opt('kind', '종류', ['photo', 'proximity', 'fiber', 'cylinder_ls'], 'photo'),
      num('range', '검출 거리', 300, 1, 5000),
      opt('target', '대상', ['work', 'carrier', 'any'], 'any'),
    ],
    geometry: { fn: 'photoSensor', dimTable: sensorDim },
    ioTemplate: [...IO.sensor_bool],
    detect: { shape: 'ray', range: 300, target: 'any' },
  },
  geometry: (p) => {
    const shape = String(p['shape'] ?? 'M18');
    if (shape === 'square') return [box([20, 30, 40], [0, 0, 20], 2)];
    const d = Number(shape.slice(1)) || 18;
    return [cyl(d / 2, d * 3, [0, 0, d * 1.5], 2), box([d * 1.4, d * 1.4, 4], [0, 0, 2], 0)];
  },
  sockets: () => [socket('base', 'mount', [0, 0, 0], [0, 0, -1], ['surface', 'mount'])],
};

export const throughBeam: BlockSpec = {
  prefix: 'TB',
  def: {
    meta: { id: 'through-beam', name: '투과형 센서 (투광·수광)', category: 'sensor' },
    params: [num('distance', '투·수광 거리', 600, 50, 20000), int('beams', '빔 수', 1, 1, 8)],
    geometry: { fn: 'throughBeam' },
    ioTemplate: [...IO.sensor_bool],
    detect: { shape: 'segment', range: 600, target: 'any' },
  },
  geometry: (p) => {
    const d = N(p, 'distance', 600);
    return [box([20, 30, 60], [0, -d / 2, 30], 2), box([20, 30, 60], [0, d / 2, 30], 2)];
  },
  sockets: () => [socket('base', 'mount', [0, 0, 0], [0, 0, -1], ['surface', 'mount'])],
};

export const lightCurtain: BlockSpec = {
  prefix: 'LC',
  def: {
    meta: { id: 'light-curtain', name: '라이트커튼', category: 'sensor' },
    params: [
      num('height', '보호 높이', 900, 150, 2500),
      num('pitch', '빔 피치', 20, 10, 100),
      num('width', '보호 폭', 1000, 100, 10000),
    ],
    geometry: { fn: 'lightCurtain' },
    ioTemplate: [...IO.sensor_safety],
    detect: { shape: 'area', range: 1000, target: 'any' },
  },
  geometry: (p) => {
    const h = N(p, 'height', 900);
    const w = N(p, 'width', 1000);
    return [boxOnFloor(30, 40, h, 0, -w / 2, 0, 2), boxOnFloor(30, 40, h, 0, w / 2, 0, 2)];
  },
  sockets: () => [floorMount()],
};

export const doorSwitch: BlockSpec = {
  prefix: 'DS',
  def: {
    meta: { id: 'door-switch', name: '도어·안전 스위치', category: 'sensor' },
    params: [opt('kind', '종류', ['interlock', 'solenoid_lock'], 'interlock')],
    geometry: { fn: 'doorSwitch' },
    ioTemplate: [
      { tag: '{n}_DOOR_CLOSED', dir: 'in', type: 'bool', binding: 'sensor' },
      { tag: '{n}_LOCKED', dir: 'in', type: 'bool', binding: 'sensor' },
    ],
    detect: { shape: 'ray', range: 20, target: 'any' },
  },
  geometry: () => [box([40, 20, 80], [0, 0, 40], 2)],
  sockets: () => [socket('base', 'mount', [0, 0, 0], [0, 0, -1], ['surface', 'mount'])],
};

export const visionCamera: BlockSpec = {
  prefix: 'CAM',
  def: {
    meta: { id: 'vision-camera', name: '비전 카메라', category: 'sensor' },
    params: [
      opt('kind', '종류', ['2d', '3d'], '2d'),
      num('fov', '시야각', 40, 5, 120, 'deg'),
      num('wd', '작동 거리', 400, 50, 3000),
    ],
    geometry: { fn: 'visionCamera' },
    ioTemplate: [
      { tag: '{n}_TRIG', dir: 'out', type: 'bool', binding: 'process' },
      { tag: '{n}_BUSY', dir: 'in', type: 'bool', binding: 'process' },
      { tag: '{n}_OK', dir: 'in', type: 'bool', binding: 'process' },
      { tag: '{n}_NG', dir: 'in', type: 'bool', binding: 'process' },
    ],
    detect: { shape: 'volume', range: 400, target: 'work' },
    process: { axes: 0, cycle_time: 0.3, judge: true },
  },
  geometry: () => [box([60, 60, 90], [0, 0, 45], 1), cyl(20, 30, [0, 0, -15], 2)],
  sockets: () => [socket('base', 'mount', [0, 0, 90], [0, 0, 1], ['surface', 'mount', 'tool'])],
};

export const robotSensorBlocks: BlockSpec[] = [
  robot6Axis,
  toolMount,
  photoSensor,
  throughBeam,
  lightCurtain,
  doorSwitch,
  visionCamera,
];
