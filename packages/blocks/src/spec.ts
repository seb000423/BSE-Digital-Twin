/** 블록 명세 = 정의 데이터(스키마로 검증) + 지오메트리 함수 + 소켓 함수 + 태그 접두어 */
import type { BlockDefInput, ParamDef, Socket } from '@bse/schema';
import type { Primitive } from './geometry.js';

export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;

export interface BlockSpec {
  def: BlockDefInput;
  /** 파라미터 → 기본 도형 목록 (mm, 블록 원점 = 바닥면 중심) */
  geometry: (p: Params) => Primitive[];
  /** 파라미터 → 소켓 (없으면 def.sockets 그대로) */
  sockets?: (p: Params) => Socket[];
  /** 태그 접두어 어간 (예: CYL → CYL1, CYL2 …). 4.4절 */
  prefix: string;
}

/* ── 파라미터 선언 도우미 ── */
export const num = (
  key: string,
  label: string,
  def: number,
  min: number,
  max: number,
  unit: ParamDef['unit'] = 'mm',
): ParamDef => ({ key, label, type: 'number', unit, default: def, min, max });
export const int = (
  key: string,
  label: string,
  def: number,
  min: number,
  max: number,
): ParamDef => ({
  key,
  label,
  type: 'integer',
  unit: 'count',
  default: def,
  min,
  max,
});
export const opt = (key: string, label: string, options: string[], def: string): ParamDef => ({
  key,
  label,
  type: 'enum',
  unit: '',
  options,
  default: def,
});
export const flag = (key: string, label: string, def: boolean): ParamDef => ({
  key,
  label,
  type: 'boolean',
  unit: '',
  default: def,
});
/** 동작 한계 (지침서 8.5절): vmax·amax 는 관절 필수값. 단위는 lin mm/s·mm/s², rot deg/s·deg/s² */
export const motion = (vmax: number, amax: number, rot = false): ParamDef[] => [
  num('vmax', rot ? '최대 속도 (deg/s)' : '최대 속도', vmax, 1, 100000, rot ? '' : 'mm/s'),
  num('amax', rot ? '최대 가속 (deg/s²)' : '최대 가속 (mm/s²)', amax, 1, 1000000, ''),
];

/* ── 파라미터 읽기 ── */
export const N = (p: Params, key: string, fallback = 0): number => {
  const v = p[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v))) return Number(v);
  return fallback;
};
export const S = (p: Params, key: string, fallback = ''): string => {
  const v = p[key];
  return typeof v === 'string' ? v : fallback;
};
export const B = (p: Params, key: string, fallback = false): boolean => {
  const v = p[key];
  return typeof v === 'boolean' ? v : fallback;
};

/* ── 소켓 도우미 ── */
export const socket = (
  id: string,
  kind: Socket['kind'],
  position: [number, number, number],
  normal: [number, number, number],
  compatible: Socket['kind'][] = [],
): Socket => ({ id, kind, position, normal, compatible });
/** 바닥 마운트 소켓 (설비 바닥면 중심) */
export const floorMount = (): Socket => socket('base', 'mount', [0, 0, 0], [0, 0, -1], ['surface']);
/** 투입(-X) · 배출(+X) 소켓 쌍 */
export const inOut = (length: number, z: number): Socket[] => [
  socket('in', 'inlet', [-length / 2, 0, z], [-1, 0, 0], ['outlet']),
  socket('out', 'outlet', [length / 2, 0, z], [1, 0, 0], ['inlet']),
];

/* ── 태그 템플릿 세트 (4.4절) ── */
type Io = NonNullable<BlockDefInput['ioTemplate']>[number];
const o = (tag: string, binding: Io['binding'] = 'joint', type: Io['type'] = 'bool'): Io => ({
  tag: `{n}_${tag}`,
  dir: 'out',
  type,
  binding,
});
const i = (tag: string, binding: Io['binding'] = 'sensor', type: Io['type'] = 'bool'): Io => ({
  tag: `{n}_${tag}`,
  dir: 'in',
  type,
  binding,
});
export const IO = {
  onoff_axis: [o('FWD'), o('BWD'), i('FWD_LS'), i('BWD_LS')],
  onoff_rotate: [o('CW'), o('CCW'), i('CW_LS'), i('CCW_LS')],
  clamp: [o('CLAMP'), o('UNCLAMP'), i('CLAMP_LS'), i('UNCLAMP_LS')],
  lifter: [o('UP'), o('DOWN'), i('UP_LS'), i('DOWN_LS')],
  gripper: [o('OPEN'), o('CLOSE'), i('OPEN_LS'), i('CLOSE_LS')],
  vacuum: [o('VAC_ON', 'carrier'), i('VAC_OK', 'carrier')],
  position_axis: [
    o('POS_CMD', 'joint', 'real'),
    i('POS_FB', 'joint', 'real'),
    i('INPOS', 'joint'),
    o('HOME'),
    o('SVON'),
    i('ALARM', 'joint'),
  ],
  speed_axis: [o('RUN'), o('DIR'), o('SPEED', 'joint', 'real')],
  sensor_bool: [i('ON')],
  sensor_safety: [i('ON'), i('SAFE')],
  process: [
    o('START', 'process'),
    i('BUSY', 'process'),
    i('DONE', 'process'),
    i('OK', 'process'),
    i('NG', 'process'),
    i('ALARM', 'process'),
    i('READY', 'process'),
  ],
  robot: [
    o('PGM_NO', 'trajectory', 'int'),
    o('START', 'trajectory'),
    i('INPOS', 'trajectory'),
    i('RUNNING', 'trajectory'),
    i('ALARM', 'trajectory'),
  ],
  carrier: [i('FULL', 'carrier'), i('EMPTY', 'carrier'), i('COUNT', 'carrier', 'int')],
  door: [i('DOOR_CLOSED'), o('LOCK'), i('LOCKED')],
  source: [i('READY', 'carrier'), i('COUNT', 'carrier', 'int')],
  sink: [i('COUNT', 'carrier', 'int')],
} as const;

/** 관절 템플릿 도우미 */
type JointT = NonNullable<BlockDefInput['joints']>[number];
export const lin = (
  name: string,
  axis: [number, number, number],
  rangeFrom: string,
  mode: JointT['mode'] = 'onoff',
): JointT => ({ name, type: 'lin', axis, mode, rangeFrom });
export const rot = (
  name: string,
  axis: [number, number, number],
  rangeFrom: string,
  mode: JointT['mode'] = 'onoff',
): JointT => ({ name, type: 'rot', axis, mode, rangeFrom });
export const surface = (name: string, axis: [number, number, number]): JointT => ({
  name,
  type: 'surface',
  axis,
  mode: 'continuous',
  rangeFrom: 'length',
});
