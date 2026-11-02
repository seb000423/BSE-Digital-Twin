/**
 * 7. 워크·용기 · 8. 피더 · 9. 공정 (공통 모델: 고정 바디 + 동작 축 0~2 + 처리 시간 + 판정, 지침서 6.3절).
 * 블랙박스 블록 하나가 사출기·CNC·열처리로 등 내부 미모델링 장비를 덮는다.
 */
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
  socket,
  type BlockSpec,
} from '../spec.js';

export const workBox: BlockSpec = {
  prefix: 'WK',
  def: {
    meta: { id: 'work-box', name: '워크 기본형', category: 'work_carrier', fidelity: 'L2' },
    params: [
      opt('shape', '모양', ['box', 'cylinder', 'sheet'], 'box'),
      num('w', '폭', 100, 5, 2000),
      num('d', '깊이', 100, 5, 2000),
      num('h', '높이', 50, 1, 2000),
      num('mass', '질량', 1, 0.001, 5000, 'kg'),
    ],
    geometry: { fn: 'workBox' },
  },
  geometry: (p) => {
    const w = N(p, 'w', 100);
    const d = N(p, 'd', 100);
    const h = N(p, 'h', 50);
    if (S(p, 'shape', 'box') === 'cylinder') return [cyl(w / 2, h, [0, 0, h / 2], 2)];
    return [boxOnFloor(w, d, S(p, 'shape') === 'sheet' ? Math.min(h, 5) : h, 0, 0, 0, 2)];
  },
  sockets: () => [socket('base', 'mount', [0, 0, 0], [0, 0, -1], ['surface', 'tool'])],
};

export const source: BlockSpec = {
  prefix: 'SRC',
  def: {
    meta: { id: 'source', name: '소스 (워크 생성)', category: 'work_carrier' },
    params: [
      opt('mode', '방식', ['interval', 'manual', 'feeder'], 'interval'),
      num('interval', '생성 간격', 10, 0.1, 3600, 's'),
      int('count', '총 수량 (0 = 무한)', 0, 0, 100000),
    ],
    geometry: { fn: 'source' },
    ioTemplate: [...IO.source],
  },
  geometry: () => [box([200, 200, 10], [0, 0, 5], 0), box([150, 150, 4], [0, 0, 12], 2)],
  sockets: () => [
    socket('base', 'mount', [0, 0, 0], [0, 0, -1], ['surface']),
    socket('out', 'outlet', [100, 0, 10], [1, 0, 0], ['inlet']),
  ],
};

export const sink: BlockSpec = {
  prefix: 'SNK',
  def: {
    meta: { id: 'sink', name: '싱크 (워크 소멸)', category: 'work_carrier' },
    params: [opt('kind', '종류', ['ok', 'ng'], 'ok')],
    geometry: { fn: 'sink' },
    ioTemplate: [...IO.sink],
  },
  geometry: () => [box([200, 200, 10], [0, 0, 5], 0)],
  sockets: () => [
    socket('base', 'mount', [0, 0, 0], [0, 0, -1], ['surface']),
    socket('in', 'inlet', [-100, 0, 10], [-1, 0, 0], ['outlet']),
  ],
};

export const palletTray: BlockSpec = {
  prefix: 'PLT',
  def: {
    meta: { id: 'pallet-tray', name: '통박스·파렛트·트레이', category: 'work_carrier' },
    params: [
      opt('kind', '종류', ['tray', 'tote', 'pallet'], 'tray'),
      num('w', '폭', 400, 100, 2000),
      num('d', '깊이', 300, 100, 2000),
      num('h', '높이', 50, 10, 1500),
      int('rows', '행', 2, 1, 50),
      int('cols', '열', 3, 1, 50),
      int('layers', '층', 1, 1, 20),
      num('pitch', '배열 간격', 100, 5, 1000),
    ],
    geometry: { fn: 'palletTray' },
    ioTemplate: [...IO.carrier],
    carrier: { capacity: 6, layout: [2, 3, 1], pitch: [100, 100, 50] },
  },
  geometry: (p) => {
    const w = N(p, 'w', 400);
    const d = N(p, 'd', 300);
    const h = N(p, 'h', 50);
    return [
      boxOnFloor(w, d, 8, 0, 0, 0, 1),
      box([w, 6, h], [0, d / 2 - 3, h / 2], 0),
      box([w, 6, h], [0, -d / 2 + 3, h / 2], 0),
      box([6, d, h], [w / 2 - 3, 0, h / 2], 0),
      box([6, d, h], [-w / 2 + 3, 0, h / 2], 0),
    ];
  },
  sockets: (p) => [
    floorMount(),
    socket('top', 'surface', [0, 0, N(p, 'h', 50)], [0, 0, 1], ['mount']),
  ],
};

