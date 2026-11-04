/**
 * 공장 3D 뷰포트: 건물(바닥·벽·기둥·지붕·개구부) + 설비 인스턴스(설비 문서를 그대로 그림) + 흐름 선.
 * 좌표 변환·배색·블록 그리기는 설비 뷰포트(Viewport.tsx)의 것을 그대로 쓴다.
 * 두 쓰임: mode='edit' (팩토리 빌더: 설비 끌어 옮기기 100 mm, 벽·기둥·문 클릭 선택) /
 *          mode='sim'  (Simulate 관제: 공장 런타임의 설비들이 움직이고, 클릭은 관제 선택만).
 * 보기: 'solid' 면 · 'lines' X-ray · 'lit' 실사풍(Simulate).
 */
import { useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, Html, Line, OrbitControls, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { Factory, MachineInstance } from '@bse/schema';
import { SIGNAL_TICK_MS } from '@bse/engine';
import { CameraRig, LINE, LookCtx, MM, NodeTree, TONES, deg, type Look } from './Viewport.js';
import { LIT, LitBloom, LitFloor, LitLights, LitRenderer } from './lit.js';
import { SceneCtx, type SceneCtxValue } from './scene-ctx.js';
import { floorSize, machineOf, useFactory } from '../store-factory.js';
import { useSim } from '../store-sim.js';

const SNAP = 100;
const ACCENT = '#f2a93b';
const SEL = '#ffffff';
type P2 = [number, number];
type Mode = 'edit' | 'sim';
const ModeRef = { current: 'edit' as Mode };

let root: THREE.Group | null = null;
interface Drag {
  id: string;
  g: THREE.Group;
  hit0: THREE.Vector3;
  start: [number, number, number];
  moved: boolean;
  controls: { enabled: boolean } | null;
}
let drag: Drag | null = null;
const FLOOR = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function dragTo(e: ThreeEvent<PointerEvent>): [number, number, number] | null {
  if (!drag || !root) return null;
  const hit = new THREE.Vector3();
  if (!e.ray.intersectPlane(FLOOR, hit)) return null;
  const a = root.worldToLocal(drag.hit0.clone());
  const b = root.worldToLocal(hit);
  const snap = (v: number) => Math.round(v / SNAP) * SNAP;
  const pos: [number, number, number] = [
    snap(drag.start[0] + (b.x - a.x)),
    snap(drag.start[1] + (b.y - a.y)),
    drag.start[2],
  ];
  if (pos[0] !== drag.start[0] || pos[1] !== drag.start[1]) drag.moved = true;
  drag.g.position.set(pos[0], pos[1], pos[2]);
  return pos;
}
function endDrag(e: ThreeEvent<PointerEvent>): void {
  if (!drag) return;
  const pos = dragTo(e);
  const { id, moved, controls } = drag;
  drag = null;
  if (controls) controls.enabled = true;
  const t = e.target as Element;
  if (t.hasPointerCapture(e.pointerId)) t.releasePointerCapture(e.pointerId);
  if (pos && moved)
    useFactory.getState().dispatch({ cmd: 'move', id, transform: { position: pos } });
}

export function FactoryViewport({ look = 'solid', mode = 'edit' }: { look?: Look; mode?: Mode }) {
  const doc = useFactory((s) => s.doc);
  const roof = useFactory((s) => s.roof);
  const [w, d] = floorSize(doc);
  const size = Math.max(w, d) * MM;
  const lit = look === 'lit';
  ModeRef.current = mode;
  const missed = () =>
    mode === 'sim'
      ? useSim.getState().select(null)
      : useFactory.getState().dispatch({ cmd: 'select', ids: [] });
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: !lit, powerPreference: 'high-performance' }}
      shadows={lit}
      onPointerMissed={missed}
      style={{
        background: lit
          ? LIT.bg
          : 'radial-gradient(ellipse 60% 55% at 50% 60%, rgb(53 51 44 / 90%), transparent)',
      }}
    >
      <OrthographicCamera
        makeDefault
        position={lit ? [size * 1.5, size * 1.5, size * 1.5] : [size * 1.6, size * 1.3, size * 1.6]}
        near={0.1}
        far={size * 8}
      />
      <OrbitControls makeDefault maxPolarAngle={Math.PI * 0.44} target={[0, 0, 0]} />
      <CameraRig size={size} fit={0.95} />
      {lit ? (
        <>
          <LitRenderer />
          <LitLights size={size} />
          <LitFloor size={size} />
          <LitBloom />
        </>
      ) : (
        <>
          <ambientLight intensity={0.6} />
          <directionalLight position={[-6, 10, 4]} intensity={0.9} />
          <directionalLight position={[8, 4, -8]} intensity={0.35} color="#e8d9bb" />
          <gridHelper
            args={[size * 2.5, Math.round(size * 2.5), LINE, LINE]}
            position={[0, -0.02, 0]}
          >
            <lineBasicMaterial attach="material" color={LINE} transparent opacity={0.16} />
          </gridHelper>
        </>
      )}
      <LookCtx.Provider value={look}>
        <group rotation={[-Math.PI / 2, 0, 0]} scale={MM} ref={(g) => void (root = g)}>
          <Building doc={doc} roof={roof} />
          {doc.machines.map((m) => (
            <MachineInst key={m.id} inst={m} mode={mode} />
          ))}
          <Flows doc={doc} />
          {mode === 'sim' && <SimRunner />}
        </group>
      </LookCtx.Provider>
    </Canvas>
  );
}

