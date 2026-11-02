/**
 * 노드 (지침서 4장): 모든 것은 노드 트리. `{id, type, name, transform, parent, children[], components{}}`
 * machine.json 의 nodes[] 는 부모 참조(parent)로 트리를 표현하고, children 은 로드 시 계산한다.
 */
import { z } from 'zod';
import { BlockTypeId, Uuid } from './ids.js';
import { TransformDefault, UnitVec3, Vec3mm } from './units.js';

export const Fidelity = z.enum(['L1', 'L2', 'L3']).describe('L1 카드 | L2 기구·신호 | L3 물리');
export type Fidelity = z.infer<typeof Fidelity>;

export const SocketKind = z.enum(['mount', 'inlet', 'outlet', 'surface', 'tool']);
export const Socket = z.object({
  id: z.string().min(1),
  kind: SocketKind,
  position: Vec3mm,
  normal: UnitVec3,
  compatible: z.array(SocketKind).default([]),
});
export type Socket = z.infer<typeof Socket>;

export const NodeType = z.enum(['block', 'glb', 'group']);

export const MachineNode = z.object({
  id: Uuid,
  type: NodeType,
  name: z.string().min(1),
  blockType: BlockTypeId.nullable().default(null).describe('type=block 일 때 블록 타입 id'),
  params: z
    .record(z.string(), z.unknown())
    .default({})
    .describe('블록 파라미터 (블록 정의의 params 스키마로 검증)'),
  glb: z.string().nullable().default(null).describe('type=glb 일 때 에셋 참조'),
  transform: TransformDefault,
  parent: Uuid.nullable().default(null),
  sockets: z.array(Socket).default([]),
  components: z.record(z.string(), z.unknown()).default({}),
});
export type MachineNode = z.infer<typeof MachineNode>;
