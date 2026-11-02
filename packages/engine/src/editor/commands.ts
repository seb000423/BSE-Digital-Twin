/**
 * 머신빌더 편집 명령 실행기 (원칙 4). 입력 문서를 바꾸지 않고 새 문서를 돌려준다 → 실행 취소는 세션이 스냅샷으로 처리.
 * 명령 정의는 @bse/schema commands.ts, 블록 지식은 @bse/blocks. UI·AI·MCP 는 applyCommand 를 부르기만 한다.
 */
import {
  Machine,
  MACHINE_SCHEMA_ID,
  type CommandResult,
  type EditCommand,
  type IoEntry,
  type Joint,
  type MachineNode,
  type Socket,
} from '@bse/schema';
import type { BlockLibrary } from '@bse/blocks';
import type { IdFactory } from './uuid.js';

export interface EditorContext {
  lib: BlockLibrary;
  newId: IdFactory;
}

export interface ApplyResult {
  doc: Machine;
  result: CommandResult;
}

type Vec3 = [number, number, number];
const fail = (doc: Machine, error: string): ApplyResult => ({ doc, result: { ok: false, error } });
const ok = (doc: Machine, changed: string[] = [], created: string[] = []): ApplyResult => ({
  doc,
  result: { ok: true, changed, created },
});

/** 빈 설비 문서 */
export function newMachine(id: string, name: string, bbox: Vec3): Machine {
  return Machine.parse({
    schema: MACHINE_SCHEMA_ID,
    meta: { id, name, bbox, fidelity: 'L2' },
    card: { cycle_time: 0, footprint: [bbox[0], bbox[1]] },
  });
}

const clone = <T>(v: T): T => structuredClone(v);
const findNode = (doc: Machine, id: string): MachineNode | undefined =>
  doc.nodes.find((n) => n.id === id);
const blockMeta = (n: MachineNode): { prefix: string; index: number } | null => {
  const b = n.components['block'];
  return b && typeof b === 'object' && 'prefix' in b
    ? (b as { prefix: string; index: number })
    : null;
};

/** 노드와 그 자손 id */
function subtree(doc: Machine, id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of doc.nodes)
      if (n.parent && out.has(n.parent) && !out.has(n.id)) {
        out.add(n.id);
        grew = true;
      }
  }
  return out;
}

/** 블록 노드 추가 (6.1절 4번: 놓는 순간 관절·태그 기본값 생성) */
function addBlock(
  doc: Machine,
  ctx: EditorContext,
  blockType: string,
  paramsIn: Record<string, unknown>,
  transform: { position?: Vec3 | undefined; rotation?: Vec3 | undefined },
  parent: string | null,
  nameOverride?: string,
): ApplyResult {
  const entry = ctx.lib.get(blockType);
  if (!entry) return fail(doc, `없는 블록 타입: ${blockType}`);
  if (parent && !findNode(doc, parent)) return fail(doc, `부모 노드 없음: ${parent}`);
  const { params, errors } = ctx.lib.validateParams(blockType, paramsIn);
  if (errors.length) return fail(doc, `파라미터 오류: ${errors.join(', ')}`);

  const next = clone(doc);
  const stem = ctx.lib.prefix(blockType);
  const used = new Set(next.nodes.map((n) => blockMeta(n)?.prefix));
  let index = 1;
  while (used.has(`${stem}${index}`)) index++;
  const prefix = `${stem}${index}`;
  const nodeId = ctx.newId();
  const node: MachineNode = {
    id: nodeId,
    type: 'block',
    name: nameOverride ?? `${entry.def.meta.name} ${index}`,
    blockType,
    params,
    glb: null,
    transform: {
      position: transform.position ?? [0, 0, 0],
      rotation: transform.rotation ?? [0, 0, 0],
    },
    parent,
    sockets: ctx.lib.sockets(blockType, params),
    components: { block: { prefix, index } },
  };
  next.nodes.push(node);

  const created = [nodeId];
  const jointIds = new Map<string, string>();
  for (const j of ctx.lib.joints(blockType, params)) {
    const jid = ctx.newId();
    jointIds.set(j.name, jid);
    const joint: Joint = {
      id: jid,
      node: nodeId,
      type: j.type,
      axis: j.axis,
      mode: j.mode,
      min: j.min,
      max: j.max,
      home: j.home,
      vmax: j.vmax,
      amax: j.amax,
      verified: { vmax: false, amax: false },
    };
    next.joints.push(joint);
    created.push(jid);
  }
  const firstJoint = [...jointIds.values()][0];
  const existing = new Set(next.io.map((e) => e.tag));
  for (const t of ctx.lib.io(blockType, prefix)) {
    if (existing.has(t.tag)) continue; // START·STOP 같은 설비 공통 태그는 한 번만
    const target = t.binding === 'joint' && firstJoint ? firstJoint : nodeId;
    const entryIo: IoEntry = {
      tag: t.tag,
      dir: t.dir,
      type: t.type,
      binding: { kind: t.binding, target },
    };
    next.io.push(entryIo);
    existing.add(t.tag);
  }
  if (next.nodes.length === 1 || !next.io.some((e) => e.tag === 'START')) {
    // 설비 공통 태그 (4.4절 machine_common) 는 첫 블록에서 한 번
    for (const tag of ['START', 'STOP', 'RESET', 'EMO', 'AUTO_MAN', 'RUN', 'ALARM'] as const)
      if (!existing.has(tag)) {
        next.io.push({
          tag,
          dir: tag === 'RUN' || tag === 'ALARM' ? 'in' : 'out',
          type: 'bool',
          binding: null,
        });
        existing.add(tag);
      }
  }
  return ok(next, [], created);
}

