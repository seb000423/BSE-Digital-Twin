import { z } from 'zod';

/** 노드·관절·설비 등 모든 개체 id: UUID v7 (시간순 정렬 가능) */
export const Uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'UUID v7 형식이어야 함',
  );
export type Uuid = z.infer<typeof Uuid>;

/** 블록 타입 id: kebab-case (예: belt-conveyor, air-cylinder) */
export const BlockTypeId = z.string().regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, 'kebab-case여야 함');
export type BlockTypeId = z.infer<typeof BlockTypeId>;

/** 의미 있는 버전 (설비 참조 machine@version 에 쓰임) */
export const SemVer = z.string().regex(/^\d+\.\d+\.\d+$/, 'x.y.z 형식');

/** 설비 참조: `<machineId>@<version>` */
export const MachineRef = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}@\d+\.\d+\.\d+$/i,
    'machineId@x.y.z 형식',
  );
export type MachineRef = z.infer<typeof MachineRef>;
