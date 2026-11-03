/**
 * 설비 런타임 (지침서 8.1절 신호·기구학 층, 브라우저 데모 시뮬): 신호 테이블의 태그로만 대화한다 (원칙 2).
 * - 온오프 관절: {n}_FWD/BWD(UP/DOWN, CW/CCW, CLAMP/UNCLAMP, CLOSE/OPEN, PUSH/BACK) → vmax·amax 사다리꼴 이동, 끝에서 *_LS
 * - 위치 관절: {n}_POS_CMD → 이동, {n}_POS_FB·INPOS, HOME
 * - 이송면(컨베이어): {n}_RUN·DIR·SPEED → 위에 놓인 워크가 흐름. 스토퍼가 올라와 있으면 그 앞에서 멈춤
 * - 센서: 같은 부모 위 워크가 검출 폭 안에 들어오면 {n}_ON
 * - 공정: {n}_START → BUSY(처리 시간) → DONE, 양품률로 OK/NG (시드 난수, 결정적)
 * - 로봇: {n}_START → RUNNING(프로그램 시간) → INPOS  (IK 없음, V1)
 * - 소스/싱크: 간격마다 워크 생성 / 도착한 워크 소멸, COUNT
 * 틱 10 ms (5장). 같은 시드 → 같은 결과.
 */
import { SIGNAL_TICK_MS, type Joint, type Machine, type MachineNode } from '@bse/schema';
import type { BlockLibrary } from '@bse/blocks';
import { SignalTable } from '../signal-table.js';
import { createRng, type Rng } from '../rng.js';

const POS_CMDS: [string, string][] = [
  ['FWD', 'BWD'],
  ['UP', 'DOWN'],
  ['CW', 'CCW'],
  ['CLAMP', 'UNCLAMP'],
  ['CLOSE', 'OPEN'],
  ['PUSH', 'BACK'],
  ['DOOR_OPEN', 'DOOR_CLOSE'],
];
const EPS = 0.01;

interface JointState {
  joint: Joint;
  prefix: string;
  pos: number;
  vel: number;
  travel: number;
  fwd: string | null;
  bwd: string | null;
  fwdLs: string | null;
  bwdLs: string | null;
}

export interface WorkState {
  id: string;
  /** 부모 노드(컨베이어 등) 기준 위치 mm */
  parent: string | null;
  x: number;
  y: number;
  z: number;
  size: number;
  state: string;
}

interface ProcessState {
  node: MachineNode;
  prefix: string;
  cycle: number;
  okRate: number;
  busyUntil: number;
  startedWith: boolean;
}

export class MachineRuntime {
  readonly signals = new SignalTable();
  readonly joints: JointState[] = [];
  readonly works: WorkState[] = [];
  /** 시뮬 시각 (s) */
  time = 0;
  /** 자동 운전 (문서의 sequence 를 돌린다): 켜짐 여부 · 현재 스텝 번호 · 스텝에 들어온 시각 */
  readonly auto = { on: false, step: 0, since: 0, entered: false };
  private readonly rng: Rng;
  private readonly processes: ProcessState[] = [];
  private readonly sources: {
    node: MachineNode;
    prefix: string;
    interval: number;
    count: number;
    made: number;
    nextAt: number;
  }[] = [];
  private readonly sinks: { node: MachineNode; prefix: string; count: number }[] = [];
  private readonly sensors: { node: MachineNode; prefix: string; range: number }[] = [];
  private readonly robots: {
    node: MachineNode;
    prefix: string;
    cycle: number;
    busyUntil: number;
    startedWith: boolean;
  }[] = [];
  private workSeq = 0;

