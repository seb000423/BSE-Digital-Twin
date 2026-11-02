/**
 * 3D 뷰포트 (04 §9.4): 남색 바닥 격자 + 옅게 채운 면 3단계 + 밝은 외곽선. 선택 = 흰 외곽선.
 * 좌표: 문서는 mm · Z-up, three.js 는 m · Y-up (지침서 5장) → 루트 그룹에서 한 번에 변환한다.
 * 움직임은 런타임(MachineRuntime)의 관절 위치를 매 프레임 읽어서만 반영한다 (스토어에 넣지 않음).
 * 끌어서 옮기기: 블록을 누른 채 끌면 그 높이의 수평면 위에서 움직이고(50 mm 격자), 놓을 때 move 명령 한 번만 보낸다.
 * 보기 두 가지 (04 §9.4): 'solid' = 편집용(옅게 채운 면 + 외곽선, 클릭·끌기),
 * 'lines' = Simulate 용 은선 선화(면은 깊이만 기록해 뒤의 선을 가리고, 외곽선만 보임, 자동 회전).
 */
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, Html, OrbitControls, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { Machine, MachineNode } from '@bse/schema';
import { extents, type Primitive } from '@bse/blocks';
import { SIGNAL_TICK_MS } from '@bse/engine';
import { lib, prefixOf, useEditor } from '../store.js';

const MM = 0.001;
const TONES = ['#16395c', '#1e4a73', '#2a5f8f'] as const;
const LINE = '#cfe4f5';
const SEL = '#ffffff';
const SNAP = 50;
export type Look = 'solid' | 'lines';
const LookCtx = createContext<Look>('solid');
const deg = (d: number) => (d * Math.PI) / 180;

/** 노드 id → three 그룹 (끌기 미리보기와 부모 좌표 변환에 쓴다) */
const groups = new Map<string, THREE.Group>();
let rootGroup: THREE.Group | null = null;

interface Drag {
  id: string;
  parent: string | null;
  plane: THREE.Plane;
  hit0: THREE.Vector3;
  start: [number, number, number];
  moved: boolean;
}
let drag: Drag | null = null;

function parentOf(parent: string | null): THREE.Object3D | null {
  return parent ? (groups.get(parent) ?? null) : rootGroup;
}

/** 끌기 시작: 블록의 현재 높이에 수평면을 놓고, 첫 교점을 기억한다 */
function beginDrag(e: ThreeEvent<PointerEvent>, node: MachineNode): void {
  const g = groups.get(node.id);
  const parent = parentOf(node.parent);
  if (!g || !parent) return;
  const world = g.getWorldPosition(new THREE.Vector3());
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -world.y);
  const hit0 = new THREE.Vector3();
  if (!e.ray.intersectPlane(plane, hit0)) return;
  drag = {
    id: node.id,
    parent: node.parent,
    plane,
    hit0,
    start: node.transform.position,
    moved: false,
  };
  (e.target as Element).setPointerCapture(e.pointerId);
}

function dragTo(e: ThreeEvent<PointerEvent>): [number, number, number] | null {
  if (!drag) return null;
  const g = groups.get(drag.id);
  const parent = parentOf(drag.parent);
  if (!g || !parent) return null;
  const hit = new THREE.Vector3();
  if (!e.ray.intersectPlane(drag.plane, hit)) return null;
  const a = parent.worldToLocal(drag.hit0.clone());
  const b = parent.worldToLocal(hit);
  const snap = (v: number) => Math.round(v / SNAP) * SNAP;
  const pos: [number, number, number] = [
    snap(drag.start[0] + (b.x - a.x)),
    snap(drag.start[1] + (b.y - a.y)),
    drag.start[2],
  ];
  if (pos[0] !== drag.start[0] || pos[1] !== drag.start[1]) drag.moved = true;
  g.position.set(pos[0], pos[1], pos[2]);
  return pos;
}

function endDrag(e: ThreeEvent<PointerEvent>): void {
  if (!drag) return;
  const pos = dragTo(e);
  const { id, moved } = drag;
  drag = null;
  const t = e.target as Element;
  if (t.hasPointerCapture(e.pointerId)) t.releasePointerCapture(e.pointerId);
  if (pos && moved)
    useEditor.getState().dispatch({ cmd: 'move', id, transform: { position: pos } });
}

