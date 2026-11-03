/**
 * 편집 명령 API (지침서 원칙 4, 10.2절): 모든 편집은 명령 단위. UI·AI·MCP 는 이 명령을 부르는 호출자일 뿐.
 * 명령은 구별 가능한 합집합(discriminated union) 하나로 정의하고, 여기서 OpenAPI·MCP 도구 설명을 생성한다.
 * 구현 순서: 여기 정의 → packages/engine 또는 편집기 코어에 구현 → UI 호출 (CLAUDE.md 6장).
 */
import { z } from 'zod';
import { BlockTypeId, MachineRef, Uuid } from './ids.js';
import { TagName, TagPrefix } from './tags.js';
import { Transform, UnitVec3, Vec3mm } from './units.js';
import { JointFields, MachineCard, SequenceStep } from './machine.js';

type Scope = 'machine' | 'factory';
const Point2 = z.tuple([z.number(), z.number()]);

/* ── 공통 ── */
const select = z.object({ cmd: z.literal('select'), ids: z.array(Uuid) });
const move = z.object({ cmd: z.literal('move'), id: Uuid, transform: Transform.partial() });
const snap = z.object({
  cmd: z.literal('snap'),
  id: Uuid,
  socket: z.string(),
  targetId: Uuid,
  targetSocket: z.string(),
});
const group = z.object({
  cmd: z.literal('group'),
  ids: z.array(Uuid).min(2),
  name: z.string().default('Group'),
});
const ungroup = z.object({ cmd: z.literal('ungroup'), id: Uuid });
const duplicate = z.object({
  cmd: z.literal('duplicate'),
  ids: z.array(Uuid).min(1),
  offset: Vec3mm.default([0, 0, 0]),
});
const mirror = z.object({
  cmd: z.literal('mirror'),
  ids: z.array(Uuid).min(1),
  plane: z.enum(['xz', 'yz']),
});
const array = z.object({
  cmd: z.literal('array'),
  ids: z.array(Uuid).min(1),
  count: z.number().int().min(2),
  step: Vec3mm,
});
const remove = z.object({ cmd: z.literal('remove'), ids: z.array(Uuid).min(1) });
const rename = z.object({ cmd: z.literal('rename'), id: Uuid, name: z.string().min(1) });
const set_reference = z.object({
  cmd: z.literal('set_reference'),
  asset: z.string(),
  kind: z.enum(['image', 'dxf']),
  plane: z.enum(['floor', 'side']).default('floor'),
  scalePoints: z.tuple([Point2, Point2]).optional(),
  scaleDistance: z.number().positive().optional().describe('두 점 사이 실제 거리 (mm)'),
});
const measure = z.object({ cmd: z.literal('measure'), from: Vec3mm, to: Vec3mm });
const check_collision = z.object({
  cmd: z.literal('check_collision'),
  ids: z.array(Uuid).optional(),
});
const undo = z.object({ cmd: z.literal('undo') });
const redo = z.object({ cmd: z.literal('redo') });
const save = z.object({ cmd: z.literal('save'), message: z.string().default('') });
const export_ = z.object({
  cmd: z.literal('export'),
  format: z.enum(['json', 'glb', 'dxf', 'xlsx_io', 'pdf', 'card']),
});

/* ── 머신빌더 (지침서 6장) ── */
const set_bbox = z.object({
  cmd: z.literal('set_bbox'),
  bbox: z.tuple([z.number(), z.number(), z.number()]),
});
const add_block = z.object({
  cmd: z.literal('add_block'),
  blockType: BlockTypeId,
  params: z.record(z.string(), z.unknown()).default({}),
  transform: Transform.partial().prefault({}),
  parent: Uuid.nullable().default(null),
});
const set_param = z
  .object({
    cmd: z.literal('set_param'),
    id: Uuid,
    key: z.string(),
    value: z.union([z.number(), z.boolean(), z.string()]),
  })
  .describe('값 검증은 블록 정의의 params 로');
