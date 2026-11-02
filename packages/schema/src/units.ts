/**
 * 좌표·단위 규약 (지침서 5장).
 * 저장·UI는 mm / deg, Three.js·USD·URDF는 m / rad. 오른손 좌표계, Z-up, X 전방(투입→배출), Y 좌측.
 */
import { z } from 'zod';

export const mm = z.number().finite().describe('길이 (mm)');
export const deg = z.number().finite().describe('각도 (deg)');
export const mmPerSec = z.number().finite().nonnegative().describe('속도 (mm/s)');

/** [x, y, z] mm */
export const Vec3mm = z.tuple([mm, mm, mm]);
/** 단위 벡터 (회전·직동 관절의 축) */
export const UnitVec3 = z
  .tuple([z.number(), z.number(), z.number()])
  .refine((v) => Math.abs(Math.hypot(v[0], v[1], v[2]) - 1) < 1e-6, '단위 벡터여야 함 (길이 1)');
/** 오일러 각 [rx, ry, rz] deg, 오른손 법칙 */
export const Euler3deg = z.tuple([deg, deg, deg]);

/** 노드 변환: 부모 기준 위치(mm)·회전(deg). 배율(scale)은 없다 — 크기는 블록 파라미터로만 바꾼다 (원칙 5) */
export const Transform = z
  .object({
    position: Vec3mm.default([0, 0, 0]),
    rotation: Euler3deg.default([0, 0, 0]),
  })
  .describe('부모 기준 변환. 설비 원점 = 바닥면 중심, 공장 원점 = 평면도 원점');
export type Transform = z.infer<typeof Transform>;
/** 생략하면 원점·무회전 (zod 4: prefault 라야 안쪽 기본값까지 채워짐) */
export const TransformDefault = Transform.prefault({});

export const MM_PER_M = 1000;
export const mmToM = (v: number): number => v / MM_PER_M;
export const mToMm = (v: number): number => v * MM_PER_M;
export const degToRad = (v: number): number => (v * Math.PI) / 180;
export const radToDeg = (v: number): number => (v * 180) / Math.PI;

/** 시뮬 신호 틱 (ms) · 렌더 fps (지침서 5장) */
export const SIGNAL_TICK_MS = 10;
export const RENDER_FPS = 60;