export function Viewport({
  look = 'solid',
  autoRotate = false,
}: {
  look?: Look;
  autoRotate?: boolean;
}) {
  const doc = useEditor((s) => s.doc);
  const bbox = doc.meta.bbox;
  const size = Math.max(bbox[0], bbox[1]) * MM;
  const lines = look === 'lines';
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => useEditor.getState().dispatch({ cmd: 'select', ids: [] })}
      style={{
        background:
          'radial-gradient(ellipse 60% 55% at 50% 60%, rgb(31 78 122 / 90%), transparent)',
      }}
    >
      <OrthographicCamera
        makeDefault
        position={[size * 1.6, size * 1.3, size * 1.6]}
        near={0.01}
        far={200}
      />
      <OrbitControls
        makeDefault
        enableDamping={autoRotate}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
        maxPolarAngle={Math.PI * 0.49}
        target={[0, bbox[2] * MM * 0.3, 0]}
      />
      <CameraRig size={size} fit={lines ? 0.7 : 1} />
      {!lines && <DragGate />}
      <ambientLight intensity={0.6} />
      <directionalLight position={[-6, 10, 4]} intensity={0.9} />
      <directionalLight position={[8, 4, -8]} intensity={0.35} color="#9fc3e8" />
      {lines ? (
        <FadeGrid size={size} />
      ) : (
        <gridHelper args={[size * 2, Math.round(size * 2), LINE, LINE]} position={[0, -0.001, 0]}>
          <lineBasicMaterial attach="material" color={LINE} transparent opacity={0.22} />
        </gridHelper>
      )}
      {/* 문서 좌표 (mm, Z-up) → three (m, Y-up) */}
      <LookCtx.Provider value={look}>
        <group rotation={[-Math.PI / 2, 0, 0]} scale={MM} ref={(g) => void (rootGroup = g)}>
          {!lines && <GuideBox bbox={bbox} />}
          <NodeTree doc={doc} parent={null} />
          <Runner />
        </group>
      </LookCtx.Provider>
    </Canvas>
  );
}

/**
 * 블록 위에서 누르면 OrbitControls 가 먼저 돌기 시작하지 않도록, 캡처 단계에서 먼저 보고 잠시 끈다.
 * (r3f 와 OrbitControls 는 같은 요소에 버블 단계로 붙어 있어 순서를 믿을 수 없다. 놓으면 다시 켠다)
 */
function DragGate() {
  const { events, camera, scene, raycaster, controls, gl } = useThree();
  useEffect(() => {
    const el = events.connected as HTMLElement | undefined;
    const ctl = controls as { enabled: boolean } | null;
    if (!el || !ctl) return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || useEditor.getState().running) return;
      const r = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster
        .intersectObjects(scene.children, true)
        .find((h) => (h.object as THREE.Mesh).isMesh && h.object.visible);
      if (!hit) return;
      ctl.enabled = false;
      const up = () => {
        ctl.enabled = true;
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('pointercancel', up, true);
      };
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', up, true);
    };
    el.addEventListener('pointerdown', onDown, true);
    return () => el.removeEventListener('pointerdown', onDown, true);
  }, [events.connected, camera, scene, raycaster, controls, gl]);
  return null;
}