const load_glb = z.object({
  cmd: z.literal('load_glb'),
  asset: z.string(),
  transform: Transform.partial().prefault({}),
});
const load_urdf = z.object({ cmd: z.literal('load_urdf'), asset: z.string() });
const add_joint = z.object({
  cmd: z.literal('add_joint'),
  node: Uuid,
  type: z.enum(['rot', 'lin', 'surface']),
  axis: UnitVec3,
  mode: z.enum(['onoff', 'position', 'continuous']),
  min: z.number().default(0),
  max: z.number(),
  vmax: z.number().positive(),
  amax: z.number().positive(),
});
const set_joint = z.object({
  cmd: z.literal('set_joint'),
  id: Uuid,
  patch: JointFields.partial().omit({ id: true, node: true }),
});
const bind_tag = z.object({
  cmd: z.literal('bind_tag'),
  tag: TagName,
  kind: z.enum(['joint', 'sensor', 'process', 'carrier', 'trajectory']),
  target: Uuid,
});
const rename_tag = z.object({ cmd: z.literal('rename_tag'), from: TagName, to: TagName });
const import_io = z.object({
  cmd: z.literal('import_io'),
  asset: z.string().describe('I/O 리스트 엑셀'),
});
const add_work = z.object({
  cmd: z.literal('add_work'),
  kind: z.enum(['work', 'source', 'sink', 'carrier']),
  transform: Transform.partial().prefault({}),
  params: z.record(z.string(), z.unknown()).default({}),
});
const attach = z.object({ cmd: z.literal('attach'), tool: Uuid, work: Uuid });
const detach = z.object({ cmd: z.literal('detach'), tool: Uuid });
const set_sequence = z.object({ cmd: z.literal('set_sequence'), steps: z.array(SequenceStep) });
const generate_sequence = z
  .object({ cmd: z.literal('generate_sequence') })
  .describe('블록·태그를 보고 간이 동작 순서를 자동으로 만든다 (문서의 sequence 를 덮어씀)');
const auto = z
  .object({ cmd: z.literal('auto'), on: z.boolean() })
  .describe('실행 모드에서 동작 순서(sequence)를 자동으로 돌린다 / 멈춘다');
const reset_works = z
  .object({ cmd: z.literal('reset_works') })
  .describe('실행 모드에서 시뮬이 만든 워크를 모두 치우고 소스·싱크 카운트를 0 으로');
const force_tag = z
  .object({ cmd: z.literal('force_tag'), tag: TagName, value: z.union([z.boolean(), z.number()]) })
  .describe('수동 조작 패널');
const set_fidelity = z.object({
  cmd: z.literal('set_fidelity'),
  fidelity: z.enum(['L1', 'L2', 'L3']),
});
const make_card = z
  .object({ cmd: z.literal('make_card') })
  .describe('설비 카드(L1) 생성 → 팩토리 라이브러리 등록');

/* ── 팩토리빌더 (지침서 7장) ── */
const add_level = z.object({
  cmd: z.literal('add_level'),
  name: z.string(),
  elevation: z.number().default(0),
});
const draw_slab = z.object({
  cmd: z.literal('draw_slab'),
  level: z.string(),
  polygon: z.array(Point2).min(3),
});
const draw_wall = z.object({
  cmd: z.literal('draw_wall'),
  level: z.string(),
  polyline: z.array(Point2).min(2),
  height: z.number().positive(),
  thickness: z.number().positive().default(200),
});
const place_columns = z.object({
  cmd: z.literal('place_columns'),
  level: z.string(),
  origin: Point2,
  pitch: Point2,
  count: z.tuple([z.number().int(), z.number().int()]),
  height: z.number().positive(),
});
const add_opening = z.object({
  cmd: z.literal('add_opening'),
  wall: Uuid,
  kind: z.enum(['door', 'shutter', 'dock', 'emergency_exit', 'window']),
  offset: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});
const draw_marking = z.object({
  cmd: z.literal('draw_marking'),
  kind: z.enum(['aisle', 'zone', 'safety']),
  points: z.array(Point2).min(2),
});
const place_machine = z.object({
  cmd: z.literal('place_machine'),
  ref: MachineRef,
  transform: Transform.partial().prefault({}),
  tagPrefix: TagPrefix.optional(),
});
const set_card_override = z.object({
  cmd: z.literal('set_card_override'),
  id: Uuid,
  patch: MachineCard.partial(),
});
const connect_flow = z.object({
  cmd: z.literal('connect_flow'),
  from: z.string(),
  to: z.string(),
  ratio: z.number().min(0).max(1).default(1),
});
const add_storage = z.object({
  cmd: z.literal('add_storage'),
  kind: z.enum(['rack', 'floor', 'buffer']),
  transform: Transform.partial().prefault({}),
  capacity: z.number().int().positive(),
});
const add_mover = z.object({
  cmd: z.literal('add_mover'),
  kind: z.enum(['worker', 'amr', 'forklift']),
  home: Vec3mm,
  params: z.record(z.string(), z.unknown()).default({}),
});
const build_nav = z
  .object({ cmd: z.literal('build_nav') })
  .describe('바닥 마킹 → 네비 그래프 자동 생성');
