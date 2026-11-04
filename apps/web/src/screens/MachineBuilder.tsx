/** 설비 편집기 (13 화면 지도 C, 04 §9.3): 위 작업줄 → 왼쪽 팔레트·트리 → 가운데 3D → 오른쪽 속성 → 아래 신호 표·수동 조작·명령 기록 */
import { useEffect, useState } from 'react';
import { Viewport } from '../three/Viewport.js';
import { Palette } from '../panels/Palette.js';
import { Properties } from '../panels/Properties.js';
import { BottomPanel } from '../panels/BottomPanel.js';
import { Dock } from '../panels/Dock.js';
import { Transport } from '../panels/Transport.js';
import { startDemo, useEditor } from '../store.js';
import { XrayToggle } from '../panels/XrayToggle.js';

/** 실행 중에는 0.1 초마다 다시 그려 신호 값을 보여 준다 */
export function useLiveTick(): number {
  const running = useEditor((s) => s.running);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setN((x) => x + 1), 100);
    return () => clearInterval(id);
  }, [running]);
  return n;
}

export function MachineBuilder() {
  const { doc, dispatch, running, editor } = useEditor();
  const [bbox, setBbox] = useState(doc.meta.bbox.join(' × '));
  const [xray, setXray] = useState(false);
  useEffect(() => setBbox(doc.meta.bbox.join(' × ')), [doc.meta.bbox]);

  const save = () => {
    dispatch({ cmd: 'save' });
    const blob = new Blob([editor.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.meta.name}.machine.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const applyBbox = () => {
    const v = bbox
      .split(/[×x,\s]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
    if (v.length === 3) dispatch({ cmd: 'set_bbox', bbox: [v[0]!, v[1]!, v[2]!] });
    else setBbox(doc.meta.bbox.join(' × '));
  };

  return (
    <main className="flex-1 min-h-0 flex flex-col">
      <div className="flex flex-wrap items-center gap-3 min-h-11 px-4 border-b border-border">
        <div className="flex items-center gap-2 text-muted">
          <span>설비</span>
          <span>/</span>
          <b className="text-fg">{doc.meta.name}</b>
          <span className="text-[11px] font-bold px-1.5 border border-line rounded-sm text-line">
            {doc.meta.fidelity}
          </span>
          <span className="mono text-dim">
            v{doc.meta.version} · {editor.canUndo ? '수정됨' : '저장됨'}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="seg" role="group" aria-label="모드">
            <button type="button" aria-pressed={!running} onClick={() => dispatch({ cmd: 'stop' })}>
              편집
            </button>
            <button
              type="button"
              aria-pressed={running}
              title="설비를 바로 움직입니다 (컨베이어·로봇 켜기, 동작 순서가 있으면 자동 운전)"
              onClick={startDemo}
            >
              실행
            </button>
            <button type="button" disabled title="시나리오 비교는 4단계">
              비교
            </button>
          </span>
          <button type="button" className="btn" onClick={() => dispatch({ cmd: 'make_card' })}>
            설비 카드 만들기
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            저장
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 px-3 py-1.5 border-b border-border text-xs text-muted">
        <button
          type="button"
          className="btn"
          disabled={!editor.canUndo}
          onClick={() => dispatch({ cmd: 'undo' })}
          title="실행 취소"
        >
          ↶ 실행 취소
        </button>
        <button
          type="button"
          className="btn"
          disabled={!editor.canRedo}
          onClick={() => dispatch({ cmd: 'redo' })}
          title="다시 실행"
        >
          ↷ 다시 실행
        </button>
        <span className="w-px h-5 bg-border mx-1.5" />
        <label
          className="flex items-center gap-2 whitespace-nowrap"
          title="설비가 차지할 바닥 크기(가로 × 세로 × 높이). 3D 의 점선 상자"
        >
          설비 크기
          <input
            className="field w-44 mono"
            value={bbox}
            onChange={(e) => setBbox(e.target.value)}
            onBlur={applyBbox}
            onKeyDown={(e) => e.key === 'Enter' && applyBbox()}
            aria-label="외곽 가이드 W × D × H (mm)"
          />
          mm
        </label>
        <span className="w-px h-5 bg-border mx-1.5" />
        {running && <Transport bar />}
        {!running && (
          <span className="text-dim">블록을 누른 채 끌면 옮겨집니다 · 빈 곳을 끌면 화면 회전</span>
        )}
        <span
          className="ml-auto mono"
          title="단위는 mm 와 도(deg), 높이 방향은 Z, 바닥 격자 한 칸 1000 mm"
        >
          mm · deg · Z-up · 격자 1000 mm
        </span>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside className="pane w-[232px] shrink-0 border-r border-border overflow-auto">
          <Palette />
        </aside>
        <section className="flex-1 min-w-0 relative">
          <Viewport look={xray ? 'lines' : 'solid'} />
          <XrayToggle xray={xray} onChange={setXray} />
          <Hud />
        </section>
        <aside className="pane w-[300px] shrink-0 border-l border-border overflow-auto">
          <Properties />
        </aside>
      </div>

      <Dock>
        <BottomPanel />
      </Dock>
    </main>
  );
}

function Hud() {
  const { doc, selection, running } = useEditor();
  const tick = useLiveTick();
  const rt = useEditor.getState().runtime();
  const sel = doc.nodes.find((n) => n.id === selection[0]);
  return (
    <div
      className="absolute right-3 top-2.5 flex flex-col items-end gap-1.5 text-[11px] text-muted pointer-events-none"
      data-tick={tick}
    >
      <span
        className="px-2 py-0.5 border border-border rounded-sm bg-[rgb(28_27_25/80%)] pointer-events-auto"
        title="블록 = 놓은 부품 수 · 관절 = 움직이는 축 수 · 태그 = PLC 신호 수"
      >
        블록 {doc.nodes.length} · 관절 {doc.joints.length} · 태그 {doc.io.length}
      </span>
      <span
        className="px-2 py-0.5 border border-border rounded-sm bg-[rgb(28_27_25/80%)] pointer-events-auto"
        title="좌표 0,0,0 은 설비 바닥면의 가운데. X 가 물건이 흘러가는 방향"
      >
        원점 = 바닥면 중심 · X 투입→배출
      </span>
      {running && rt && (
        <span className="px-2 py-0.5 border border-ok rounded-sm bg-[rgb(28_27_25/80%)] text-fg mono">
          실행 {rt.time.toFixed(1)} s · 워크 {rt.works.length}
        </span>
      )}
      {sel && (
        <span className="px-2 py-0.5 border border-line rounded-sm bg-[rgb(28_27_25/80%)] text-fg">
          선택: {sel.name}
        </span>
      )}
    </div>
  );
}
