/**
 * 블록 정의 (지침서 4.3절, 원칙 5): 블록 = 형식 + 파라미터 + 치수 룩업 테이블. 메이커 제품은 블록이 아니다.
 * 지오메트리 함수 자체는 packages/blocks 에 있고, 여기는 정의 데이터의 모양만 고정한다.
 */
import { z } from 'zod';
import { BlockTypeId } from './ids.js';
import { Fidelity, Socket } from './node.js';
import { TagDir, TagType, TagBindingKind } from './tags.js';

export const BlockCategory = z.enum([
  'structure', // 구조 12
  'transport', // 반송 13
  'actuator_pneumatic', // 액추에이터 공압 12
  'actuator_electric', // 액추에이터 전동 8
  'robot', // 로봇 8
  'sensor', // 센서 10
  'work_carrier', // 워크·용기 9
  'feeder', // 피더 6
  'process', // 공정 공통 모델 25
  'mover', // 이동체 7 (팩토리빌더)
  'building', // 팩토리빌더 공장 블록
]);
export type BlockCategory = z.infer<typeof BlockCategory>;

/** 파라미터 선언: UI 폼과 검증의 근거 */
export const ParamDef = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9_]*$/),
  label: z.string().min(1),
  type: z.enum(['number', 'integer', 'boolean', 'enum', 'string']),
  unit: z.enum(['mm', 'deg', 'mm/s', 'kg', 's', 'count', '']).default(''),
  default: z.union([z.number(), z.boolean(), z.string()]).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  options: z.array(z.string()).optional(),
});

/** 치수 표 한 줄: 형식별 대표 치수. 카탈로그 확인값만 verified=true */
export const DimRow = z.object({
  key: z.string().min(1).describe('예: 보어 32'),
  values: z.record(z.string(), z.number()),
  verified: z.boolean().default(false),
  source: z.string().nullable().default(null),
});

export const JointTemplate = z.object({
  name: z.string().min(1),
  type: z.enum(['rot', 'lin', 'surface']),
  axis: z.tuple([z.number(), z.number(), z.number()]),
  mode: z.enum(['onoff', 'position', 'continuous']),
  rangeFrom: z.string().describe('min/max 를 계산할 파라미터 키 (예: stroke)'),
});

export const IoTemplate = z.object({
  tag: z.string().regex(/^\{n\}_[A-Z0-9_]+$|^[A-Z][A-Z0-9_]*$/),
  dir: TagDir,
  type: TagType,
  binding: TagBindingKind,
});

export const BlockDef = z.object({
  meta: z.object({
    id: BlockTypeId,
    name: z.string().min(1),
    category: BlockCategory,
    fidelity: Fidelity.default('L2'),
    thumbnail: z.string().nullable().default(null),
    maker_note: z.string().nullable().default(null),
  }),
  params: z.array(ParamDef).default([]),
  geometry: z.object({
    fn: z.string().min(1).describe('packages/blocks 의 지오메트리 함수 이름'),
    dimTable: z.array(DimRow).default([]),
    glbRef: z.string().nullable().default(null),
  }),
  sockets: z.array(Socket).default([]),
  joints: z.array(JointTemplate).default([]),
  ioTemplate: z.array(IoTemplate).default([]),
  process: z
    .object({
      axes: z.number().int().min(0).max(2).default(0),
      cycle_time: z.number().nonnegative().default(0),
      judge: z.boolean().default(false),
    })
    .nullable()
    .default(null),
  carrier: z
    .object({
      capacity: z.number().int().positive(),
      layout: z.tuple([z.number().int(), z.number().int(), z.number().int()]),
      pitch: z.tuple([z.number(), z.number(), z.number()]),
    })
    .nullable()
    .default(null),
  robot: z
    .object({
      urdf: z.string(),
      payload: z.number().nonnegative(),
      tcp_vmax: z.number().positive(),
      tcp_amax: z.number().positive(),
    })
    .nullable()
    .default(null),
  detect: z
    .object({
      shape: z.enum(['ray', 'segment', 'area', 'volume']),
      range: z.number().positive(),
      target: z.enum(['work', 'carrier', 'any']).default('any'),
    })
    .nullable()
    .default(null),
});
export type BlockDef = z.infer<typeof BlockDef>;