function setParam(
  doc: Machine,
  ctx: EditorContext,
  id: string,
  key: string,
  value: number | boolean | string,
): ApplyResult {
  const node = findNode(doc, id);
  if (!node) return fail(doc, `노드 없음: ${id}`);
  if (node.type !== 'block' || !node.blockType) return fail(doc, `블록 노드가 아님: ${id}`);
  const { params, errors } = ctx.lib.validateParams(node.blockType, {
    ...node.params,
    [key]: value,
  });
  if (errors.length) return fail(doc, `파라미터 오류: ${errors.join(', ')}`);
  if (!(key in params)) return fail(doc, `없는 파라미터: ${key}`);
  const next = clone(doc);
  const n = findNode(next, id)!;
  n.params = params;
  n.sockets = ctx.lib.sockets(node.blockType, params);
  // 관절 범위·속도는 파라미터를 따라간다 (사용자가 set_joint 로 따로 고친 값은 덮어씀)
  const drafts = ctx.lib.joints(node.blockType, params);
  const changed = [id];
  for (const j of next.joints.filter((x) => x.node === id)) {
    const d = drafts.find(
      (x) =>
        x.name ===
        jointName(
          j,
          drafts,
          next.joints.filter((x) => x.node === id),
        ),
    );
    if (!d) continue;
    j.min = d.min;
    j.max = d.max;
    j.vmax = d.vmax;
    j.amax = d.amax;
    if (j.home < j.min || j.home > j.max) j.home = j.min;
    changed.push(j.id);
  }
  return ok(next, changed);
}

/** 관절 이름은 저장하지 않으므로 노드 안 순서로 초안과 짝짓는다 */
function jointName(j: Joint, drafts: { name: string }[], joints: Joint[]): string {
  const i = joints.indexOf(j);
  return drafts[i]?.name ?? '';
}

function rotateZ(v: Vec3, deg: number): Vec3 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}

/** 노드의 설비 좌표 변환 (부모 체인, Z 회전만 고려) */
export function worldPosition(doc: Machine, id: string, local: Vec3 = [0, 0, 0]): Vec3 {
  let p: Vec3 = local;
  let n = findNode(doc, id);
  while (n) {
    const r = rotateZ(p, n.transform.rotation[2]);
    p = [
      r[0] + n.transform.position[0],
      r[1] + n.transform.position[1],
      r[2] + n.transform.position[2],
    ];
    n = n.parent ? findNode(doc, n.parent) : undefined;
  }
  return p;
}

