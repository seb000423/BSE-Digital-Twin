/**
 * 장면 문맥: 설비 모형(NodeTree)이 어느 런타임의 값을 읽고, 클릭을 어디로 보낼지.
 * 기본 = 머신빌더(useEditor 의 런타임, 블록 선택·끌기). 팩토리·Simulate 는 인스턴스마다 다른 값을 넣는다.
 */
import { createContext } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { MachineRuntime } from '@bse/engine';
import { useEditor } from '../store.js';

export interface SceneCtxValue {
  /** 이 설비 모형이 읽을 런타임 (없으면 정지 상태) */
  runtime: () => MachineRuntime | null;
  /** 값이 있으면 블록 클릭이 (블록 선택·끌기 대신) 여기로 간다 */
  pick: ((e: ThreeEvent<PointerEvent>) => void) | null;
  /** pick 이 끌기를 시작했을 때 이어지는 움직임·놓기 (포인터 캡처는 눌린 도형에 걸리므로 도형이 넘겨 준다) */
  dragMove?: (e: ThreeEvent<PointerEvent>) => void;
  dragUp?: (e: ThreeEvent<PointerEvent>) => void;
  /** 블록 이름표를 그릴지 (공장에서는 설비 이름표 하나만) */
  labels: boolean;
  /** 워크·흐름 빛·발광 같은 런타임 연출을 그릴지 */
  effects: boolean;
}

export const SceneCtx = createContext<SceneCtxValue>({
  runtime: () => useEditor.getState().runtime(),
  pick: null,
  labels: true,
  effects: true,
});