  constructor(
    readonly doc: Machine,
    private readonly lib: BlockLibrary,
    opts: { seed?: number; speed?: number } = {},
  ) {
    this.seed = opts.seed ?? 1;
    this.speed = opts.speed ?? 1;
    this.rng = createRng(this.seed);
    for (const e of doc.io) this.signals.define(e.tag, e.type === 'bool' ? false : 0);

    for (const j of doc.joints) {
      const node = this.node(j.node);
      const prefix = node ? this.prefix(node) : '';
      const tags = doc.io
        .filter(
          (e) =>
            e.binding?.target === j.id ||
            (e.binding?.target === j.node && e.tag.startsWith(prefix + '_')),
        )
        .map((e) => e.tag);
      const has = (t: string) => (tags.includes(`${prefix}_${t}`) ? `${prefix}_${t}` : null);
      let fwd: string | null = null;
      let bwd: string | null = null;
      let fwdLs: string | null = null;
      let bwdLs: string | null = null;
      for (const [p, n] of POS_CMDS) {
        if (has(p) || has(n) || has(`${p}_LS`)) {
          fwd = has(p);
          bwd = has(n);
          fwdLs = has(`${p}_LS`);
          bwdLs = has(`${n}_LS`);
          break;
        }
      }
      this.joints.push({
        joint: j,
        prefix,
        pos: j.home,
        vel: 0,
        travel: 0,
        fwd,
        bwd,
        fwdLs,
        bwdLs,
      });
      if (bwdLs && j.home <= j.min + EPS) this.signals.set(bwdLs, true);
    }

    for (const n of doc.nodes) {
      if (n.type !== 'block' || !n.blockType) continue;
      const def = lib.get(n.blockType)?.def;
      if (!def) continue;
      const prefix = this.prefix(n);
      const p = (k: string, d: number) => {
        const v = Number(n.params[k]);
        return Number.isFinite(v) ? v : d;
      };
      if (n.blockType === 'work-box')
        this.works.push({
          id: n.id,
          parent: n.parent,
          x: n.transform.position[0],
          y: n.transform.position[1],
          z: n.transform.position[2],
          size: p('w', 100),
          state: 'raw',
        });
      else if (n.blockType === 'source')
        this.sources.push({
          node: n,
          prefix,
          interval: p('interval', 10),
          count: p('count', 0),
          made: 0,
          nextAt: 0,
        });
      else if (n.blockType === 'sink') this.sinks.push({ node: n, prefix, count: 0 });
      else if (n.blockType === 'robot-6axis')
        this.robots.push({
          node: n,
          prefix,
          cycle: p('cycle', 4),
          busyUntil: -1,
          startedWith: false,
        });
      else if (def.detect && def.meta.category === 'sensor')
        this.sensors.push({ node: n, prefix, range: p('range', def.detect.range) });
      else if (def.process)
        this.processes.push({
          node: n,
          prefix,
          cycle: p('cycle', def.process.cycle_time),
          okRate: p('ok_rate', 1),
          busyUntil: -1,
          startedWith: false,
        });
    }
    for (const s of this.sources)
      if (this.signals.has(`${s.prefix}_READY`)) this.signals.set(`${s.prefix}_READY`, true);
    for (const pr of this.processes)
      if (this.signals.has(`${pr.prefix}_READY`)) this.signals.set(`${pr.prefix}_READY`, true);
  }

  readonly seed: number;
  speed: number;

  node(id: string | null): MachineNode | undefined {
    return id ? this.doc.nodes.find((n) => n.id === id) : undefined;
  }
  private prefix(n: MachineNode): string {
    const b = n.components['block'];
    return b && typeof b === 'object' && 'prefix' in b
      ? String((b as { prefix: string }).prefix)
      : n.name.toUpperCase();
  }
  jointState(jointId: string): JointState | undefined {
    return this.joints.find((j) => j.joint.id === jointId);
  }

  /** 틱 10 ms 를 n 번 */
  step(ticks = 1): void {
    for (let i = 0; i < ticks; i++) this.tick(SIGNAL_TICK_MS / 1000);
  }
  /** 시뮬 시간으로 s 초 진행 */
  advance(seconds: number): void {
    this.step(Math.round((seconds * 1000) / SIGNAL_TICK_MS));
  }

  /** 자동 운전 켜기/끄기. 켜면 첫 스텝부터 */
  setAuto(on: boolean): void {
    this.auto.on = on && this.doc.sequence.steps.length > 0;
    this.auto.step = 0;
    this.auto.since = this.time;
    this.auto.entered = false;
  }

  /** 시뮬이 만든 워크를 모두 치우고 소스·싱크 카운트를 0 으로 (배치해 둔 워크 블록은 남김) */
  resetWorks(): void {
    for (let i = this.works.length - 1; i >= 0; i--)
      if (this.works[i]!.id.startsWith('work-')) this.works.splice(i, 1);
    for (const s of this.sources) {
      s.made = 0;
      s.nextAt = this.time;
      this.set(`${s.prefix}_COUNT`, 0);
      if (this.signals.has(`${s.prefix}_READY`)) this.signals.set(`${s.prefix}_READY`, true);
    }
    for (const s of this.sinks) {
      s.count = 0;
      this.set(`${s.prefix}_COUNT`, 0);
    }
  }

