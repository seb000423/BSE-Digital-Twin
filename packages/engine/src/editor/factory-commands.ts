/**
 * 팩토리빌더 편집 명령 실행기 (지침서 7장, 원칙 4). 머신빌더의 commands.ts 와 같은 꼴:
 * 입력 문서를 바꾸지 않고 새 factory.json 문서를 돌려준다 → 실행 취소는 세션이 스냅샷으로 처리.
 * 1차(V1)는 건물 외형·내부(바닥·벽·기둥·지붕·개구부·마킹)와 설비 배치·흐름·보관·이동체·유틸리티까지.
 * 네비 자동 생성(build_nav)·시나리오는 다음 단계.
 */
import {
  Factory,
  FACTORY_SCHEMA_ID,
  type CommandResult,
  type EditCommand,
  type MachineInstance,
} from '@bse/schema';
import type { IdFactory } from './uuid.js';

export interface FactoryContext {
  newId: IdFactory;
}

export interface FactoryApplyResult {
  doc: Factory;
  result: CommandResult;
}

type P2 = [number, number];
const fail = (doc: Factory, error: string): FactoryApplyResult => ({
  doc,
  result: { ok: false, error },
});
const ok = (doc: Factory, changed: string[] = [], created: string[] = []): FactoryApplyResult => ({
  doc,
  result: { ok: true, changed, created },
});
const clone = <T>(v: T): T => structuredClone(v);

/** 빈 공장 문서 (1층 하나) */
export function newFactory(id: string, name: string, site = ''): Factory {
  return Factory.parse({
    schema: FACTORY_SCHEMA_ID,
    meta: { id, name, site, levels: [{ id: 'L1', name: '1층', elevation: 0 }] },
  });
}

/** 폴리라인 길이 (mm) */
export function polylineLength(pts: readonly P2[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++)
    L += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  return L;
}

/** 다음 설비 태그 접두어: ST01.M1, ST02.M1 … (지침서 4.4절, 비어 있는 첫 번호) */
export function nextTagPrefix(doc: Factory): string {
  const used = new Set(doc.machines.map((m) => m.tagPrefix));
  for (let i = 1; i < 1000; i++) {
    const p = `ST${String(i).padStart(2, '0')}.M1`;
    if (!used.has(p)) return p;
  }
  return `ST${doc.machines.length + 1}.M1`;
}

/** 문서 안의 선택 가능한 개체 id 전부 */
export function factoryIds(doc: Factory): Set<string> {
  const b = doc.building;
  return new Set([
    ...b.slabs.map((x) => x.id),
    ...b.walls.map((x) => x.id),
    ...b.columns.map((x) => x.id),
    ...b.roofs.map((x) => x.id),
    ...b.openings.map((x) => x.id),
    ...doc.markings.map((x) => x.id),
    ...doc.machines.map((x) => x.id),
    ...doc.flows.map((x) => x.id),
    ...doc.storage.map((x) => x.id),
    ...doc.movers.map((x) => x.id),
  ]);
}

const hasLevel = (doc: Factory, id: string) => doc.meta.levels.some((l) => l.id === id);