const add_drop = z.object({
  cmd: z.literal('add_drop'),
  kind: z.enum(['power', 'air']),
  position: Vec3mm,
});

/* ── 시뮬레이션 (지침서 8장) ── */
const run_demo = z.object({
  cmd: z.literal('run_demo'),
  speed: z.number().min(1).max(10).default(1),
  seed: z.number().int().default(1),
});
const stop = z.object({ cmd: z.literal('stop') });
const create_scenario = z.object({
  cmd: z.literal('create_scenario'),
  name: z.string(),
  overrides: z.record(z.string(), z.unknown()).default({}),
  duration_s: z.number().positive(),
  runs: z.number().int().positive().default(1),
  seed: z.number().int().default(1),
});
const run_scenario = z
  .object({ cmd: z.literal('run_scenario'), scenario: Uuid })
  .describe('서버 헤드리스 정식 실행');
const compare = z.object({ cmd: z.literal('compare'), scenarios: z.array(Uuid).min(2) });
const replay = z.object({
  cmd: z.literal('replay'),
  scenario: Uuid,
  run: z.number().int().nonnegative().default(0),
});
const optimize = z.object({
  cmd: z.literal('optimize'),
  kind: z.enum(['layout', 'buffer', 'balancing']),
  scenario: Uuid,
  generations: z.number().int().positive().default(20),
});

export const EditCommand = z.discriminatedUnion('cmd', [
  select,
  move,
  snap,
  group,
  ungroup,
  duplicate,
  mirror,
  array,
  remove,
  rename,
  set_reference,
  measure,
  check_collision,
  undo,
  redo,
  save,
  export_,
  set_bbox,
  add_block,
  set_param,
  load_glb,
  load_urdf,
  add_joint,
  set_joint,
  bind_tag,
  rename_tag,
  import_io,
  add_work,
  attach,
  detach,
  set_sequence,
  generate_sequence,
  auto,
  reset_works,
  force_tag,
  set_fidelity,
  make_card,
  add_level,
  draw_slab,
  draw_wall,
  place_columns,
  add_opening,
  draw_marking,
  place_machine,
  set_card_override,
  connect_flow,
  add_storage,
  add_mover,
  build_nav,
  add_drop,
  run_demo,
  stop,
  create_scenario,
  run_scenario,
  compare,
  replay,
  optimize,
]);
export type EditCommand = z.infer<typeof EditCommand>;
export type EditCommandName = EditCommand['cmd'];

/** 명령이 쓰이는 범위 (문서·UI 생성용) */
export const COMMAND_SCOPE: Record<EditCommandName, readonly Scope[] | 'both'> = {
  select: 'both',
  move: 'both',
  snap: 'both',
  group: 'both',
  ungroup: 'both',
  duplicate: 'both',
  mirror: 'both',
  array: 'both',
  remove: 'both',
  rename: 'both',
  set_reference: 'both',
  measure: 'both',
  check_collision: 'both',
  undo: 'both',
  redo: 'both',
  save: 'both',
  export: 'both',
  set_bbox: ['machine'],
  add_block: ['machine'],
  set_param: ['machine'],
  load_glb: ['machine'],
  load_urdf: ['machine'],
  add_joint: ['machine'],
  set_joint: ['machine'],
  bind_tag: ['machine'],
  rename_tag: ['machine'],
  import_io: ['machine'],
  add_work: ['machine'],
  attach: ['machine'],
  detach: ['machine'],
  set_sequence: ['machine'],
  generate_sequence: ['machine'],
  auto: ['machine'],
  reset_works: ['machine'],
  force_tag: 'both',
  set_fidelity: ['machine'],
  make_card: ['machine'],
  add_level: ['factory'],
  draw_slab: ['factory'],
  draw_wall: ['factory'],
  place_columns: ['factory'],
  add_opening: ['factory'],
  draw_marking: ['factory'],
  place_machine: ['factory'],
  set_card_override: ['factory'],
  connect_flow: ['factory'],
  add_storage: ['factory'],
  add_mover: ['factory'],
  build_nav: ['factory'],
  add_drop: ['factory'],
  run_demo: 'both',
  stop: 'both',
  create_scenario: ['factory'],
  run_scenario: ['factory'],
  compare: ['factory'],
  replay: ['factory'],
  optimize: ['factory'],
};

/** 명령 실행 결과: 성공이면 바뀐 노드 id 들, 실패면 이유. 모든 명령은 되돌릴 수 있어야 함(undo) */
export const CommandResult = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    changed: z.array(Uuid).default([]),
    created: z.array(Uuid).default([]),
  }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);
export type CommandResult = z.infer<typeof CommandResult>;