  /** 자동 운전 한 틱: 스텝에 들어오면 set 을 쓰고, wait 가 모두 맞거나 timeout 이 지나면 다음 스텝. 끝나면 2번째 스텝으로 */
  private tickAuto(): void {
    const steps = this.doc.sequence.steps;
    if (!this.auto.on || steps.length === 0) return;
    const a = this.auto;
    if (a.step >= steps.length) a.step = steps.length > 1 ? 1 : 0;
    const st = steps[a.step]!;
    if (!a.entered) {
      for (const x of st.set) this.set(x.tag, x.value);
      a.since = this.time;
      a.entered = true;
    }
    const met = st.wait.every((w) => this.get(w.tag) === w.value);
    const timedOut = st.timeout_ms !== undefined && (this.time - a.since) * 1000 >= st.timeout_ms - 1e-6;
    if ((st.wait.length > 0 && met) || timedOut || (st.wait.length === 0 && st.timeout_ms === undefined)) {
      a.step = a.step + 1 >= steps.length ? (steps.length > 1 ? 1 : 0) : a.step + 1;
      a.entered = false;
    }
  }

  private tick(dt: number): void {
    this.time += dt;
    this.tickAuto();
    for (const js of this.joints) this.tickJoint(js, dt);
    this.tickWorks(dt);
    for (const s of this.sensors) this.tickSensor(s);
    for (const pr of this.processes) this.tickProcess(pr);
    for (const r of this.robots) this.tickRobot(r);
    for (const s of this.sources) this.tickSource(s);
    for (const s of this.sinks) this.tickSink(s);
  }

  private get(tag: string | null): number | boolean {
    return tag && this.signals.has(tag) ? this.signals.get(tag) : false;
  }
  private set(tag: string | null, v: number | boolean): void {
    if (tag && this.signals.has(tag)) this.signals.set(tag, v);
  }

  private tickJoint(js: JointState, dt: number): void {
    const j = js.joint;
    const p = js.prefix;
    if (j.type === 'surface' || j.mode === 'continuous') {
      const run = this.get(`${p}_RUN`) === true;
      const dir = this.get(`${p}_DIR`) === true ? -1 : 1;
      const sp =
        Number(this.get(`${p}_SPEED`)) || Number(this.node(j.node)?.params['speed']) || j.vmax;
      const target = run ? dir * Math.min(sp, j.vmax) : 0;
      js.vel = approach(js.vel, target, j.amax * dt);
      js.travel += js.vel * dt;
      return;
    }
    let target: number | null = null;
    if (j.mode === 'position') {
      if (this.get(`${p}_HOME`) === true) target = j.home;
      else if (this.signals.has(`${p}_POS_CMD`))
        target = clamp(Number(this.get(`${p}_POS_CMD`)), j.min, j.max ?? j.min);
      if (this.get(`${p}_START`) === true && this.signals.has(`${p}_POS_CMD`))
        target = clamp(Number(this.get(`${p}_POS_CMD`)), j.min, j.max ?? j.min);
    } else {
      if (this.get(js.fwd) === true) target = j.max ?? j.min;
      else if (this.get(js.bwd) === true) target = j.min;
    }
    if (target !== null) {
      // 사다리꼴: 남은 거리로 감속, 가속은 amax, 속도는 vmax 로 제한
      const dist = target - js.pos;
      const dirn = Math.sign(dist);
      const vStop = Math.sqrt(2 * j.amax * Math.abs(dist));
      const vWant = dirn * Math.min(j.vmax, vStop);
      js.vel = approach(js.vel, vWant, j.amax * dt);
      const next = js.pos + js.vel * dt;
      if ((dirn > 0 && next >= target) || (dirn < 0 && next <= target) || dist === 0) {
        js.pos = target;
        js.vel = 0;
      } else js.pos = next;
    } else js.vel = 0;
    js.pos = clamp(js.pos, j.min, j.max ?? j.min);
    this.set(js.fwdLs, js.pos >= (j.max ?? j.min) - EPS);
    this.set(js.bwdLs, js.pos <= j.min + EPS);
    if (this.signals.has(`${p}_POS_CMD`)) {
      this.set(`${p}_POS_FB`, js.pos);
      this.set(`${p}_INPOS`, target !== null && js.pos === target && js.vel === 0);
    }
  }

