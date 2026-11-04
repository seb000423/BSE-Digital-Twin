/**
 * 실사풍 보기('lit', 04 §9.5, D-39) 의 장면 부품들: Simulate 화면에서 쓴다.
 * 차콜 바닥 + 베이지 설비 + 앰버 강조 1색 (D-41). 직교 아이소메트릭, 따뜻한 키라이트 + 그림자,
 * 바닥은 원형으로 배경에 녹이고 격자는 셰이더로 그린다(깊이 싸움 없음), 블룸은 발광체에만.
 * 코드·모델·배색은 우리 것이고 설정값만 참고 분석(docs research)에서 가져왔다.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MeshReflectorMaterial } from '@react-three/drei';
import { useEditor } from '../store.js';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** 차콜 + 베이지 + 앰버 (D-41, 2026-11-04): 어두운 차콜 바닥, 설비는 따뜻한 회색·베이지 3단, 발광은 앰버 한 색 */
export const LIT = {
  bg: '#1a1917',
  floor: '#221f1b',
  grid: '#cfc5b0',
  tones: ['#35332e', '#8e877a', '#d6ccb9'] as const,
  key: '#fff1dc',
  rim: '#cabfa6',
  glow: '#ffb14a',
};

/** 렌더러 설정 + 환경광 (한 번) */
export function LitRenderer() {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.toneMappingExposure = 0.95;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFShadowMap;
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.85;
    scene.background = new THREE.Color(LIT.bg);
    return () => {
      scene.environment = null;
      scene.background = null;
      env.dispose();
      pmrem.dispose();
      gl.toneMapping = THREE.NoToneMapping;
      gl.shadowMap.enabled = false;
    };
  }, [gl, scene]);
  return null;
}

