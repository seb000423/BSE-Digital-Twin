/** machine.json (지침서 4.1절). 스키마 식별자 `bse-twin/machine@1` */
import { z } from 'zod';
import { Uuid, SemVer } from './ids.js';
import { Fidelity, MachineNode } from './node.js';
import { IoEntry, TagName } from './tags.js';
import { MachineSpec } from './spec.js';
import { deg, mm, mmPerSec, UnitVec3, Vec3mm } from './units.js';

export const MACHINE_SCHEMA_ID = 'bse-twin/machine@1' as const;

export const MachineMeta = z.object({
  id: Uuid,
  name: z.string().min(1),
  bbox: z.tuple([mm, mm, mm]).describe('[W, D, H] mm, 외곽 가이드 박스'),
  fidelity: Fidelity.default('L1'),
  thumbnail: z.string().nullable().default(null),
  version: SemVer.default('0.1.0'),
});

/** 설비 카드 (L1): 공장 DES 에 필요한 숫자만 */
export const MachineCard = z.object({
  cycle_time: z.number().nonnegative().describe('초'),
  ok_rate: z.number().min(0).max(1).default(1),
  footprint: z.tuple([mm, mm]).describe('[W, D] mm'),
  operators: z.number().int().nonnegative().default(0),
  inlet: z.string().nullable().default(null).describe('inlet 소켓 id'),
  outlet: z.string().nullable().default(null).describe('outlet 소켓 id'),
});
export type MachineCard = z.infer<typeof MachineCard>;

/** 확인 여부 (원칙: 미확인 값은 verified=false) */
export const Verified = z.object({
  vmax: z.boolean().default(false),
  amax: z.boolean().default(false),
});

export const JointType = z.enum(['rot', 'lin', 'surface']);
export const JointMode = z.enum(['onoff', 'position', 'continuous']);

/** 관절: 직동은 mm, 회전은 deg. 0 = 후퇴/홈. vmax·amax 필수 (지침서 8.5절) */
export const JointFields = z.object({
  id: Uuid,
  node: Uuid,
  type: JointType,
  axis: UnitVec3,
  mode: JointMode,
  min: z.number().default(0).describe('lin: mm, rot: deg. surface 는 쓰지 않음'),
  max: z.number().optional().describe('rot·lin 필수'),
  home: z.number().default(0),
  vmax: z.number().positive().describe('mm/s 또는 deg/s'),
  amax: z.number().positive().describe('mm/s² 또는 deg/s²'),
  jmax: z.number().positive().optional(),
  effort: z.number().positive().optional(),
  verified: Verified.prefault({}),
});
export const Joint = JointFields.superRefine((j, ctx) => {
  if (j.type === 'surface') return;
  if (j.max === undefined)
    ctx.addIssue({ code: 'custom', message: 'rot·lin 관절은 max 필수', path: ['max'] });
  else if (!(j.min <= j.home && j.home <= j.max))
    ctx.addIssue({ code: 'custom', message: 'home 은 min~max 안에 있어야 함', path: ['home'] });
});
export type Joint = z.infer<typeof Joint>;

export const Robot = z
  .object({
    urdf: z.string().describe('URDF 에셋 참조'),
    tcp: Vec3mm.default([0, 0, 0]),
    tcp_vmax: mmPerSec,
    tcp_amax: z.number().positive(),
    payload: z.number().nonnegative().describe('kg'),
    derating: z
      .array(z.object({ payload: z.number(), factor: z.number().min(0).max(1) }))
      .default([]),
    override: z.number().min(1).max(100).default(100),
  })
  .nullable()
  .default(null);

export const SegmentType = z.enum(['PTP', 'LIN', 'CIRC', 'PATH']);
export const Trajectory = z.object({
  id: Uuid,
  segments: z.array(
    z.object({
      type: SegmentType,
      points: z.array(z.union([Vec3mm, z.array(deg)])).min(1),
      speed: z.number().positive().optional(),
      blend: z.number().nonnegative().default(0),
      tool: z.string().nullable().default(null),
    }),
  ),
  process: z
    .array(
      z.object({
        segment: z.number().int().nonnegative(),
        tag: TagName,
        params: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .default([]),
});

/** 간이 시퀀스 (V1): 스텝 = 출력 세트 + 전이 조건. 정식 모델(IEC 61131-3 SFC)은 R2 검토 항목 */
export const SequenceStep = z.object({
  id: z.string().min(1),
  set: z.array(z.object({ tag: TagName, value: z.union([z.boolean(), z.number()]) })).default([]),
  wait: z.array(z.object({ tag: TagName, value: z.union([z.boolean(), z.number()]) })).default([]),
  timeout_ms: z.number().int().positive().optional(),
});

export const ProcessModel = z
  .object({
    cycle_time: z.number().nonnegative().describe('초'),
    ok_rate: z.number().min(0).max(1).default(1),
    batch_size: z.number().int().positive().default(1),
    consumable: z.string().nullable().default(null),
    work_state_in: z.string().nullable().default(null),
    work_state_out: z.string().nullable().default(null),
  })
  .nullable()
  .default(null);

export const MachineExt = z.object({
  aas: z
    .object({ assetId: z.string().optional(), submodelIds: z.array(z.string()).optional() })
    .nullable()
    .default(null),
  usd: z.object({ primPath: z.string().optional() }).nullable().default(null),
});

export const Machine = z
  .object({
    schema: z.literal(MACHINE_SCHEMA_ID),
    meta: MachineMeta,
    card: MachineCard,
    nodes: z.array(MachineNode).default([]),
    joints: z.array(Joint).default([]),
    robot: Robot,
    trajectories: z.array(Trajectory).default([]),
    io: z.array(IoEntry).default([]),
    sequence: z.object({ steps: z.array(SequenceStep).default([]) }).prefault({}),
    process: ProcessModel,
    spec: MachineSpec.prefault({}),
    ext: MachineExt.prefault({}),
  })
  .superRefine((m, ctx) => {
    const ids = new Set<string>();
    for (const n of m.nodes) {
      if (ids.has(n.id))
        ctx.addIssue({ code: 'custom', message: `노드 id 중복: ${n.id}`, path: ['nodes'] });
      ids.add(n.id);
    }
    for (const n of m.nodes) {
      if (n.parent && !ids.has(n.parent))
        ctx.addIssue({ code: 'custom', message: `부모 노드 없음: ${n.parent}`, path: ['nodes'] });
      if (n.type === 'block' && !n.blockType)
        ctx.addIssue({
          code: 'custom',
          message: `블록 노드에 blockType 없음: ${n.id}`,
          path: ['nodes'],
        });
    }
    for (const j of m.joints) {
      if (!ids.has(j.node))
        ctx.addIssue({ code: 'custom', message: `관절의 노드 없음: ${j.node}`, path: ['joints'] });
    }
    const tags = new Set<string>();
    for (const io of m.io) {
      if (tags.has(io.tag))
        ctx.addIssue({ code: 'custom', message: `태그 중복: ${io.tag}`, path: ['io'] });
      tags.add(io.tag);
    }
  });
export type Machine = z.infer<typeof Machine>;
export type MachineInput = z.input<typeof Machine>;
