/**
 * Simulate = 공장 관제 (2026-11-04, D-43): Factory 에서 놓은 설비들이 공장 안에서 함께 돌아가고,
 * 오른쪽 관제 패널에 설비별 상태(가동·대기·알람)·생산 수·현재 스텝, 위에 공장 합계가 나온다.
 * 들어오면 바로 재생. 설비를 (3D 나 목록에서) 고르면 아래에 그 설비의 신호가 보인다. 설비 동작 점검은 Machine 에서.
 */
import { useEffect, useRef, useState } from 'react';
import { describeTag } from '@bse/blocks';
import { FactoryViewport } from '../three/FactoryViewport.js';
import { Dock } from '../panels/Dock.js';
import { XrayToggle } from '../panels/XrayToggle.js';
import { floorSize, machineOf, useFactory } from '../store-factory.js';
import { useSim } from '../store-sim.js';

/** 재생 중에는 0.1 초마다 다시 그려 지표를 보여 준다 */
function useSimTick(): number {
  const running = useSim((s) => s.running);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setN((x) => x + 1), 100);
    return () => clearInterval(id);
  }, [running]);
  return n;
}

const STATUS = {
  run: { label: '가동', cls: 'bg-ok' },
  idle: { label: '대기', cls: 'bg-warn' },
  alarm: { label: '알람', cls: 'bg-alarm' },
} as const;

export function Simulate() {
  const doc = useFactory((s) => s.doc);
  const { fr, running, speed, selected, start, stop, setSpeed, select } = useSim();
  const tick = useSimTick();
  const [xray, setXray] = useState(false);
  const [w, d] = floorSize(doc);

  // 처음 들어올 때 한 번만 재생을 켠다
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!useSim.getState().running) start();
  }, [start]);

  const kpis = fr ? fr.kpis() : [];
  const totals = fr ? fr.totals() : { produced: 0, running: 0, works: 0 };
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <main className="flex-1 min-h-0 flex flex-col" data-tick={tick}>
      <div className="flex flex-wrap items-center gap-3 min-h-11 px-4 border-b border-border">
        <div className="flex items-center gap-2 text-muted">
          <span>Simulate</span>
          <span>/</span>
          <b className="text-fg">{doc.meta.name}</b>
          <span className="mono text-dim">
            {Math.round(w / 1000)} × {Math.round(d / 1000)} m · 설비 {doc.machines.length} · 데모
            시뮬 · 브라우저 · 10 ms 틱
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-primary min-w-20"
              disabled={running}
              onClick={start}
              title="공장의 설비를 전부 켭니다"
            >
              ▶ 재생
            </button>
            <button
              type="button"
              className="btn min-w-20"
              disabled={!running}
              onClick={stop}
              title="전부 멈추고 처음으로"
            >
              ■ 정지
            </button>
            <label className="flex items-center gap-2 pl-2 text-xs text-muted whitespace-nowrap">
              배속
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="speed w-40"
                aria-label="배속"
              />
              <span className="mono text-fg w-8">×{speed}</span>
            </label>
          </div>
          <span className="w-px h-6 bg-border" />
          <a href="#factory" className="btn no-underline" title="설비 배치를 바꾸러 갑니다">
            Factory 에서 편집 →
          </a>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <section className="flex-1 min-w-0 relative">
          <FactoryViewport look={xray ? 'lines' : 'lit'} mode="sim" />
          <XrayToggle xray={xray} onChange={setXray} />
          <div className="absolute left-3 top-2.5 flex flex-col gap-0.5 text-[11px] mono text-muted pointer-events-none">
            <span>
              TIME <b className="text-fg">{fr ? fmt(fr.time) : '00:00'}</b> · ×{speed}
            </span>
            <span>
              OUT <b className="text-fg">{totals.produced}</b> · RUN{' '}
              <b className="text-fg">
                {totals.running}/{doc.machines.length}
              </b>{' '}
              · WIP <b className="text-fg">{totals.works}</b>
            </span>
          </div>
          <div className="absolute right-3 bottom-2.5 text-[11px] text-dim pointer-events-none">
            {xray ? 'X-ray' : '실사풍'} · 설비를 누르면 신호 · 끌면 돌려 보기 · 휠은 확대
          </div>
        </section>

        <aside className="pane w-[320px] shrink-0 border-l border-border overflow-auto text-xs">
          <h3 className="panel-h m-0">
            공장 관제
            <span className="ml-auto font-normal text-dim">{running ? '재생 중' : '정지'}</span>
          </h3>
          <div className="grid grid-cols-2 gap-px bg-border border-b border-border">
            {[
              ['경과', fr ? fmt(fr.time) : '00:00'],
              ['생산 합계', `${totals.produced} 개`],
              ['가동 설비', `${totals.running} / ${doc.machines.length}`],
              ['진행 중 워크', `${totals.works}`],
            ].map(([k, v]) => (
              <div key={k} className="bg-paper px-3 py-2">
                <div className="text-dim">{k}</div>
                <div className="mono text-base text-fg">{v}</div>
              </div>
            ))}
          </div>
          <h3 className="panel-h m-0">
            설비 <span className="font-normal text-muted">{doc.machines.length}</span>
            <span className="ml-auto font-normal text-dim">누르면 신호</span>
          </h3>
          {doc.machines.length === 0 && (
            <p className="px-3 py-3 m-0 text-muted">
              공장에 설비가 없습니다. Factory 에서 설비 카드를 놓으세요.
            </p>
          )}
          {doc.machines.map((m) => {
            const k = kpis.find((x) => x.id === m.id);
            const st = k ? STATUS[k.status] : null;
            const sel = selected === m.id;
            return (
              <button
                key={m.id}
                type="button"
                className={`block w-full text-left px-3 py-2 border-0 border-b border-border bg-transparent cursor-pointer text-xs ${
                  sel ? 'bg-[rgb(216_207_189/12%)]' : 'hover:bg-[rgb(216_207_189/6%)]'
                }`}
                aria-current={sel}
                onClick={() => select(sel ? null : m.id)}
              >
                <div className="flex items-center gap-2">
                  <i className={`dot ${st ? st.cls : 'border border-muted'}`} />
                  <span className="mono font-semibold text-fg">{m.tagPrefix}</span>
                  <span className="text-muted truncate">
                    {machineOf(m.ref)?.name ?? '설비 없음'}
                  </span>
                  <span className="ml-auto mono text-fg">{k ? `${k.produced} 개` : '—'}</span>
                </div>
                <div className="pl-[15px] text-dim truncate">
                  {st ? st.label : '정지'}
                  {k?.step ? ` · ${k.step}` : ''}
                  {k ? ` · 워크 ${k.works}` : ''}
                </div>
              </button>
            );
          })}
          <h3 className="panel-h m-0">관제에 들어올 것</h3>
          <p className="px-3 py-2 m-0 text-dim leading-5">
            설비 사이 워크 넘기기(흐름 따라), 정식 공장 시뮬(DES)·시나리오 비교는 서버 단계에서.
            지금은 설비마다 자기 순서로 돌고 지표만 모읍니다.
          </p>
        </aside>
      </div>

      <Dock>
        <SignalDock />
      </Dock>
    </main>
  );
}