/** 키라이트(그림자) + 림 + 아주 약한 앰비언트. size = 설비 크기(m) */
export function LitLights({ size }: { size: number }) {
  const s = size * 1.2;
  return (
    <>
      <directionalLight
        color={LIT.key}
        intensity={3}
        position={[-6, 13, 3]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={5}
        shadow-bias={-4e-4}
        shadow-normalBias={0.02}
        shadow-camera-left={-s}
        shadow-camera-right={s}
        shadow-camera-top={s}
        shadow-camera-bottom={-s}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <directionalLight color={LIT.rim} intensity={0.6} position={[2, 9, -10]} />
      <ambientLight color={LIT.rim} intensity={0.08} />
    </>
  );
}

/** 바닥: 그림자를 받는 면 + 셰이더 격자(1 m 옅게, 5 m 조금 더) + 원형 페이드 */
export function LitFloor({ size }: { size: number }) {
  const mat = useMemo(() => {
    const u = {
      uBg: { value: new THREE.Color(LIT.bg) },
      uGrid: { value: new THREE.Color(LIT.grid) },
      uR0: { value: size * 0.5 },
      uR1: { value: size * 1.05 },
    };
    const m = new THREE.MeshStandardMaterial({
      color: LIT.floor,
      roughness: 0.65,
      metalness: 0.03,
    });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vW; uniform vec3 uBg; uniform vec3 uGrid; uniform float uR0; uniform float uR1;',
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
          vec2 g1 = abs(fract(vW.xz - 0.5) - 0.5) / fwidth(vW.xz);
          float l1 = 1.0 - min(min(g1.x, g1.y), 1.0);
          vec2 g5 = abs(fract(vW.xz / 5.0 - 0.5) - 0.5) / fwidth(vW.xz / 5.0);
          float l5 = 1.0 - min(min(g5.x, g5.y), 1.0);
          float fade = 1.0 - smoothstep(uR0, uR1, length(vW.xz));
          gl_FragColor.rgb += uGrid * (l1 * 0.05 + l5 * 0.05) * fade;
          gl_FragColor.rgb = mix(uBg, gl_FragColor.rgb, fade);`,
        );
    };
    return m;
  }, [size]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.003, 0]} receiveShadow material={mat}>
      <planeGeometry args={[size * 5, size * 5]} />
    </mesh>
  );
}

/** 후처리: 블룸(임계 2 → 발광 재질만 번짐). r3f 기본 렌더 대신 매 프레임 composer 로 그린다 */
export function LitBloom() {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(
      gl,
      new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }),
    );
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.35, 2.0));
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera]);
  useEffect(() => {
    composer.setSize(size.width, size.height);
    composer.setPixelRatio(gl.getPixelRatio());
  }, [composer, size, gl]);
  useEffect(() => () => composer.dispose(), [composer]);
  useFrame(() => composer.render(), 1);
  return null;
}

/** 바닥 거울 반사: 바닥 바로 위에 반투명 반사 면을 한 겹 더 (반사량은 아주 약하게) */
export function LitMirror({ size }: { size: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
      <planeGeometry args={[size * 5, size * 5]} />
      <MeshReflectorMaterial
        mirror={0.6}
        mixStrength={0.9}
        mixBlur={1}
        blur={[200, 60]}
        resolution={512}
        color={LIT.floor}
        transparent
        opacity={0.14}
        depthWrite={false}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

/** 지금 보는 설비 밑의 발광 링 (숨쉬듯 아주 약하게 커졌다 작아짐) */
export function LitRing({ radius }: { radius: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const s = 1 + Math.sin(clock.elapsedTime * 1.6) * 0.015;
    m.scale.set(s, s, 1);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
      <torusGeometry args={[radius, 0.008, 8, 128]} />
      <meshStandardMaterial color={LIT.glow} emissive={LIT.glow} emissiveIntensity={2.6} />
    </mesh>
  );
}

/**
 * 컨베이어 흐름 빛: 가동(RUN) 중인 컨베이어 위를 작은 발광 조각들이 흘러간다 (문서 좌표 mm, 부모 = 컨베이어 노드).
 * 런타임 신호만 읽는다. 양 끝에서는 크기를 0 으로 줄여 튀어나오지 않게.
 */
export function FlowChips({
  length,
  width,
  height,
  runTag,
  dirTag,
}: {
  length: number;
  width: number;
  height: number;
  runTag: string;
  dirTag: string;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const n = Math.max(3, Math.round(length / 600));
  const phase = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const rt = useEditor.getState().runtime();
    const on = !!rt && rt.signals.has(runTag) && rt.signals.get(runTag) === true;
    const back = !!rt && rt.signals.has(dirTag) && rt.signals.get(dirTag) === true;
    m.visible = on;
    if (!on) return;
    phase.current =
      (phase.current + dt * 0.35 * useEditor.getState().speed * (back ? -1 : 1) + 1) % 1;
    for (let i = 0; i < n; i++) {
      const t = (((i / n + phase.current) % 1) + 1) % 1;
      const x = -length / 2 + t * length;
      const edge = Math.min(1, Math.min(t, 1 - t) * 8);
      dummy.position.set(x, 0, height + 6);
      dummy.scale.set(edge, edge, edge);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} visible={false}>
      <boxGeometry args={[70, width * 0.45, 6]} />
      <meshStandardMaterial
        color={LIT.glow}
        emissive={LIT.glow}
        emissiveIntensity={1.6}
        transparent
        opacity={0.85}
      />
    </instancedMesh>
  );
}

/** 상태등·센서 발광: 태그가 켜지면 발광 세기를 올린다 (타워램프 R/Y/G, 센서 ON) */
export function GlowMaterial({ tag, color }: { tag: string; color: string }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const rt = useEditor.getState().runtime();
    const on = !!rt && rt.signals.has(tag) && rt.signals.get(tag) === true;
    const target = on ? 3 : 0.15;
    m.emissiveIntensity += (target - m.emissiveIntensity) * 0.2;
  });
  return (
    <meshStandardMaterial
      ref={ref}
      color={color}
      emissive={color}
      emissiveIntensity={0.15}
      roughness={0.3}
    />
  );
}
