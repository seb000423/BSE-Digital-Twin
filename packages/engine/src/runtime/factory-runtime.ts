/**
 * 공장 데모 런타임 (Simulate 공장 관제, V1): factory.json 의 설비 인스턴스마다 설비 런타임(MachineRuntime)을 하나씩 돌린다.
 * 같은 틱(10 ms)으로 전부 전진. 시드는 공장 시드 + 인스턴스 번호 → 결정적.
 * 각 설비는 자기 동작 순서(sequence, 없으면 자동 생성)로 자동 운전한다. 설비 사이 워크 전달(흐름 따라 넘기기)은 다음 단계 —
 * 지금은 흐름 선만 보여 주고 지표(생산 수·가동)는 설비별 싱크·RUN 태그에서 읽는다. 정식 DES 는 서버(원칙 7).
 */
import { SIGNAL_TICK_MS, type Factory, type Machine, type MachineInstance } from '@bse/schema';
import type { BlockLibrary } from '@bse/blocks';
import { MachineRuntime } from './machine-runtime.js';
import { generateSequence } from '../editor/sequence.js';

const AUTO_ON = /_(RUN|START)$/;

export interface MachineSim {
  inst: MachineInstance;
  doc: Machine;
  rt: MachineRuntime;
}

export type MachineStatus = 'run' | 'idle' | 'alarm';

export interface MachineKpi {
  id: string;
  tagPrefix: string;
  status: MachineStatus;
  /** 싱크(배출) 카운트 합 */
  produced: number;
  /** 지금 설비 안에 있는 워크 수 */
  works: number;
  /** 자동 운전 현재 스텝 이름 ('' 이면 자동 운전 아님) */
  step: string;
}

export class FactoryRuntime {
  readonly machines: MachineSim[] = [];
  /** 참조를 못 찾은 인스턴스 id (다른 설비를 열어서 사라진 것) */
  readonly missing: string[] = [];
  time = 0;
  speed: number;
  readonly seed: number;

  constructor(
    readonly factory: Factory,
    machineOf: (ref: string) => Machine | undefined,
    lib: BlockLibrary,
    opts: { seed?: number; speed?: number } = {},
  ) {
    this.seed = opts.seed ?? 1;
    this.speed = opts.speed ?? 1;
    factory.machines.forEach((inst, i) => {
      const doc = machineOf(inst.ref);
      if (!doc) {
        this.missing.push(inst.id);
        return;
      }
      // 순서가 없으면 자동으로 만들어서 돌린다 (문서는 건드리지 않음)
      const sim: Machine =
        doc.sequence.steps.length > 0
          ? doc
          : { ...doc, sequence: { steps: generateSequence(doc) } };
      const rt = new MachineRuntime(sim, lib, { seed: this.seed * 1000 + i, speed: this.speed });
      this.machines.push({ inst, doc: sim, rt });
    });
  }

  /** 전부 켜기: RUN·START 류 출력 태그 + 자동 운전 */
  start(): void {
    for (const m of this.machines) {
      for (const e of m.doc.io)
        if (e.dir === 'out' && AUTO_ON.test(e.tag)) m.rt.signals.force(e.tag, true);
      m.rt.setAuto(true);
    }
  }

  step(ticks = 1): void {
    for (const m of this.machines) m.rt.step(ticks);
    this.time += (ticks * SIGNAL_TICK_MS) / 1000;
  }
  advance(seconds: number): void {
    this.step(Math.round((seconds * 1000) / SIGNAL_TICK_MS));
  }

  runtimeOf(instId: string): MachineRuntime | null {
    return this.machines.find((m) => m.inst.id === instId)?.rt ?? null;
  }

  /** 설비별 지표 (관제 패널용) */
  kpis(): MachineKpi[] {
    return this.machines.map((m) => {
      const s = m.rt.signals;
      let produced = 0;
      let running = false;
      let alarm = false;
      for (const e of m.doc.io) {
        const v = s.get(e.tag);
        if (e.tag.endsWith('_ALARM') && v === true) alarm = true;
        if (AUTO_ON.test(e.tag) && v === true) running = true;
        if (/^SNK\d*_COUNT$/.test(e.tag) && typeof v === 'number') produced += v;
      }
      const stepName = m.rt.auto.on ? (m.doc.sequence.steps[m.rt.auto.step]?.name ?? '') : '';
      return {
        id: m.inst.id,
        tagPrefix: m.inst.tagPrefix,
        status: alarm ? 'alarm' : running ? 'run' : 'idle',
        produced,
        works: m.rt.works.length,
        step: stepName,
      };
    });
  }

  /** 공장 합계 */
  totals(): { produced: number; running: number; works: number } {
    const k = this.kpis();
    return {
      produced: k.reduce((a, x) => a + x.produced, 0),
      running: k.filter((x) => x.status === 'run').length,
      works: k.reduce((a, x) => a + x.works, 0),
    };
  }
}