  /** 컨베이어 위 워크 이동. 올라온 스토퍼 앞에서 멈추고 끝에서 멈춘다 */
  private tickWorks(dt: number): void {
    for (const w of this.works) {
      if (!w.parent) continue;
      const belt = this.joints.find(
        (js) => js.joint.node === w.parent && js.joint.type === 'surface',
      );
      if (!belt || belt.vel === 0) continue;
      const conv = this.node(w.parent);
      const len = Number(conv?.params['length']) || 0;
      let next = w.x + belt.vel * dt;
      const limit = len ? len / 2 - w.size / 2 : Infinity;
      next = clamp(next, -limit, limit);
      for (const st of this.doc.nodes.filter(
        (n) => n.blockType === 'stopper' && n.parent === w.parent,
      )) {
        const pin = this.joints.find((js) => js.joint.node === st.id);
        if (!pin || pin.pos < (pin.joint.max ?? 0) * 0.9) continue;
        const edge = st.transform.position[0] - w.size / 2 - 10;
        if (belt.vel > 0 && w.x <= edge && next > edge) next = edge;
      }
      w.x = next;
    }
  }

  private tickSensor(s: { node: MachineNode; prefix: string; range: number }): void {
    const sx = s.node.transform.position[0];
    const sy = s.node.transform.position[1];
    const hit = this.works.some(
      (w) =>
        w.parent === s.node.parent &&
        Math.abs(w.x - sx) <= w.size / 2 &&
        Math.abs(w.y - sy) <= s.range,
    );
    this.set(`${s.prefix}_ON`, hit);
    this.set(`${s.prefix}_SAFE`, !hit);
  }

  private tickProcess(pr: ProcessState): void {
    const p = pr.prefix;
    const start = this.get(`${p}_START`) === true || this.get(`${p}_TRIG`) === true;
    if (start && !pr.startedWith && pr.busyUntil < 0) {
      pr.busyUntil = this.time + pr.cycle;
      this.set(`${p}_BUSY`, true);
      this.set(`${p}_READY`, false);
      this.set(`${p}_DONE`, false);
      this.set(`${p}_OK`, false);
      this.set(`${p}_NG`, false);
    }
    pr.startedWith = start;
    if (pr.busyUntil >= 0 && this.time >= pr.busyUntil - 1e-9) {
      pr.busyUntil = -1;
      const good = this.rng.next() < pr.okRate;
      this.set(`${p}_BUSY`, false);
      this.set(`${p}_DONE`, true);
      this.set(`${p}_OK`, good);
      this.set(`${p}_NG`, !good);
      this.set(`${p}_READY`, true);
      for (const w of this.works)
        if (w.parent === pr.node.parent && Math.abs(w.x - pr.node.transform.position[0]) < 300)
          w.state = good ? 'done' : 'ng';
    }
    if (!start && pr.busyUntil < 0) this.set(`${p}_DONE`, false);
  }

  private tickRobot(r: {
    prefix: string;
    cycle: number;
    busyUntil: number;
    startedWith: boolean;
  }): void {
    const p = r.prefix;
    const start = this.get(`${p}_START`) === true;
    if (start && !r.startedWith && r.busyUntil < 0) {
      r.busyUntil = this.time + r.cycle;
      this.set(`${p}_RUNNING`, true);
      this.set(`${p}_INPOS`, false);
    }
    r.startedWith = start;
    if (r.busyUntil >= 0 && this.time >= r.busyUntil - 1e-9) {
      r.busyUntil = -1;
      this.set(`${p}_RUNNING`, false);
      this.set(`${p}_INPOS`, true);
    }
  }

  private tickSource(s: {
    node: MachineNode;
    prefix: string;
    interval: number;
    count: number;
    made: number;
    nextAt: number;
  }): void {
    if (s.count && s.made >= s.count) {
      this.set(`${s.prefix}_READY`, false);
      return;
    }
    if (this.time + 1e-9 < s.nextAt) return;
    s.nextAt = this.time + s.interval;
    s.made++;
    this.works.push({
      id: `work-${++this.workSeq}`,
      parent: s.node.parent,
      x: s.node.transform.position[0],
      y: s.node.transform.position[1],
      z: s.node.transform.position[2],
      size: 100,
      state: 'raw',
    });
    this.set(`${s.prefix}_COUNT`, s.made);
  }

  private tickSink(s: { node: MachineNode; prefix: string; count: number }): void {
    const sx = s.node.transform.position[0];
    for (let i = this.works.length - 1; i >= 0; i--) {
      const w = this.works[i]!;
      if (w.parent === s.node.parent && Math.abs(w.x - sx) <= w.size / 2 + 10) {
        this.works.splice(i, 1);
        s.count++;
        this.set(`${s.prefix}_COUNT`, s.count);
      }
    }
  }
}

function approach(v: number, target: number, maxDelta: number): number {
  const d = target - v;
  return Math.abs(d) <= maxDelta ? target : v + Math.sign(d) * maxDelta;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
