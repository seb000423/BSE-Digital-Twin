/**
 * 3D 뷰포트 (04 §9.4): 남색 바닥 격자 + 옅게 채운 면 3단계 + 밝은 외곽선. 선택 = 흰 외곽선.
 * 좌표: 문서는 mm · Z-up, three.js 는 m · Y-up (지침서 5장) → 루트 그룹에서 한 번에 변환한다.
 * 움직임은 런타임(MachineRuntime)의 관절 위치를 매 프레임 읽어서만 반영한다 (스토어에 넣지 않음).
 */
import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, OrbitControls, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { Machine, MachineNode } from '@bse/schema';
import type { Primitive } from '@bse/blocks';
import { SIGNAL_TICK_MS } from '@bse/engine';
import { lib, useEditor } from '../store.js';

const MM = 0.001;
const TONES = ['#16395c', '#1e4a73', '#2a5f8f'] as const;
const LINE = '#cfe4f5';
const SEL = '#ffffff';
const deg = (d: number) => (d * Math.PI) / 180;

export function Viewport() {
  const doc = useEditor((s) => s.doc);
  const bbox = doc.meta.bbox;
  const size = Math.max(bbox[0], bbox[1]) * MM;
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
      <OrbitControls makeDefault enableDamping={false} target={[0, bbox[2] * MM * 0.3, 0]} />
      <CameraRig size={size} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[-6, 10, 4]} intensity={0.9} />
      <directionalLight position={[8, 4, -8]} intensity={0.35} color="#9fc3e8" />
      <gridHelper args={[size * 2, Math.round(size * 2), LINE, LINE]} position={[0, -0.001, 0]}>
        <lineBasicMaterial attach="material" color={LINE} transparent opacity={0.22} />
      </gridHelper>
      {/* 문서 좌표 (mm, Z-up) → three (m, Y-up) */}
      <group rotation={[-Math.PI / 2, 0, 0]} scale={MM}>
        <GuideBox bbox={bbox} />
        <NodeTree doc={doc} parent={null} />
        <Runner />
      </group>
    </Canvas>
  );
}

/** 외곽 가이드가 화면 높이의 약 70% 를 차지하도록 줌을 맞춘다 */
function CameraRig({ size }: { size: number }) {
  const { camera, size: view } = useThree();
  useMemo(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom = Math.min(view.width * 0.55, view.height * 0.9) / size;
    cam.updateProjectionMatrix();
  }, [camera, view.width, view.height, size]);
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

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useEditor.getState().dispatch({ cmd: 'select', ids: [node.id] });
  };
  const r = node.transform.rotation;
  return (
    <group position={node.transform.position} rotation={[deg(r[0]), deg(r[1]), deg(r[2])]}>
      {parts.map(([part, list]) => (
        <PartGroup
          key={part ?? '-'}
          joint={part ? jointNames.find((j) => j.name === part)?.joint : undefined}
        >
          {list.map((p, i) => (
            <Prim key={i} p={p} selected={selected} onClick={onClick} />
          ))}
        </PartGroup>
      ))}
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

function Prim({
  p,
  selected,
  onClick,
}: {
  p: Primitive;
  selected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const rot = p.rotation ? [deg(p.rotation[0]), deg(p.rotation[1]), deg(p.rotation[2])] : [0, 0, 0];
  return (
    <mesh position={p.position} rotation={rot as [number, number, number]} onClick={onClick}>
      {p.kind === 'box' ? (
        <boxGeometry args={p.size} />
      ) : (
        <cylinderGeometry args={[p.size[0], p.size[1], p.size[2], 20]} />
      )}
      <meshLambertMaterial color={TONES[p.tone]} transparent opacity={0.92} />
      <Edges color={selected ? SEL : LINE} threshold={p.kind === 'cylinder' ? 30 : 15} />
    </mesh>
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
