/**
 * 블록 라이브러리: 명세 등록·검색, 파라미터 기본값·검증, 지오메트리·소켓 계산, 노드 인스턴스화(관절·태그 생성).
 * 지침서 6.1절 4번: "기능 블록을 놓는 순간 관절·태그 기본값 생성"이 여기의 instantiate 다.
 */
import {
  BlockDef,
  type BlockDef as BlockDefT,
  type IoEntry,
  type Socket,
  type TagBindingKind,
} from '@bse/schema';
import type { Primitive } from './geometry.js';
import type { BlockSpec, Params, ParamValue } from './spec.js';
import { structureBlocks } from './defs/structure.js';
import { transportBlocks } from './defs/transport.js';
import { actuatorBlocks } from './defs/actuators.js';
import { robotSensorBlocks } from './defs/robot-sensor.js';
import { workProcessBlocks } from './defs/work-process.js';

/** 관절 인스턴스 (id 는 호출자가 붙인다) */
export interface JointDraft {
  name: string;
  type: 'rot' | 'lin' | 'surface';
  axis: [number, number, number];
  mode: 'onoff' | 'position' | 'continuous';
  min: number;
  max: number;
  home: number;
  vmax: number;
  amax: number;
}
export interface IoDraft {
  tag: string;
  dir: IoEntry['dir'];
  type: IoEntry['type'];
  binding: TagBindingKind;
}

export interface BlockEntry {
  def: BlockDefT;
  spec: BlockSpec;
}

export class BlockLibrary {
  private readonly entries = new Map<string, BlockEntry>();

  register(spec: BlockSpec): BlockEntry {
    const def = BlockDef.parse(spec.def);
    if (this.entries.has(def.meta.id)) throw new Error(`블록 타입 중복: ${def.meta.id}`);
    const entry = { def, spec };
    this.entries.set(def.meta.id, entry);
    return entry;
  }
  get(id: string): BlockEntry | undefined {
    return this.entries.get(id);
  }
  require(id: string): BlockEntry {
    const e = this.entries.get(id);
    if (!e) throw new Error(`없는 블록 타입: ${id}`);
    return e;
  }
  list(category?: BlockDefT['meta']['category']): BlockDefT[] {
    const all = [...this.entries.values()].map((e) => e.def);
    return category ? all.filter((d) => d.meta.category === category) : all;
  }
  get size(): number {
    return this.entries.size;
  }

  /** 정의의 기본값으로 채운 파라미터 */
  defaultParams(id: string): Params {
    const out: Params = {};
    for (const p of this.require(id).def.params)
      if (p.default !== undefined) out[p.key] = p.default;
    return out;
  }

  /** 입력 파라미터를 정의로 검증·보정 (모르는 키는 버리고, 범위를 벗어나면 오류) */
  validateParams(id: string, input: Record<string, unknown>): { params: Params; errors: string[] } {
    const def = this.require(id).def;
    const params = this.defaultParams(id);
    const errors: string[] = [];
    for (const p of def.params) {
      const v = input[p.key];
      if (v === undefined) continue;
      switch (p.type) {
        case 'number':
        case 'integer': {
          const n = typeof v === 'number' ? v : Number(v);
          if (!Number.isFinite(n)) errors.push(`${p.key}: 숫자가 아님`);
          else if (p.type === 'integer' && !Number.isInteger(n))
            errors.push(`${p.key}: 정수가 아님`);
          else if ((p.min !== undefined && n < p.min) || (p.max !== undefined && n > p.max))
            errors.push(`${p.key}: 범위 ${p.min ?? '-∞'}~${p.max ?? '∞'} 밖 (${n})`);
          else params[p.key] = n;
          break;
        }
        case 'boolean':
          if (typeof v !== 'boolean') errors.push(`${p.key}: 참/거짓이 아님`);
          else params[p.key] = v;
          break;
        case 'enum': {
          const s = String(v);
          if (!p.options?.includes(s)) errors.push(`${p.key}: 선택지 밖 (${s})`);
          else params[p.key] = s;
          break;
        }
        default:
          params[p.key] = String(v);
      }
    }
    return { params, errors };
  }

  geometry(id: string, params: Params): Primitive[] {
    return this.require(id).spec.geometry(params);
  }

  sockets(id: string, params: Params): Socket[] {
    const e = this.require(id);
    return e.spec.sockets ? e.spec.sockets(params) : e.def.sockets;
  }

  /** 관절 초안: 범위는 rangeFrom 파라미터, 속도·가속은 vmax·amax 파라미터(없으면 종류별 기본값). 모두 verified=false 로 저장할 것 */
  joints(id: string, params: Params): JointDraft[] {
    const e = this.require(id);
    return e.def.joints.map((j) => {
      const range = num(params[j.rangeFrom], j.type === 'surface' ? 1 : 100);
      const rot = j.type === 'rot';
      const symmetric = rot && j.mode === 'position';
      return {
        name: j.name,
        type: j.type,
        axis: j.axis,
        mode: j.mode,
        min: j.type === 'surface' ? 0 : symmetric ? -range : 0,
        max: j.type === 'surface' ? 1 : range,
        home: 0,
        vmax: num(params['vmax'], rot ? 180 : 300),
        amax: num(params['amax'], rot ? 720 : 2000),
      };
    });
  }

  /** 태그 초안: 템플릿의 {n} 을 접두어로 치환. 관절 바인딩은 아직 관절 id 가 없으므로 이름으로 연결 */
  io(id: string, prefix: string): IoDraft[] {
    const e = this.require(id);
    return e.def.ioTemplate.map((t) => ({
      tag: t.tag.replace('{n}', prefix),
      dir: t.dir,
      type: t.type,
      binding: t.binding,
    }));
  }

  /** 태그 접두어 어간 (CYL, CV …) */
  prefix(id: string): string {
    return this.require(id).spec.prefix;
  }
}

function num(v: ParamValue | undefined, fallback: number): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v))) return Number(v);
  return fallback;
}

/** 1차 블록 전체를 등록한 라이브러리 */
export function createLibrary(): BlockLibrary {
  const lib = new BlockLibrary();
  for (const s of [
    ...structureBlocks,
    ...transportBlocks,
    ...actuatorBlocks,
    ...robotSensorBlocks,
    ...workProcessBlocks,
  ])
    lib.register(s);
  return lib;
}