/** Simulate: 렌더 프레임마다 지나간 시간만큼 공장 런타임을 10 ms 틱으로 돌린다 (배속 반영) */
function SimRunner() {
  const acc = useRef(0);
  useFrame((_, dt) => {
    const fr = useSim.getState().fr;
    if (!fr) return;
    acc.current += Math.min(dt, 0.1) * 1000 * fr.speed;
    const ticks = Math.floor(acc.current / SIGNAL_TICK_MS);
    if (ticks > 0) {
      fr.step(ticks);
      acc.current -= ticks * SIGNAL_TICK_MS;
    }
  });
  return null;
}

/** 건물 부품 상자 하나: 면 보기면 채우고, X-ray 면 면을 비워 선만 남긴다. 클릭 = 선택 (편집 모드) */
function Part({
  id,
  size,
  position,
  rotationZ = 0,
  tone = 0,
  opacity = 1,
  children,
}: {
  id: string;
  size: [number, number, number];
  position: [number, number, number];
  rotationZ?: number;
  tone?: 0 | 1 | 2;
  opacity?: number;
  children?: ReactNode;
}) {
  const look = useContext(LookCtx);
  const xray = look === 'lines';
  const lit = look === 'lit';
  const selected = useFactory((s) => ModeRef.current === 'edit' && s.selection.includes(id));
  // 실사풍(관제)에선 벽을 반투명으로 낮춰 안이 보이게
  const alpha = lit ? Math.min(opacity, 0.5) : opacity;
  return (
    <mesh
      position={position}
      rotation={[0, 0, rotationZ]}
      castShadow={lit}
      receiveShadow={lit}
      onPointerDown={(e) => {
        if (e.button !== 0 || ModeRef.current !== 'edit') return;
        e.stopPropagation();
        useFactory.getState().dispatch({ cmd: 'select', ids: [id] });
      }}
    >
      <boxGeometry args={size} />
      {xray ? (
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      ) : lit ? (
        <meshStandardMaterial
          color={LIT.tones[tone]}
          metalness={0.2}
          roughness={0.7}
          transparent={alpha < 1}
          opacity={alpha}
        />
      ) : (
        <meshLambertMaterial color={TONES[tone]} transparent={alpha < 1} opacity={alpha} />
      )}
      {(!lit || selected) && (
        <Edges
          color={selected ? SEL : LINE}
          threshold={15}
          transparent
          opacity={xray ? ([0.35, 0.6, 0.9][tone] ?? 1) : selected ? 1 : 0.8}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-2}
        />
      )}
      {children}
    </mesh>
  );
}

/** 바닥·벽(개구부는 비워서)·기둥·지붕 */
function Building({ doc, roof }: { doc: Factory; roof: boolean }) {
  const look = useContext(LookCtx);
  const xray = look === 'lines';
  const lit = look === 'lit';
  const b = doc.building;
  const slabs = useMemo(
    () =>
      b.slabs.map((s) => {
        const shape = new THREE.Shape(s.polygon.map((p) => new THREE.Vector2(p[0], p[1])));
        return {
          s,
          geo: new THREE.ExtrudeGeometry(shape, { depth: s.thickness, bevelEnabled: false }),
        };
      }),
    [b.slabs],
  );
  const roofs = useMemo(
    () =>
      b.roofs.map((r) => {
        const shape = new THREE.Shape(r.polygon.map((p) => new THREE.Vector2(p[0], p[1])));
        return { r, geo: new THREE.ExtrudeGeometry(shape, { depth: 250, bevelEnabled: false }) };
      }),
    [b.roofs],
  );
  return (
    <>
      {!lit &&
        slabs.map(({ s, geo }) => (
          <mesh
            key={s.id}
            geometry={geo}
            position={[0, 0, -s.thickness]}
            onPointerDown={(e) => {
              if (e.button !== 0 || ModeRef.current !== 'edit') return;
              e.stopPropagation();
              useFactory.getState().dispatch({ cmd: 'select', ids: [s.id] });
            }}
          >
            {xray ? (
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            ) : (
              <meshLambertMaterial color="#232220" />
            )}
            <Edges color={LINE} transparent opacity={0.7} />
          </mesh>
        ))}
      {b.walls.map((w) => (
        <WallView key={w.id} wall={w} openings={b.openings.filter((o) => o.wall === w.id)} />
      ))}
      {b.columns.map((c) => (
        <Part
          key={c.id}
          id={c.id}
          size={[c.size[0], c.size[1], c.height]}
          position={[c.position[0], c.position[1], c.height / 2]}
          tone={1}
        />
      ))}
      {roof &&
        roofs.map(({ r, geo }) => (
          <mesh key={r.id} geometry={geo} position={[0, 0, r.height]}>
            {xray ? (
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            ) : (
              // 지붕은 밝은 베이지 반투명: 얹었는지 한눈에 보이게
              <meshLambertMaterial
                color={lit ? LIT.tones[2] : '#8e877a'}
                transparent
                opacity={0.6}
              />
            )}
            <Edges color={LINE} transparent opacity={0.9} />
          </mesh>
        ))}
    </>
  );
}