function snap(
  doc: Machine,
  id: string,
  socketId: string,
  targetId: string,
  targetSocket: string,
): ApplyResult {
  const node = findNode(doc, id);
  const target = findNode(doc, targetId);
  if (!node || !target) return fail(doc, '노드 없음');
  if (id === targetId || subtree(doc, id).has(targetId))
    return fail(doc, '자기 자신이나 자손에는 붙일 수 없음');
  const a = node.sockets.find((s) => s.id === socketId);
  const b = target.sockets.find((s) => s.id === targetSocket);
  if (!a || !b) return fail(doc, `소켓 없음: ${socketId} / ${targetSocket}`);
  const compatible =
    a.compatible.length === 0 || a.compatible.includes(b.kind) || b.compatible.includes(a.kind);
  if (!compatible) return fail(doc, `소켓 종류가 맞지 않음: ${a.kind} ↔ ${b.kind}`);
  const next = clone(doc);
  const n = findNode(next, id)!;
  n.parent = targetId;
  n.transform.rotation = [0, 0, 0];
  n.transform.position = [
    b.position[0] - a.position[0],
    b.position[1] - a.position[1],
    b.position[2] - a.position[2],
  ];
  return ok(next, [id]);
}

function removeNodes(doc: Machine, ids: string[]): ApplyResult {
  const gone = new Set<string>();
  for (const id of ids) {
    if (!findNode(doc, id)) return fail(doc, `노드 없음: ${id}`);
    for (const x of subtree(doc, id)) gone.add(x);
  }
  const next = clone(doc);
  next.nodes = next.nodes.filter((n) => !gone.has(n.id));
  const goneJoints = new Set(next.joints.filter((j) => gone.has(j.node)).map((j) => j.id));
  next.joints = next.joints.filter((j) => !goneJoints.has(j.id));
  next.io = next.io.filter(
    (e) => !e.binding || (!gone.has(e.binding.target) && !goneJoints.has(e.binding.target)),
  );
  return ok(next, [...gone]);
}

function makeCard(doc: Machine, ctx: EditorContext): ApplyResult {
  const next = clone(doc);
  let cycle = 0;
  let okRate = 1;
  for (const n of next.nodes) {
    if (n.type !== 'block' || !n.blockType) continue;
    const def = ctx.lib.get(n.blockType)?.def;
    if (!def?.process) continue;
    const c = Number(n.params['cycle'] ?? def.process.cycle_time);
    const r = Number(n.params['ok_rate'] ?? 1);
    cycle = Math.max(cycle, Number.isFinite(c) ? c : 0);
    if (Number.isFinite(r)) okRate *= r;
  }
  const conveyor = next.nodes.find(
    (n) => n.sockets.some((s) => s.kind === 'inlet') && n.sockets.some((s) => s.kind === 'outlet'),
  );
  next.card = {
    ...next.card,
    cycle_time: cycle || next.card.cycle_time,
    ok_rate: okRate,
    footprint: [next.meta.bbox[0], next.meta.bbox[1]],
    inlet: conveyor ? `${conveyor.id}.in` : next.card.inlet,
    outlet: conveyor ? `${conveyor.id}.out` : next.card.outlet,
  };
  return ok(next, [next.meta.id]);
}

const WORK_BLOCK = {
  work: 'work-box',
  source: 'source',
  sink: 'sink',
  carrier: 'pallet-tray',
} as const;

