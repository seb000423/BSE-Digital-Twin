/**
 * Simulate(공장 관제) 상태: 공장 런타임(FactoryRuntime) 하나 + 재생 여부·배속·선택한 설비.
 * 런타임 값(신호·워크)은 매 프레임 바뀌므로 스토어에 넣지 않고 객체에서 직접 읽는다 (CLAUDE.md 6장).
 */
import { create } from 'zustand';
import { FactoryRuntime } from '@bse/engine';
import { lib } from './store.js';
import { machineOf, useFactory } from './store-factory.js';

export interface SimState {
  fr: FactoryRuntime | null;
  running: boolean;
  speed: number;
  /** 관제 패널·3D 에서 고른 설비 인스턴스 id */
  selected: string | null;
  start: () => void;
  stop: () => void;
  setSpeed: (v: number) => void;
  select: (id: string | null) => void;
}

export const useSim = create<SimState>((set, get) => ({
  fr: null,
  running: false,
  speed: 1,
  selected: null,
  start: () => {
    const doc = useFactory.getState().doc;
    const fr = new FactoryRuntime(doc, (ref) => machineOf(ref)?.doc, lib, {
      seed: 1,
      speed: get().speed,
    });
    fr.start();
    set({ fr, running: true });
  },
  stop: () => set({ fr: null, running: false }),
  setSpeed: (v) => {
    const fr = get().fr;
    if (fr) {
      fr.speed = v;
      for (const m of fr.machines) m.rt.speed = v;
    }
    set({ speed: v });
  },
  select: (id) => set({ selected: id }),
}));