/** 멀어질수록 옅어지는 바닥 격자 (1 m) — Simulate 은선 보기용 */
function FadeGrid({ size }: { size: number }) {
  const geo = useMemo(() => {
    const n = Math.max(12, Math.ceil(size * 1.6));
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color(LINE);
    const fade = (x: number, z: number) =>
      Math.pow(Math.max(0, 1 - Math.hypot(x, z) / (n * 0.95)), 2) * 0.55;
    for (let i = -n; i <= n; i++)
      for (let j = -n; j < n; j++) {
        pos.push(i, 0, j, i, 0, j + 1, j, 0, i, j + 1, 0, i);
        for (const [x, z] of [
          [i, j],
          [i, j + 1],
          [j, i],
          [j + 1, i],
        ] as const) {
          const a = fade(x, z);
          col.push(c.r * a, c.g * a, c.b * a);
        }
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, [size]);
  return (
    <lineSegments geometry={geo} position={[0, -0.001, 0]}>
      <lineBasicMaterial
        vertexColors
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  );
}

/** 외곽 가이드가 화면 높이의 약 70% 를 차지하도록 줌을 맞춘다 */
function CameraRig({ size, fit = 1 }: { size: number; fit?: number }) {
  const { camera, size: view } = useThree();
  useMemo(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom = (Math.min(view.width * 0.7, view.height * 1.1) / size) * fit;
    cam.updateProjectionMatrix();
  }, [camera, view.width, view.height, size, fit]);
  return null;
}

function GuideBox({ bbox }: { bbox: [number, number, number] }) {
  const geo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(bbox[0], bbox[1], bbox[2])),
    [bbox],
  );
  return (
    <lineSegments
      geometry={geo}
      position={[0, 0, bbox[2] / 2]}
      onUpdate={(l) => l.computeLineDistances()}
    >
      <lineDashedMaterial
        color={LINE}
        transparent
        opacity={0.5}
        dashSize={120}
        gapSize={80}
        onUpdate={(m) => void m}
      />
    </lineSegments>
  );
}

function NodeTree({ doc, parent }: { doc: Machine; parent: string | null }) {
  return (
    <>
      {doc.nodes
        .filter((n) => n.parent === parent)
        .map((n) => (
          <NodeView key={n.id} doc={doc} node={n} />
        ))}
    </>
  );
}

function NodeView({ doc, node }: { doc: Machine; node: MachineNode }) {
  const selected = useEditor((s) => s.selection.includes(node.id));
  const prims = useMemo<Primitive[]>(() => {
    if (node.type !== 'block' || !node.blockType) return [];
    try {
      return lib.geometry(node.blockType, node.params as Record<string, number | string | boolean>);
    } catch {
      return [];
    }
  }, [node.type, node.blockType, node.params]);
  const parts = useMemo(() => {
    const m = new Map<string | undefined, Primitive[]>();
    for (const p of prims) m.set(p.part, [...(m.get(p.part) ?? []), p]);
    return [...m.entries()];
  }, [prims]);
  const jointNames = useMemo(() => {
    if (!node.blockType) return [];
    const drafts = lib.joints(
      node.blockType,
      node.params as Record<string, number | string | boolean>,
    );
    const joints = doc.joints.filter((j) => j.node === node.id);
    return joints.map((j, i) => ({ joint: j, name: drafts[i]?.name ?? '' }));
  }, [doc.joints, node.id, node.blockType, node.params]);

  const running = useEditor((s) => s.running);
  const handlers: PrimHandlers = {
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      useEditor.getState().dispatch({ cmd: 'select', ids: [node.id] });
      if (!running) beginDrag(e, node);
    },
    onPointerMove: (e) => {
      if (drag?.id === node.id) {
        e.stopPropagation();
        dragTo(e);
      }
    },
    onPointerUp: (e) => {
      if (drag?.id === node.id) {
        e.stopPropagation();
        endDrag(e);
      }
    },
    onLostPointerCapture: (e) => {
      if (drag?.id === node.id) endDrag(e);
    },
  };
  const r = node.transform.rotation;
  const height = useMemo(() => extents(prims)[2], [prims]);
  const prefix = prefixOf(doc, node.id);
  return (
    <group
      position={node.transform.position}
      rotation={[deg(r[0]), deg(r[1]), deg(r[2])]}
      ref={(g) => {
        if (g) groups.set(node.id, g);
        else groups.delete(node.id);
      }}
    >
      {parts.map(([part, list]) => (
        <PartGroup
          key={part ?? '-'}
          joint={part ? jointNames.find((j) => j.name === part)?.joint : undefined}
        >
          {list.map((p, i) => (
            <Prim key={i} p={p} selected={selected} h={handlers} />
          ))}
        </PartGroup>
      ))}
      {(node.parent === null || selected) && prims.length > 0 && (
        <Html
          position={[0, 0, height + 120]}
          center
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span
            className={`whitespace-nowrap text-[11px] px-1.5 py-0.5 rounded-sm border ${
              selected ? 'border-fg text-fg' : 'border-border text-muted'
            } bg-[rgb(15_42_69/85%)]`}
          >
            <span className="mono font-semibold text-fg">{prefix}</span> {node.name}
          </span>
        </Html>
      )}
      <WorkLayer parent={node.id} />
      <NodeTree doc={doc} parent={node.id} />
    </group>
  );
}