export function applyFactoryCommand(
  doc: Factory,
  cmd: EditCommand,
  ctx: FactoryContext,
): FactoryApplyResult {
  switch (cmd.cmd) {
    case 'add_level': {
      const next = clone(doc);
      const id = `L${next.meta.levels.length + 1}`;
      if (hasLevel(next, id)) return fail(doc, `층 id 중복: ${id}`);
      next.meta.levels.push({ id, name: cmd.name, elevation: cmd.elevation });
      return ok(next, [next.meta.id]);
    }
    case 'draw_slab': {
      if (!hasLevel(doc, cmd.level)) return fail(doc, `층 없음: ${cmd.level}`);
      const next = clone(doc);
      const id = ctx.newId();
      next.building.slabs.push({ id, level: cmd.level, polygon: cmd.polygon, thickness: 150 });
      return ok(next, [], [id]);
    }
    case 'draw_wall': {
      if (!hasLevel(doc, cmd.level)) return fail(doc, `층 없음: ${cmd.level}`);
      const next = clone(doc);
      const id = ctx.newId();
      next.building.walls.push({
        id,
        level: cmd.level,
        polyline: cmd.polyline,
        height: cmd.height,
        thickness: cmd.thickness,
      });
      return ok(next, [], [id]);
    }
    case 'place_columns': {
      if (!hasLevel(doc, cmd.level)) return fail(doc, `층 없음: ${cmd.level}`);
      if (cmd.count[0] < 1 || cmd.count[1] < 1) return fail(doc, '기둥 개수는 1 이상');
      const next = clone(doc);
      const created: string[] = [];
      for (let i = 0; i < cmd.count[0]; i++)
        for (let j = 0; j < cmd.count[1]; j++) {
          const id = ctx.newId();
          next.building.columns.push({
            id,
            level: cmd.level,
            position: [cmd.origin[0] + i * cmd.pitch[0], cmd.origin[1] + j * cmd.pitch[1]],
            size: [500, 500],
            height: cmd.height,
          });
          created.push(id);
        }
      return ok(next, [], created);
    }
    case 'draw_roof': {
      const next = clone(doc);
      const id = ctx.newId();
      next.building.roofs.push({ id, polygon: cmd.polygon, height: cmd.height });
      return ok(next, [], [id]);
    }
    case 'add_opening': {
      const wall = doc.building.walls.find((w) => w.id === cmd.wall);
      if (!wall) return fail(doc, `벽 없음: ${cmd.wall}`);
      const L = polylineLength(wall.polyline);
      if (cmd.offset < 0 || cmd.offset + cmd.width > L)
        return fail(doc, `개구부가 벽 길이(${Math.round(L)} mm)를 벗어남`);
      if (cmd.height > wall.height) return fail(doc, '개구부 높이가 벽보다 큼');
      const next = clone(doc);
      const id = ctx.newId();
      next.building.openings.push({
        id,
        wall: cmd.wall,
        kind: cmd.kind,
        offset: cmd.offset,
        width: cmd.width,
        height: cmd.height,
      });
      return ok(next, [cmd.wall], [id]);
    }
    case 'draw_marking': {
      const next = clone(doc);
      const id = ctx.newId();
      if (cmd.kind === 'zone') {
        if (cmd.points.length < 3) return fail(doc, '구역(zone)은 점 3개 이상');
        next.markings.push({ id, kind: 'zone', polygon: cmd.points });
      } else next.markings.push({ id, kind: cmd.kind, polyline: cmd.points });
      return ok(next, [], [id]);
    }
    case 'place_machine': {
      const next = clone(doc);
      const tagPrefix = cmd.tagPrefix ?? nextTagPrefix(next);
      if (next.machines.some((m) => m.tagPrefix === tagPrefix))
        return fail(doc, `tagPrefix 중복: ${tagPrefix}`);
      const id = ctx.newId();
      const inst: MachineInstance = {
        id,
        ref: cmd.ref,
        transform: {
          position: cmd.transform.position ?? [0, 0, 0],
          rotation: cmd.transform.rotation ?? [0, 0, 0],
        },
        tagPrefix,
        cardOverride: {},
        fidelityOverride: null,
      };
      next.machines.push(inst);
      return ok(next, [], [id]);
    }
    case 'set_card_override': {
      const i = doc.machines.findIndex((m) => m.id === cmd.id);
      if (i < 0) return fail(doc, `설비 인스턴스 없음: ${cmd.id}`);
      const next = clone(doc);
      next.machines[i]!.cardOverride = { ...next.machines[i]!.cardOverride, ...cmd.patch };
      return ok(next, [cmd.id]);
    }
    case 'connect_flow': {
      const inst = (ref: string) => doc.machines.find((m) => ref.startsWith(m.id + '.'));
      const a = inst(cmd.from);
      const b = inst(cmd.to);
      if (!a) return fail(doc, `출발 소켓의 설비 없음: ${cmd.from}`);
      if (!b) return fail(doc, `도착 소켓의 설비 없음: ${cmd.to}`);
      if (a.id === b.id) return fail(doc, '같은 설비끼리는 흐름을 잇지 않음');
      if (doc.flows.some((f) => f.from === cmd.from && f.to === cmd.to))
        return fail(doc, '이미 이어진 흐름');
      const next = clone(doc);
      const id = ctx.newId();
      next.flows.push({ id, from: cmd.from, to: cmd.to, ratio: cmd.ratio });
      return ok(next, [a.id, b.id], [id]);
    }
    case 'add_storage': {
      const next = clone(doc);
      const id = ctx.newId();
      next.storage.push({
        id,
        kind: cmd.kind,
        transform: {
          position: cmd.transform.position ?? [0, 0, 0],
          rotation: cmd.transform.rotation ?? [0, 0, 0],
        },
        capacity: cmd.capacity,
      });
      return ok(next, [], [id]);
    }
    case 'add_mover': {
      const next = clone(doc);
      const id = ctx.newId();
      next.movers.push({ id, kind: cmd.kind, params: cmd.params, home: cmd.home });
      return ok(next, [], [id]);
    }
    case 'add_drop': {
      const next = clone(doc);
      const id = ctx.newId();
      next.utilities.drops.push({ id, kind: cmd.kind, position: cmd.position });
      return ok(next, [], [id]);
    }
    case 'move': {
      const next = clone(doc);
      const target =
        next.machines.find((m) => m.id === cmd.id) ?? next.storage.find((s) => s.id === cmd.id);
      if (target) {
        if (cmd.transform.position) target.transform.position = cmd.transform.position;
        if (cmd.transform.rotation) target.transform.rotation = cmd.transform.rotation;
        return ok(next, [cmd.id]);
      }
      const col = next.building.columns.find((c) => c.id === cmd.id);
      if (col && cmd.transform.position) {
        col.position = [cmd.transform.position[0], cmd.transform.position[1]];
        return ok(next, [cmd.id]);
      }
      const mv = next.movers.find((m) => m.id === cmd.id);
      if (mv && cmd.transform.position) {
        mv.home = cmd.transform.position;
        return ok(next, [cmd.id]);
      }
      return fail(doc, `옮길 수 있는 개체 없음: ${cmd.id}`);
    }
    case 'remove': {
      const ids = new Set(cmd.ids);
      const known = factoryIds(doc);
      const missing = cmd.ids.filter((id) => !known.has(id));
      if (missing.length) return fail(doc, `개체 없음: ${missing.join(', ')}`);
      const next = clone(doc);
      const b = next.building;
      b.walls = b.walls.filter((w) => !ids.has(w.id));
      const walls = new Set(b.walls.map((w) => w.id));
      b.openings = b.openings.filter((o) => !ids.has(o.id) && walls.has(o.wall));
      b.slabs = b.slabs.filter((x) => !ids.has(x.id));
      b.columns = b.columns.filter((x) => !ids.has(x.id));
      b.roofs = b.roofs.filter((x) => !ids.has(x.id));
      next.markings = next.markings.filter((x) => !ids.has(x.id));
      next.machines = next.machines.filter((x) => !ids.has(x.id));
      const inst = new Set(next.machines.map((m) => m.id));
      next.flows = next.flows.filter(
        (f) =>
          !ids.has(f.id) &&
          inst.has(f.from.split('.')[0] ?? '') &&
          inst.has(f.to.split('.')[0] ?? ''),
      );
      next.storage = next.storage.filter((x) => !ids.has(x.id));
      next.movers = next.movers.filter((x) => !ids.has(x.id));
      return ok(next, cmd.ids);
    }
    case 'build_nav':
    case 'duplicate':
    case 'mirror':
    case 'array':
    case 'snap':
    case 'group':
    case 'ungroup':
    case 'rename':
    case 'set_reference':
    case 'measure':
    case 'check_collision':
    case 'create_scenario':
    case 'run_scenario':
    case 'compare':
    case 'replay':
    case 'optimize':
      return fail(doc, `${cmd.cmd}: 공장 범위에서 아직 구현하지 않음 (다음 단계)`);
    case 'select':
    case 'undo':
    case 'redo':
    case 'save':
    case 'export':
      return fail(doc, `${cmd.cmd}: 세션 명령은 FactoryEditor 가 처리`);
    default:
      return fail(doc, `${cmd.cmd}: 공장 범위에서 쓸 수 없는 명령`);
  }
}
