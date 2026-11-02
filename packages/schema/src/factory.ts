/** factory.json (지침서 4.2절). 스키마 식별자 `bse-twin/factory@1` */
import { z } from 'zod';
import { MachineRef, Uuid } from './ids.js';
import { TagPrefix } from './tags.js';
import { FactorySpec } from './spec.js';
import { MachineCard } from './machine.js';
import { mm, TransformDefault, Vec3mm } from './units.js';

export const FACTORY_SCHEMA_ID = 'bse-twin/factory@1' as const;

const Point2 = z.tuple([mm, mm]);
const Polyline = z.array(Point2).min(2);
const Polygon = z.array(Point2).min(3);

export const Level = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  elevation: mm.default(0),
});

export const Reference = z
  .object({
    kind: z.enum(['dxf', 'image']),
    asset: z.string().min(1),
    scale: z.number().positive().default(1).describe('도면 단위 → mm'),
    origin: Point2.default([0, 0]),
  })
  .nullable()
  .default(null);

export const Slab = z.object({
  id: Uuid,
  level: z.string(),
  polygon: Polygon,
  thickness: mm.default(150),
});
export const Wall = z.object({
  id: Uuid,
  level: z.string(),
  polyline: Polyline,
  height: mm,
  thickness: mm.default(200),
});
export const Column = z.object({
  id: Uuid,
  level: z.string(),
  position: Point2,
  size: Point2.default([500, 500]),
  height: mm,
});
export const Roof = z.object({ id: Uuid, polygon: Polygon, height: mm });
export const Opening = z.object({
  id: Uuid,
  wall: Uuid,
  kind: z.enum(['door', 'shutter', 'dock', 'emergency_exit', 'window']),
  offset: mm.describe('벽 시작점에서의 거리'),
  width: mm,
  height: mm,
});

export const Marking = z.object({
  id: Uuid,
  kind: z.enum(['aisle', 'zone', 'safety']),
  polyline: Polyline.optional(),
  polygon: Polygon.optional(),
});

export const MachineInstance = z.object({
  id: Uuid,
  ref: MachineRef,
  transform: TransformDefault,
  tagPrefix: TagPrefix,
  cardOverride: MachineCard.partial().default({}),
  fidelityOverride: z.enum(['L1', 'L2', 'L3']).nullable().default(null),
});
export type MachineInstance = z.infer<typeof MachineInstance>;

const SocketRef = z
  .string()
  .regex(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]+$/i, '`<machineInstanceId>.<socketId>` 형식');
export const Flow = z.object({
  id: Uuid,
  from: SocketRef,
  to: SocketRef,
  ratio: z.number().min(0).max(1).default(1),
});

export const Storage = z.object({
  id: Uuid,
  kind: z.enum(['rack', 'floor', 'buffer']),
  transform: TransformDefault,
  capacity: z.number().int().positive(),
});
export const Mover = z.object({
  id: Uuid,
  kind: z.enum(['worker', 'amr', 'forklift']),
  params: z.record(z.string(), z.unknown()).default({}),
  home: Vec3mm,
});
export const Nav = z
  .object({
    nodes: z.array(z.object({ id: z.string(), position: Point2 })).default([]),
    edges: z
      .array(
        z.object({ from: z.string(), to: z.string(), bidirectional: z.boolean().default(true) }),
      )
      .default([]),
    docks: z.array(z.object({ id: z.string(), node: z.string(), target: Uuid })).default([]),
  })
  .prefault({});
export const Utilities = z
  .object({
    drops: z
      .array(z.object({ id: Uuid, kind: z.enum(['power', 'air']), position: Vec3mm }))
      .default([]),
    panels: z.array(z.object({ id: Uuid, position: Vec3mm })).default([]),
    supply: z.array(z.object({ id: Uuid, kind: z.string(), position: Vec3mm })).default([]),
  })
  .prefault({});

export const FactoryExt = z.object({
  aas: z.record(z.string(), z.unknown()).nullable().default(null),
  usd: z.record(z.string(), z.unknown()).nullable().default(null),
});

export const Factory = z
  .object({
    schema: z.literal(FACTORY_SCHEMA_ID),
    meta: z.object({
      id: Uuid,
      name: z.string().min(1),
      site: z.string().default(''),
      levels: z.array(Level).default([]),
    }),
    reference: Reference,
    building: z
      .object({
        slabs: z.array(Slab).default([]),
        walls: z.array(Wall).default([]),
        columns: z.array(Column).default([]),
        roofs: z.array(Roof).default([]),
        openings: z.array(Opening).default([]),
      })
      .prefault({}),
    markings: z.array(Marking).default([]),
    machines: z.array(MachineInstance).default([]),
    flows: z.array(Flow).default([]),
    storage: z.array(Storage).default([]),
    movers: z.array(Mover).default([]),
    nav: Nav,
    utilities: Utilities,
    spec: FactorySpec.prefault({}),
    ext: FactoryExt.prefault({}),
  })
  .superRefine((f, ctx) => {
    const prefixes = new Set<string>();
    for (const m of f.machines) {
      if (prefixes.has(m.tagPrefix))
        ctx.addIssue({
          code: 'custom',
          message: `tagPrefix 중복: ${m.tagPrefix}`,
          path: ['machines'],
        });
      prefixes.add(m.tagPrefix);
    }
    const walls = new Set(f.building.walls.map((w) => w.id));
    for (const o of f.building.openings) {
      if (!walls.has(o.wall))
        ctx.addIssue({
          code: 'custom',
          message: `개구부의 벽 없음: ${o.wall}`,
          path: ['building', 'openings'],
        });
    }
  });
export type Factory = z.infer<typeof Factory>;
export type FactoryInput = z.input<typeof Factory>;