/** 아래: 고른 설비의 신호 표 (읽기만) */
function SignalDock() {
  const selected = useSim((s) => s.selected);
  const fr = useSim((s) => s.fr);
  useSimTick();
  const inst = useFactory((s) => s.doc.machines.find((m) => m.id === selected));
  const sim = inst && fr ? fr.machines.find((m) => m.inst.id === inst.id) : undefined;
  if (!inst || !sim)
    return (
      <div className="h-full flex flex-col">
        <h3 className="panel-h m-0">신호</h3>
        <p className="px-3 py-3 m-0 text-muted text-xs">
          3D 나 오른쪽 목록에서 설비를 고르면 그 설비의 태그 값이 여기 보입니다. 태그 이름 앞에는
          설비 접두어(예: ST01.M1.)가 붙습니다.
        </p>
      </div>
    );
  const val = (tag: string) => {
    const v = sim.rt.signals.get(tag);
    return typeof v === 'boolean' ? (v ? '1' : '0') : String(Math.round(v * 10) / 10);
  };
  return (
    <div className="h-full flex flex-col">
      <h3 className="panel-h m-0">
        신호 <span className="mono font-normal">{inst.tagPrefix}</span>
        <span className="font-normal text-muted">{machineOf(inst.ref)?.name}</span>
        <span className="ml-auto font-normal text-dim">{sim.doc.io.length}개</span>
      </h3>
      <div className="overflow-auto flex-1">
        <table className="tbl mono">
          <thead>
            <tr>
              <th>태그</th>
              <th className="font-sans">뜻</th>
              <th className="font-sans">종류</th>
              <th>값</th>
            </tr>
          </thead>
          <tbody>
            {sim.doc.io.map((e) => (
              <tr key={e.tag}>
                <td>
                  <span className="text-dim">{inst.tagPrefix}.</span>
                  {e.tag}
                </td>
                <td className="font-sans">
                  {describeTag(e.tag) || <span className="text-dim">—</span>}
                </td>
                <td className="font-sans text-muted">{e.dir === 'out' ? '명령' : '상태'}</td>
                <td>
                  <i
                    className={`dot ${val(e.tag) === '1' ? 'bg-ok' : val(e.tag) === '0' ? 'border border-muted' : 'bg-line'}`}
                  />
                  {val(e.tag)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