/** 설비 범위 명령 실행. 세션 전용 명령(select·undo·redo·save·export·force_tag)과 공장·시뮬 명령은 거부 */
export function applyCommand(doc: Machine, cmd: EditCommand, ctx: EditorContext): ApplyResult {
  switch (cmd.cmd) {
    case 'set_bbox': {
      const next = clone(doc);
      next.meta.bbox = cmd.bbox;
      next.card.footprint = [cmd.bbox[0], cmd.bbox[1]];
      return ok(next, [doc.meta.id]);
    }
    case 'add_block':
      return addBlock(doc, ctx, cmd.blockType, cmd.params, cmd.transform, cmd.parent);
    case 'add_work':
      return addBlock(doc, ctx, WORK_BLOCK[cmd.kind], cmd.params, cmd.transform, null);
    case 'set_param':
      return setParam(doc, ctx, cmd.id, cmd.key, cmd.value);
    case 'move': {
      const node = findNode(doc, cmd.id);
      if (!node) return fail(doc, `노드 없음: ${cmd.id}`);
      const next = clone(doc);
      const n = findNode(next, cmd.id)!;
      if (cmd.transform.position) n.transform.position = cmd.transform.position;
      if (cmd.transform.rotation) n.transform.rotation = cmd.transform.rotation;
      return ok(next, [cmd.id]);
    }
    case 'rename': {
      if (!findNode(doc, cmd.id)) return fail(doc, `노드 없음: ${cmd.id}`);
      const next = clone(doc);
      findNode(next, cmd.id)!.name = cmd.name;
      return ok(next, [cmd.id]);
    }
    case 'remove':
      return removeNodes(doc, cmd.ids);
    case 'snap':
      return snap(doc, cmd.id, cmd.socket, cmd.targetId, cmd.targetSocket);
    case 'duplicate':
    case 'array': {
      const count = cmd.cmd === 'array' ? cmd.count - 1 : 1;
      const step: Vec3 = cmd.cmd === 'array' ? cmd.step : cmd.offset;
      let cur = doc;
      const created: string[] = [];
      for (let k = 1; k <= count; k++)
        for (const id of cmd.ids) {
          const n = findNode(cur, id);
          if (!n) return fail(doc, `노드 없음: ${id}`);
          if (n.type !== 'block' || !n.blockType)
            return fail(doc, `블록 노드만 복제할 수 있음: ${id}`);
          const pos: Vec3 = [
            n.transform.position[0] + step[0] * k,
            n.transform.position[1] + step[1] * k,
            n.transform.position[2] + step[2] * k,
          ];
          const r = addBlock(
            cur,
            ctx,
            n.blockType,
            n.params,
            { position: pos, rotation: n.transform.rotation },
            n.parent,
          );
          if (!r.result.ok) return fail(doc, r.result.error);
          cur = r.doc;
          created.push(...r.result.created);
        }
      return ok(cur, [], created);
    }
    case 'mirror': {
      const next = clone(doc);
      for (const id of cmd.ids) {
        const n = findNode(next, id);
        if (!n) return fail(doc, `노드 없음: ${id}`);
        const i = cmd.plane === 'yz' ? 0 : 1;
        n.transform.position[i] = -n.transform.position[i];
        n.transform.rotation[2] = -n.transform.rotation[2];
      }
      return ok(next, cmd.ids);
    }
    case 'group': {
      for (const id of cmd.ids) if (!findNode(doc, id)) return fail(doc, `노드 없음: ${id}`);
      const next = clone(doc);
      const gid = ctx.newId();
      const parent = findNode(next, cmd.ids[0]!)!.parent;
      next.nodes.push({
        id: gid,
        type: 'group',
        name: cmd.name,
        blockType: null,
        params: {},
        glb: null,
        transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
        parent,
        sockets: [],
        components: {},
      });
      for (const id of cmd.ids) findNode(next, id)!.parent = gid;
      return ok(next, cmd.ids, [gid]);
    }
    case 'ungroup': {
      const g = findNode(doc, cmd.id);
      if (!g || g.type !== 'group') return fail(doc, `그룹 노드가 아님: ${cmd.id}`);
      const next = clone(doc);
      const children = next.nodes.filter((n) => n.parent === cmd.id);
      for (const c of children) {
        c.parent = g.parent;
        c.transform.position = [
          c.transform.position[0] + g.transform.position[0],
          c.transform.position[1] + g.transform.position[1],
          c.transform.position[2] + g.transform.position[2],
        ];
      }
      next.nodes = next.nodes.filter((n) => n.id !== cmd.id);
      return ok(
        next,
        children.map((c) => c.id),
      );
    }
    case 'add_joint': {
      if (!findNode(doc, cmd.node)) return fail(doc, `노드 없음: ${cmd.node}`);
      if (cmd.type !== 'surface' && cmd.min > cmd.max) return fail(doc, 'min 이 max 보다 큼');
      const next = clone(doc);
      const jid = ctx.newId();
      next.joints.push({
        id: jid,
        node: cmd.node,
        type: cmd.type,
        axis: cmd.axis,
        mode: cmd.mode,
        min: cmd.min,
        max: cmd.max,
        home: cmd.min,
        vmax: cmd.vmax,
        amax: cmd.amax,
        verified: { vmax: false, amax: false },
      });
      return ok(next, [cmd.node], [jid]);
    }
    case 'set_joint': {
      const j = doc.joints.find((x) => x.id === cmd.id);
      if (!j) return fail(doc, `관절 없음: ${cmd.id}`);
      const patch = Object.fromEntries(
        Object.entries(cmd.patch).filter(([, v]) => v !== undefined),
      );
      const merged: Joint = {
        ...j,
        ...patch,
        verified: { ...j.verified, ...(cmd.patch.verified ?? {}) },
      };
      if (
        merged.type !== 'surface' &&
        (merged.max === undefined ||
          merged.min > merged.max ||
          merged.home < merged.min ||
          merged.home > merged.max)
      )
        return fail(doc, '범위 오류: min ≤ home ≤ max 여야 함');
      const next = clone(doc);
      next.joints = next.joints.map((x) => (x.id === cmd.id ? merged : x));
      return ok(next, [j.node]);
    }
    case 'bind_tag': {
      const next = clone(doc);
      const targetExists =
        findNode(next, cmd.target) || next.joints.some((j) => j.id === cmd.target);
      if (!targetExists) return fail(doc, `바인딩 대상 없음: ${cmd.target}`);
      const e = next.io.find((x) => x.tag === cmd.tag);
      if (e) e.binding = { kind: cmd.kind, target: cmd.target };
      else
        next.io.push({
          tag: cmd.tag,
          dir: cmd.kind === 'sensor' ? 'in' : 'out',
          type: 'bool',
          binding: { kind: cmd.kind, target: cmd.target },
        });
      return ok(next, [cmd.target]);
    }
    case 'rename_tag': {
      if (!doc.io.some((x) => x.tag === cmd.from)) return fail(doc, `태그 없음: ${cmd.from}`);
      if (doc.io.some((x) => x.tag === cmd.to)) return fail(doc, `태그 중복: ${cmd.to}`);
      const next = clone(doc);
      for (const e of next.io) if (e.tag === cmd.from) e.tag = cmd.to;
      for (const s of next.sequence.steps) {
        for (const x of s.set) if (x.tag === cmd.from) x.tag = cmd.to;
        for (const x of s.wait) if (x.tag === cmd.from) x.tag = cmd.to;
      }
      return ok(next, []);
    }
    case 'attach':
    case 'detach': {
      const tool = findNode(doc, cmd.tool);
      if (!tool) return fail(doc, `툴 노드 없음: ${cmd.tool}`);
      if (cmd.cmd === 'attach' && !findNode(doc, cmd.work))
        return fail(doc, `워크 노드 없음: ${cmd.work}`);
      const next = clone(doc);
      const t = findNode(next, cmd.tool)!;
      if (cmd.cmd === 'attach') t.components['attached'] = { work: cmd.work };
      else delete t.components['attached'];
      return ok(next, [cmd.tool]);
    }
    case 'set_sequence': {
      const next = clone(doc);
      next.sequence.steps = cmd.steps;
      return ok(next, []);
    }
    case 'set_fidelity': {
      const next = clone(doc);
      next.meta.fidelity = cmd.fidelity;
      return ok(next, [doc.meta.id]);
    }
    case 'make_card':
      return makeCard(doc, ctx);
    case 'set_reference':
    case 'load_glb':
    case 'load_urdf':
    case 'import_io':
      return fail(doc, `${cmd.cmd}: 이 묶음에서는 아직 구현하지 않음 (에셋 저장소가 필요)`);
    case 'measure':
    case 'check_collision':
      return ok(doc, 'ids' in cmd && cmd.ids ? cmd.ids : []);
    case 'select':
    case 'undo':
    case 'redo':
    case 'save':
    case 'export':
    case 'force_tag':
    case 'run_demo':
    case 'stop':
      return fail(doc, `${cmd.cmd}: 세션 명령은 MachineEditor 가 처리`);
    default:
      return fail(doc, `${cmd.cmd}: 설비 범위에서 쓸 수 없는 명령`);
  }
}

export type { Socket };