/** 벽 폴리라인을 변마다 상자로. 개구부가 있는 변은 좌·우·위(인방) 세 조각으로 나눠 구멍을 낸다 */
function WallView({
  wall,
  openings,
}: {
  wall: Factory['building']['walls'][number];
  openings: Factory['building']['openings'];
}) {
  const pieces = useMemo(() => {
    const out: {
      key: string;
      size: [number, number, number];
      pos: [number, number, number];
      rot: number;
      tone: 0 | 1 | 2;
      opacity: number;
      /** 문짝 조각이면 그 개구부 id (선택용), 아니면 벽 id */
      id: string;
    }[] = [];
    let acc = 0;
    const pts = wall.polyline;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const c = pts[i]!;
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const rot = Math.atan2(c[1] - a[1], c[0] - a[0]);
      const ux = (c[0] - a[0]) / len;
      const uy = (c[1] - a[1]) / len;
      const at = (t: number, z: number): [number, number, number] => [
        a[0] + ux * t,
        a[1] + uy * t,
        z,
      ];
      const ops = openings
        .filter((o) => o.offset >= acc && o.offset + o.width <= acc + len)
        .map((o) => ({ ...o, s: o.offset - acc }))
        .sort((p, q) => p.s - q.s);
      let cur = 0;
      for (const o of ops) {
        if (o.s > cur)
          out.push({
            key: `${i}-${cur}`,
            size: [o.s - cur, wall.thickness, wall.height],
            pos: at((cur + o.s) / 2, wall.height / 2),
            rot,
            tone: 0,
            opacity: 1,
            id: wall.id,
          });
        if (wall.height > o.height)
          out.push({
            key: `${i}-h-${o.id}`,
            size: [o.width, wall.thickness, wall.height - o.height],
            pos: at(o.s + o.width / 2, o.height + (wall.height - o.height) / 2),
            rot,
            tone: 0,
            opacity: 1,
            id: wall.id,
          });
        out.push({
          key: `${i}-o-${o.id}`,
          size: [o.width, Math.max(40, wall.thickness * 0.25), o.height],
          pos: at(o.s + o.width / 2, o.height / 2),
          rot,
          tone: 2,
          opacity: o.kind === 'window' ? 0.25 : 0.45,
          id: o.id,
        });
        cur = o.s + o.width;
      }
      if (cur < len)
        out.push({
          key: `${i}-${cur}-end`,
          size: [len - cur, wall.thickness, wall.height],
          pos: at((cur + len) / 2, wall.height / 2),
          rot,
          tone: 0,
          opacity: 1,
          id: wall.id,
        });
      acc += len;
    }
    return out;
  }, [wall, openings]);
  return (
    <>
      {pieces.map((p) => (
        <Part
          key={p.key}
          id={p.id}
          size={p.size}
          position={p.pos}
          rotationZ={p.rot}
          tone={p.tone}
          opacity={p.opacity}
        />
      ))}
    </>
  );
}