export const linePallet: BlockSpec = {
  prefix: 'PAL',
  def: {
    meta: { id: 'line-pallet', name: '라인 팔레트 (캐리어)', category: 'work_carrier' },
    params: [
      num('w', '폭', 300, 100, 1500),
      num('d', '깊이', 300, 100, 1500),
      num('t', '두께', 20, 5, 100),
      int('jigs', '지그 위치 수', 1, 1, 8),
      opt('rfid', 'RFID', ['yes', 'no'], 'yes'),
    ],
    geometry: { fn: 'linePallet' },
    ioTemplate: [
      { tag: '{n}_ID', dir: 'in', type: 'int', binding: 'carrier' },
      { tag: '{n}_PRESENT', dir: 'in', type: 'bool', binding: 'carrier' },
    ],
    carrier: { capacity: 1, layout: [1, 1, 1], pitch: [0, 0, 0] },
  },
  geometry: (p) => [
    boxOnFloor(N(p, 'w', 300), N(p, 'd', 300), N(p, 't', 20), 0, 0, 0, 1),
    cyl(15, 10, [0, 0, N(p, 't', 20) + 5], 2),
  ],
  sockets: (p) => [
    floorMount(),
    socket('top', 'surface', [0, 0, N(p, 't', 20)], [0, 0, 1], ['mount']),
  ],
};

export const jigFixture: BlockSpec = {
  prefix: 'JIG',
  def: {
    meta: { id: 'jig-fixture', name: '지그·고정구', category: 'work_carrier' },
    params: [
      num('w', '폭', 400, 50, 2000),
      num('d', '깊이', 300, 50, 2000),
      num('h', '높이', 80, 10, 500),
      int('clamps', '클램프 수', 2, 0, 8),
      num('clamp_stroke', '클램프 스트로크', 20, 1, 100),
      ...motion(100, 1000),
    ],
    geometry: { fn: 'jigFixture' },
    joints: [lin('clamp', [0, 0, -1], 'clamp_stroke')],
    ioTemplate: [
      ...IO.clamp,
      { tag: '{n}_WORK_PRESENT', dir: 'in', type: 'bool', binding: 'sensor' },
    ],
  },
  geometry: (p) => {
    const w = N(p, 'w', 400);
    const d = N(p, 'd', 300);
    const h = N(p, 'h', 80);
    const n = N(p, 'clamps', 2);
    const out: Primitive[] = [boxOnFloor(w, d, h, 0, 0, 0, 0)];
    for (let k = 0; k < n; k++)
      out.push(
        box(
          [30, 30, 40],
          [-w / 2 + 40 + (k * (w - 80)) / Math.max(1, n - 1), d / 2 - 20, h + 40],
          2,
          { part: 'clamp' },
        ),
      );
    return out;
  },
  sockets: (p) => [
    floorMount(),
    socket('top', 'surface', [0, 0, N(p, 'h', 80)], [0, 0, 1], ['mount']),
  ],
};

export const bowlFeeder: BlockSpec = {
  prefix: 'FDR',
  def: {
    meta: { id: 'bowl-feeder', name: '보울 피더', category: 'feeder' },
    params: [
      num('dia', '보울 지름', 400, 100, 1200),
      num('h', '높이', 300, 100, 800),
      num('rail', '레일 길이', 300, 0, 2000),
      num('interval', '공급 간격', 2, 0.1, 600, 's'),
    ],
    geometry: { fn: 'bowlFeeder' },
    ioTemplate: [
      { tag: '{n}_RUN', dir: 'out', type: 'bool', binding: 'process' },
      { tag: '{n}_PART_READY', dir: 'in', type: 'bool', binding: 'carrier' },
      { tag: '{n}_LOW', dir: 'in', type: 'bool', binding: 'carrier' },
    ],
  },
  geometry: (p) => {
    const dia = N(p, 'dia', 400);
    const h = N(p, 'h', 300);
    const rail = N(p, 'rail', 300);
    return [cyl(dia / 2, h, [0, 0, h / 2], 0), box([rail, 40, 20], [dia / 2 + rail / 2, 0, h], 1)];
  },
  sockets: (p) => [
    floorMount(),
    socket(
      'out',
      'outlet',
      [N(p, 'dia', 400) / 2 + N(p, 'rail', 300), 0, N(p, 'h', 300)],
      [1, 0, 0],
      ['inlet'],
    ),
  ],
};