/** 관절이 움직이는 부품 묶음: 매 프레임 런타임 위치를 읽어 평행이동(lin) 또는 회전(rot) */
function PartGroup({
  joint,
  children,
}: {
  joint?: Machine['joints'][number] | undefined;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g || !joint) return;
    const rt = useEditor.getState().runtime();
    const st = rt?.jointState(joint.id);
    const pos = st ? st.pos : joint.home;
    const a = joint.axis;
    if (joint.type === 'lin') g.position.set(a[0] * pos, a[1] * pos, a[2] * pos);
    else if (joint.type === 'rot')
      g.setRotationFromAxisAngle(new THREE.Vector3(a[0], a[1], a[2]), deg(pos));
  });
  return <group ref={ref}>{children}</group>;
}

interface PrimHandlers {
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
  onLostPointerCapture: (e: ThreeEvent<PointerEvent>) => void;
}

/** 도형 하나. 원기둥은 문서 규약대로 축이 Z 라야 하므로(three 는 Y 축) 안쪽에서 X 축 +90° 돌려 세운다 */
function Prim({ p, selected, h }: { p: Primitive; selected: boolean; h: PrimHandlers }) {
  const lines = useContext(LookCtx) === 'lines';
  const rot = p.rotation ? [deg(p.rotation[0]), deg(p.rotation[1]), deg(p.rotation[2])] : [0, 0, 0];
  const mesh = (
    <mesh rotation={p.kind === 'cylinder' ? [Math.PI / 2, 0, 0] : [0, 0, 0]} {...h}>
      {p.kind === 'box' ? (
        <boxGeometry args={p.size} />
      ) : (
        <cylinderGeometry args={[p.size[0], p.size[1], p.size[2], 20]} />
      )}
      {lines ? (
        // 깊이만 기록하는 가림막: 뒤쪽 선을 숨긴다 (은선 제거)
        <meshBasicMaterial
          colorWrite={false}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      ) : (
        <meshLambertMaterial color={TONES[p.tone]} transparent opacity={0.92} />
      )}
      <Edges
        color={selected ? SEL : LINE}
        threshold={p.kind === 'cylinder' ? 30 : 15}
        transparent
        opacity={lines ? ([0.45, 0.7, 1][p.tone] ?? 1) : 1}
      />
    </mesh>
  );
  return (
    <group position={p.position} rotation={rot as [number, number, number]}>
      {mesh}
    </group>
  );
}

/** 런타임이 만든 워크 (소스가 생성한 것 포함) — 메시 풀 32개를 매 프레임 갱신 */
const POOL = 32;
function WorkLayer({ parent }: { parent: string }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const rt = useEditor.getState().runtime();
    const works = rt ? rt.works.filter((w) => w.parent === parent) : [];
    for (let i = 0; i < POOL; i++) {
      const m = refs.current[i];
      if (!m) continue;
      const w = works[i];
      m.visible = !!w;
      if (w) m.position.set(w.x, w.y, w.z + w.size * 0.25);
    }
  });
  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <mesh key={i} ref={(el) => void (refs.current[i] = el)} visible={false}>
          <boxGeometry args={[100, 100, 50]} />
          <meshLambertMaterial color={TONES[2]} />
          <Edges color={LINE} />
        </mesh>
      ))}
    </>
  );
}

/** 실행 모드 틱: 렌더 프레임마다 지나간 시간만큼 10 ms 틱을 돌린다 (배속 반영) */
function Runner() {
  const acc = useRef(0);
  useFrame((_, dt) => {
    const s = useEditor.getState();
    const rt = s.runtime();
    if (!rt) return;
    acc.current += Math.min(dt, 0.1) * 1000 * s.speed;
    const ticks = Math.floor(acc.current / SIGNAL_TICK_MS);
    if (ticks > 0) {
      rt.step(ticks);
      acc.current -= ticks * SIGNAL_TICK_MS;
    }
  });
  return null;
}
