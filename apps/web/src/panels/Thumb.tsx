/** 설비 문서의 위에서 본 그림 (SVG): 홈 카드 미리보기. 상자는 사각형, 원기둥은 원. 회전은 Z 축만 반영 */
import { useMemo } from 'react';
import type { Machine } from '@bse/schema';
import { lib } from '../store.js';

interface Shape {
  kind: 'rect' | 'circle';
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  tone: number;
}

export function Thumb({ doc, className }: { doc: Machine; className?: string }) {
  const shapes = useMemo(() => {
    const out: Shape[] = [];
    const walk = (parent: string | null, ox: number, oy: number, orot: number) => {
      for (const n of doc.nodes.filter((x) => x.parent === parent)) {
        const rz = ((n.transform.rotation[2] + orot) * Math.PI) / 180;
        const [px, py] = n.transform.position;
        const nx = ox + px * Math.cos(rz) - py * Math.sin(rz);
        const ny = oy + px * Math.sin(rz) + py * Math.cos(rz);
        if (n.blockType) {
          let prims: ReturnType<typeof lib.geometry> = [];
          try {
            prims = lib.geometry(
              n.blockType,
              n.params as Record<string, number | string | boolean>,
            );
          } catch {
            prims = [];
          }
          for (const p of prims) {
            const cx = nx + p.position[0] * Math.cos(rz) - p.position[1] * Math.sin(rz);
            const cy = ny + p.position[0] * Math.sin(rz) + p.position[1] * Math.cos(rz);
            if (p.kind === 'box') {
              const swap = Math.abs(Math.round(rz / (Math.PI / 2))) % 2 === 1;
              out.push({
                kind: 'rect',
                x: cx,
                y: cy,
                w: swap ? p.size[1] : p.size[0],
                h: swap ? p.size[0] : p.size[1],
                r: 0,
                tone: p.tone,
              });
            } else
              out.push({ kind: 'circle', x: cx, y: cy, w: 0, h: 0, r: p.size[0], tone: p.tone });
          }
        }
        walk(n.id, nx, ny, orot + n.transform.rotation[2]);
      }
    };
    walk(null, 0, 0, 0);
    return out;
  }, [doc]);
  const [W, D] = doc.meta.bbox;
  const pad = Math.max(W, D) * 0.08;
  // SVG 는 y 가 아래로 자라므로 문서 Y(좌측) 를 뒤집는다
  return (
    <svg
      className={className}
      viewBox={`${-W / 2 - pad} ${-D / 2 - pad} ${W + pad * 2} ${D + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <rect
        x={-W / 2}
        y={-D / 2}
        width={W}
        height={D}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.35}
        strokeDasharray={`${W / 40} ${W / 60}`}
        vectorEffect="non-scaling-stroke"
      />
      {shapes.map((s, i) =>
        s.kind === 'rect' ? (
          <rect
            key={i}
            x={s.x - s.w / 2}
            y={-s.y - s.h / 2}
            width={s.w}
            height={s.h}
            fill="currentColor"
            fillOpacity={0.06 + s.tone * 0.05}
            stroke="currentColor"
            strokeOpacity={0.9}
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <circle
            key={i}
            cx={s.x}
            cy={-s.y}
            r={s.r}
            fill="currentColor"
            fillOpacity={0.06 + s.tone * 0.05}
            stroke="currentColor"
            strokeOpacity={0.9}
            vectorEffect="non-scaling-stroke"
          />
        ),
      )}
    </svg>
  );
}