/** 공정 블록 공통 파라미터 */
const processParams = (cycle: number) => [
  num('cycle', '처리 시간', cycle, 0.01, 3600, 's'),
  num('ok_rate', '양품률', 0.99, 0, 1, ''),
];

export const servoPress: BlockSpec = {
  prefix: 'PRS',
  def: {
    meta: { id: 'servo-press', name: '서보 프레스', category: 'process' },
    params: [
      opt('frame', '프레임', ['c', 'gantry'], 'c'),
      num('capacity', '용량', 50, 1, 5000, ''),
      num('stroke', '스트로크', 200, 10, 1500),
      num('die_h', '다이 높이', 300, 50, 1500),
      num('bed_w', '베드 폭', 600, 200, 3000),
      num('bed_d', '베드 깊이', 500, 200, 3000),
      ...motion(200, 2000),
      ...processParams(8),
    ],
    geometry: { fn: 'servoPress' },
    joints: [lin('slide', [0, 0, -1], 'stroke', 'position')],
    ioTemplate: [
      ...IO.process,
      { tag: '{n}_POS_CMD', dir: 'out', type: 'real', binding: 'joint' },
      { tag: '{n}_POS_FB', dir: 'in', type: 'real', binding: 'joint' },
      { tag: '{n}_INPOS', dir: 'in', type: 'bool', binding: 'joint' },
    ],
    process: { axes: 1, cycle_time: 8, judge: true },
  },
  geometry: (p) => {
    const bw = N(p, 'bed_w', 600);
    const bd = N(p, 'bed_d', 500);
    const st = N(p, 'stroke', 200);
    const dh = N(p, 'die_h', 300);
    const gantry = S(p, 'frame', 'c') === 'gantry';
    const bedH = 800;
    const top = bedH + dh + st + 300;
    const out: Primitive[] = [
      boxOnFloor(bw + 200, bd + 200, bedH, 0, 0, 0, 0),
      box([bw, bd, 40], [0, 0, bedH + 20], 1),
    ];
    if (gantry)
      out.push(
        boxOnFloor(120, bd + 200, top - bedH, -bw / 2 - 40, 0, bedH, 0),
        boxOnFloor(120, bd + 200, top - bedH, bw / 2 + 40, 0, bedH, 0),
      );
    else out.push(box([200, bd + 200, top - bedH], [0, bd / 2 + 200, bedH + (top - bedH) / 2], 0));
    out.push(box([bw + 200, bd + 300, 300], [0, gantry ? 0 : 100, top - 150], 0));
    out.push(box([bw * 0.6, bd * 0.6, 120], [0, 0, bedH + dh + st + 60], 2, { part: 'slide' }));
    return out;
  },
  sockets: (p) => [floorMount(), ...inOut(N(p, 'bed_w', 600) + 200, 840)],
};

export const pneumaticPress: BlockSpec = {
  prefix: 'PRS',
  def: {
    meta: { id: 'pneumatic-press', name: '공압·유압 프레스', category: 'process' },
    params: [
      num('capacity', '용량', 10, 0.1, 5000, ''),
      num('stroke', '스트로크', 100, 10, 1000),
      ...motion(200, 2000),
      ...processParams(3),
    ],
    geometry: { fn: 'pneumaticPress' },
    joints: [lin('ram', [0, 0, -1], 'stroke')],
    ioTemplate: [...IO.process, ...IO.lifter],
    process: { axes: 1, cycle_time: 3, judge: false },
  },
  geometry: (p) => {
    const st = N(p, 'stroke', 100);
    return [
      boxOnFloor(400, 400, 60, 0, 0, 0, 0),
      box([120, 300, st + 400], [0, 150, 60 + (st + 400) / 2], 0),
      box([300, 300, 100], [0, 0, st + 480], 0),
      cyl(40, st + 60, [0, 0, 200 + (st + 60) / 2], 2, { part: 'ram' }),
    ];
  },
  sockets: () => [floorMount()],
};

