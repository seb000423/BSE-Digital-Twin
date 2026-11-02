/**
 * 블록 지오메트리 (지침서 4.3절, 6.4절): 블록은 "형식 + 파라미터 + 치수 테이블"이고, 모양은 파라미터에서 계산한다.
 * 여기서는 렌더러와 무관한 **기본 도형 목록**만 만든다 (mm, Z-up, 설비 원점 = 바닥면 중심).
 * three.js 변환(mm → m, Z-up → Y-up)은 apps/web 쪽 책임이다.
 */

/** 면 밝기 단계: 0 바탕(paper) · 1 중간 · 2 밝음. 디자인 가이드 9.4절 "옅게 채운 면 3단계" */
export type Tone = 0 | 1 | 2;

export interface BoxPrim {
  kind: 'box';
  /** [w(x), d(y), h(z)] mm */
  size: [number, number, number];
  /** 중심 위치 (블록 원점 기준, mm) */
  position: [number, number, number];
  /** 오일러 각 [rx, ry, rz] deg */
  rotation?: [number, number, number];
  tone: Tone;
  /** 움직이는 부품이면 관절 이름 (관절이 이 도형을 움직인다) */
  part?: string;
}

export interface CylinderPrim {
  kind: 'cylinder';
  /** [반지름, 반지름, 높이] mm. 축은 기본 Z, rotation 으로 눕힌다 */
  size: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
  tone: Tone;
  part?: string;
}

export type Primitive = BoxPrim | CylinderPrim;

export const box = (
  size: [number, number, number],
  position: [number, number, number],
  tone: Tone = 0,
  extra: { rotation?: [number, number, number]; part?: string } = {},
): BoxPrim => ({ kind: 'box', size, position, tone, ...extra });

export const cyl = (
  r: number,
  h: number,
  position: [number, number, number],
  tone: Tone = 0,
  extra: { rotation?: [number, number, number]; part?: string } = {},
): CylinderPrim => ({ kind: 'cylinder', size: [r, r, h], position, tone, ...extra });

/** 바닥(z=0)에 놓인 상자: 중심 높이를 h/2 로 */
export const boxOnFloor = (
  w: number,
  d: number,
  h: number,
  x = 0,
  y = 0,
  z = 0,
  tone: Tone = 0,
  extra: { part?: string } = {},
): BoxPrim => box([w, d, h], [x, y, z + h / 2], tone, extra);

/** 네 다리 (테이블·컨베이어 프레임 공용) */
export function legs(w: number, d: number, h: number, leg = 40, inset = 60, z = 0): Primitive[] {
  const out: Primitive[] = [];
  const hx = w / 2 - inset;
  const hy = d / 2 - inset;
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) out.push(boxOnFloor(leg, leg, h, sx * hx, sy * hy, z, 0));
  return out;
}

/** 도형 목록의 외곽 상자 [W, D, H] (회전은 무시, 가이드 박스 비교용) */
export function extents(prims: Primitive[]): [number, number, number] {
  let maxX = 0;
  let maxY = 0;
  let maxZ = 0;
  for (const p of prims) {
    const [sx, sy, sz] = p.kind === 'box' ? p.size : [p.size[0] * 2, p.size[1] * 2, p.size[2]];
    maxX = Math.max(maxX, Math.abs(p.position[0]) + sx / 2);
    maxY = Math.max(maxY, Math.abs(p.position[1]) + sy / 2);
    maxZ = Math.max(maxZ, p.position[2] + sz / 2);
  }
  return [maxX * 2, maxY * 2, maxZ];
}