/** 설비 인스턴스: 설비 문서를 그 자리에 그린다. 설비가 없으면(다른 설비를 열어서) 점선 상자 */
function MachineInst({ inst, mode }: { inst: MachineInstance; mode: Mode }) {
  const selEdit = useFactory((s) => s.selection.includes(inst.id));
  const selSim = useSim((s) => s.selected === inst.id);
  const selected = mode === 'sim' ? selSim : selEdit;
  const entry = machineOf(inst.ref);
  const g = useRef<THREE.Group>(null);
  const { controls } = useThree();
  const look = useContext(LookCtx);
  const lit = look === 'lit';
  const pick = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (mode === 'sim') {
        useSim.getState().select(inst.id);
        return;
      }
      useFactory.getState().dispatch({ cmd: 'select', ids: [inst.id] });
      if (!g.current) return;
      const hit0 = new THREE.Vector3();
      if (!e.ray.intersectPlane(FLOOR, hit0)) return;
      // 끄는 동안 화면 회전(OrbitControls)을 끈다 — 설비와 화면이 같이 움직이지 않게
      const ctl = controls as { enabled: boolean } | null;
      if (ctl) ctl.enabled = false;
      drag = {
        id: inst.id,
        g: g.current,
        hit0,
        start: inst.transform.position,
        moved: false,
        controls: ctl,
      };
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [inst, mode, controls],
  );
  const scene = useMemo<SceneCtxValue>(
    () => ({
      runtime: () => useSim.getState().fr?.runtimeOf(inst.id) ?? null,
      pick,
      dragMove: (e) => {
        if (drag?.id === inst.id) dragTo(e);
      },
      dragUp: (e) => {
        if (drag?.id === inst.id) endDrag(e);
      },
      labels: false,
      effects: mode === 'sim',
    }),
    [inst.id, pick, mode],
  );
  const r = inst.transform.rotation;
  const fp = entry?.doc.card.footprint ?? [2000, 2000];
  const h = entry?.doc.meta.bbox[2] ?? 1500;
  const footprint = useMemo(
    () => new THREE.EdgesGeometry(new THREE.PlaneGeometry(fp[0] + 200, fp[1] + 200)),
    [fp[0], fp[1]],
  );
  return (
    <group
      ref={g}
      position={inst.transform.position}
      rotation={[deg(r[0]), deg(r[1]), deg(r[2])]}
      onPointerMove={(e) => {
        if (drag?.id === inst.id) {
          e.stopPropagation();
          dragTo(e);
        }
      }}
      onPointerUp={(e) => {
        if (drag?.id === inst.id) {
          e.stopPropagation();
          endDrag(e);
        }
      }}
    >
      <SceneCtx.Provider value={scene}>
        {entry ? (
          <NodeTree doc={entry.doc} parent={null} />
        ) : (
          <mesh
            position={[0, 0, h / 2]}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              pick(e);
            }}
          >
            <boxGeometry args={[fp[0], fp[1], h]} />
            <meshLambertMaterial color={TONES[0]} transparent opacity={0.5} />
            <Edges color={LINE} />
          </mesh>
        )}
      </SceneCtx.Provider>
      {/* 바닥 자리 표시: 선택하면 앰버, 아니면 옅게 (실사풍에선 선택 때만) */}
      {(!lit || selected) && (
        <lineSegments geometry={footprint} position={[0, 0, 5]}>
          <lineBasicMaterial
            color={selected ? ACCENT : LINE}
            transparent
            opacity={selected ? 1 : 0.35}
          />
        </lineSegments>
      )}
      <Html
        position={[0, 0, h + 400]}
        center
        zIndexRange={[10, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <span
          className={`whitespace-nowrap text-[11px] px-1.5 py-0.5 rounded-sm border ${
            lit ? 'bg-[rgb(26_25_23/85%)]' : 'bg-[rgb(28_27_25/85%)]'
          } ${selected ? 'border-accent text-fg' : 'border-border text-muted'}`}
        >
          <span className="mono font-semibold text-fg">{inst.tagPrefix}</span>{' '}
          {entry?.name ?? '설비 없음'}
        </span>
      </Html>
    </group>
  );
}

/** 흐름: 출발 설비 → 도착 설비를 바닥 위 앰버 선으로 (끝에 작은 화살촉) */
function Flows({ doc }: { doc: Factory }) {
  const pos = (id: string): P2 | null => {
    const m = doc.machines.find((x) => x.id === id);
    return m ? [m.transform.position[0], m.transform.position[1]] : null;
  };
  return (
    <>
      {doc.flows.map((f) => {
        const a = pos(f.from.split('.')[0] ?? '');
        const b = pos(f.to.split('.')[0] ?? '');
        if (!a || !b) return null;
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const L = Math.hypot(dx, dy) || 1;
        const ux = dx / L;
        const uy = dy / L;
        const z = 60;
        const tip: [number, number, number] = [b[0] - ux * 300, b[1] - uy * 300, z];
        return (
          <group key={f.id}>
            <Line
              points={[[a[0], a[1], z], tip]}
              color={ACCENT}
              lineWidth={1.5}
              transparent
              opacity={0.9}
            />
            <Line
              points={[
                [tip[0] - ux * 300 - uy * 150, tip[1] - uy * 300 + ux * 150, z],
                tip,
                [tip[0] - ux * 300 + uy * 150, tip[1] - uy * 300 - ux * 150, z],
              ]}
              color={ACCENT}
              lineWidth={1.5}
            />
          </group>
        );
      })}
    </>
  );
}