export const nutRunnerFixed: BlockSpec = {
  prefix: 'NR',
  def: {
    meta: { id: 'nutrunner-fixed', name: '너트러너 고정식', category: 'process' },
    params: [
      int('axes', '축 수', 1, 1, 12),
      num('pitch', '축 간격', 60, 20, 500),
      num('stroke', '승강 스트로크', 100, 10, 500),
      ...motion(150, 1500),
      ...processParams(5),
    ],
    geometry: { fn: 'nutRunnerFixed' },
    joints: [lin('head', [0, 0, -1], 'stroke')],
    ioTemplate: [
      ...IO.process,
      { tag: '{n}_TORQUE_FB', dir: 'in', type: 'real', binding: 'process' },
    ],
    process: { axes: 1, cycle_time: 5, judge: true },
  },
  geometry: (p) => {
    const n = N(p, 'axes', 1);
    const pitch = N(p, 'pitch', 60);
    const st = N(p, 'stroke', 100);
    const w = (n - 1) * pitch + 80;
    const out: Primitive[] = [
      boxOnFloor(w + 100, 200, 40, 0, 0, 0, 0),
      box([80, 200, st + 400], [0, 100, 40 + (st + 400) / 2], 0),
      box([w, 100, 60], [0, 0, st + 300], 1, { part: 'head' }),
    ];
    for (let k = 0; k < n; k++)
      out.push(
        cyl(14, 200, [-((n - 1) * pitch) / 2 + k * pitch, 0, st + 170], 2, { part: 'head' }),
      );
    return out;
  },
  sockets: () => [floorMount()],
};

export const visionStation: BlockSpec = {
  prefix: 'VIS',
  def: {
    meta: { id: 'vision-station', name: '비전 검사 스테이션', category: 'process' },
    params: [
      int('cameras', '카메라 수', 1, 1, 8),
      num('w', '폭', 600, 200, 2000),
      num('d', '깊이', 600, 200, 2000),
      num('h', '높이', 1000, 300, 2500),
      ...processParams(1),
    ],
    geometry: { fn: 'visionStation' },
    ioTemplate: [...IO.process, { tag: '{n}_RESULT', dir: 'in', type: 'int', binding: 'process' }],
    process: { axes: 0, cycle_time: 1, judge: true },
  },
  geometry: (p) => {
    const w = N(p, 'w', 600);
    const d = N(p, 'd', 600);
    const h = N(p, 'h', 1000);
    const n = N(p, 'cameras', 1);
    const out: Primitive[] = [...legs(w, d, h, 40, 30), box([w, d, 30], [0, 0, h - 15], 0)];
    for (let k = 0; k < n; k++)
      out.push(box([60, 60, 90], [-((n - 1) * 120) / 2 + k * 120, 0, h - 75], 2));
    return out;
  },
  sockets: (p) => [floorMount(), ...inOut(N(p, 'w', 600), 750)],
};

export const functionTester: BlockSpec = {
  prefix: 'TST',
  def: {
    meta: { id: 'function-tester', name: '기능 테스트 (시간 + 판정)', category: 'process' },
    params: [
      num('w', '지그 폭', 500, 100, 2000),
      num('d', '지그 깊이', 400, 100, 2000),
      num('h', '높이', 900, 200, 2000),
      num('stroke', '클램프 스트로크', 50, 0, 300),
      ...motion(100, 1000),
      ...processParams(10),
    ],
    geometry: { fn: 'functionTester' },
    joints: [lin('clamp', [0, 0, -1], 'stroke')],
    ioTemplate: [...IO.process],
    process: { axes: 1, cycle_time: 10, judge: true },
  },
  geometry: (p) => {
    const w = N(p, 'w', 500);
    const d = N(p, 'd', 400);
    const h = N(p, 'h', 900);
    const st = N(p, 'stroke', 50);
    return [
      ...legs(w, d, h, 40, 30),
      box([w, d, 30], [0, 0, h - 15], 0),
      box([80, d, st + 300], [-w / 2 + 40, 0, h + (st + 300) / 2], 0),
      box([w - 120, 60, 30], [20, 0, h + st + 200], 2, { part: 'clamp' }),
    ];
  },
  sockets: (p) => [floorMount(), ...inOut(N(p, 'w', 500), N(p, 'h', 900))],
};

export const ngPusher: BlockSpec = {
  prefix: 'NGP',
  def: {
    meta: { id: 'ng-pusher', name: 'NG 배출 (푸셔 + 슈트)', category: 'process' },
    params: [
      num('stroke', '푸셔 스트로크', 300, 50, 1500),
      num('chute_w', '슈트 폭', 300, 100, 1000),
      ...motion(400, 4000),
    ],
    geometry: { fn: 'ngPusher' },
    joints: [lin('pusher', [0, -1, 0], 'stroke')],
    ioTemplate: [
      { tag: '{n}_PUSH', dir: 'out', type: 'bool', binding: 'joint' },
      { tag: '{n}_PUSH_LS', dir: 'in', type: 'bool', binding: 'sensor' },
      { tag: '{n}_BACK_LS', dir: 'in', type: 'bool', binding: 'sensor' },
    ],
    process: { axes: 1, cycle_time: 1, judge: false },
  },
  geometry: (p) => {
    const st = N(p, 'stroke', 300);
    const cw = N(p, 'chute_w', 300);
    return [
      box([60, st + 100, 60], [0, st / 2 + 50, 30], 0),
      box([cw, 20, 120], [0, -20, 60], 2, { part: 'pusher' }),
      box([cw + 100, 300, 20], [0, -st - 200, 10], 1, { rotation: [-20, 0, 0] }),
    ];
  },
  sockets: () => [floorMount()],
};

export const blackBox: BlockSpec = {
  prefix: 'BB',
  def: {
    meta: { id: 'black-box', name: '블랙박스 장비 (사출기·CNC·열처리로 등)', category: 'process' },
    params: [
      num('w', '외함 폭', 2000, 300, 20000),
      num('d', '외함 깊이', 1500, 300, 20000),
      num('h', '외함 높이', 2000, 300, 6000),
      opt('door', '도어 위치', ['front', 'left', 'right', 'none'], 'front'),
      num('door_w', '도어 폭', 800, 0, 5000),
      num('port_h', '투입·배출 높이', 900, 0, 5000),
      ...motion(500, 2000),
      ...processParams(30),
    ],
    geometry: { fn: 'blackBox' },
    joints: [lin('door', [1, 0, 0], 'door_w')],
    ioTemplate: [
      ...IO.process,
      { tag: '{n}_DOOR_OPEN', dir: 'out', type: 'bool', binding: 'joint' },
      { tag: '{n}_DOOR_OPEN_LS', dir: 'in', type: 'bool', binding: 'sensor' },
      { tag: '{n}_DOOR_CLOSE_LS', dir: 'in', type: 'bool', binding: 'sensor' },
      { tag: '{n}_CHUCK', dir: 'out', type: 'bool', binding: 'joint' },
    ],
    process: { axes: 0, cycle_time: 30, judge: true },
  },
  geometry: (p) => {
    const w = N(p, 'w', 2000);
    const d = N(p, 'd', 1500);
    const h = N(p, 'h', 2000);
    const dw = N(p, 'door_w', 800);
    const out: Primitive[] = [boxOnFloor(w, d, h, 0, 0, 0, 0)];
    if (S(p, 'door', 'front') !== 'none')
      out.push(box([dw, 12, h * 0.6], [0, -d / 2 - 6, h * 0.45], 1, { part: 'door' }));
    return out;
  },
  sockets: (p) => [floorMount(), ...inOut(N(p, 'w', 2000), N(p, 'port_h', 900))],
};

export const manualStation: BlockSpec = {
  prefix: 'MAN',
  def: {
    meta: { id: 'manual-station', name: '수작업 스테이션', category: 'process' },
    params: [
      num('w', '작업대 폭', 1200, 400, 3000),
      num('d', '작업대 깊이', 700, 300, 2000),
      num('h', '높이', 800, 500, 1200),
      opt('operator', '작업자 위치', ['front', 'back', 'left', 'right'], 'front'),
      ...processParams(20),
    ],
    geometry: { fn: 'manualStation' },
    ioTemplate: [
      { tag: '{n}_START', dir: 'out', type: 'bool', binding: 'process' },
      { tag: '{n}_DONE', dir: 'in', type: 'bool', binding: 'process' },
    ],
    process: { axes: 0, cycle_time: 20, judge: false },
  },
  geometry: (p) => {
    const w = N(p, 'w', 1200);
    const d = N(p, 'd', 700);
    const h = N(p, 'h', 800);
    return [
      ...legs(w, d, h - 30, 40, 40),
      box([w, d, 30], [0, 0, h - 15], 1),
      cyl(180, 10, [0, -d / 2 - 350, 5], 0),
    ];
  },
  sockets: (p) => [floorMount(), ...inOut(N(p, 'w', 1200), N(p, 'h', 800))],
};

export const workProcessBlocks: BlockSpec[] = [
  workBox,
  source,
  sink,
  palletTray,
  linePallet,
  jigFixture,
  bowlFeeder,
  servoPress,
  pneumaticPress,
  nutRunnerFixed,
  visionStation,
  functionTester,
  ngPusher,
  blackBox,
  manualStation,
];
