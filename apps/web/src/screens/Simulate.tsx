/**
 * Simulate (13 화면 지도 C 실행 모드의 보기 화면): 지금 연 설비를 실사풍(또는 X-ray 선화)으로 돌려 본다.
 * 들어오면 바로 데모 실행을 켠다 (startDemo: RUN/START 류 태그 + 자동 운전). 아래는 신호 표 · 수동 조작 (Build 와 같은 패널).
 */
import { useEffect, useRef, useState } from 'react';
import { Viewport } from '../three/Viewport.js';
import { BottomPanel } from '../panels/BottomPanel.js';
import { Dock } from '../panels/Dock.js';
import { Transport } from '../panels/Transport.js';
import { startDemo, useEditor } from '../store.js';
import { useLiveTick } from './MachineBuilder.js';
import { XrayToggle } from '../panels/XrayToggle.js';

export function Simulate() {
  const { doc, speed } = useEditor();
  const tick = useLiveTick();
  const rt = useEditor.getState().runtime();
  const [xray, setXray] = useState(false);
  const start = startDemo;
  // 처음 들어올 때 한 번만 데모를 켠다
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!useEditor.getState().running) start();
  });

  return (
    <main className="flex-1 min-h-0 flex flex-col">
      <div className="flex flex-wrap items-center gap-3 min-h-11 px-4 border-b border-border">
        <div className="flex items-center gap-2 text-muted">
          <span>Simulate</span>
          <span>/</span>
          <b className="text-fg">{doc.meta.name}</b>
          <span className="mono text-dim">데모 시뮬 · 브라우저 · 10 ms 틱</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Transport onPlay={start} />
          <span className="w-px h-6 bg-border" />
          <a href="#machine" className="btn no-underline" title="이 설비를 Build 에서 고칩니다">
            Build 에서 편집 →
          </a>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative" data-tick={tick}>
        <Viewport look={xray ? 'lines' : 'lit'} />
        <XrayToggle xray={xray} onChange={setXray} />
        <div className="absolute left-3 top-2.5 flex flex-col gap-0.5 text-[11px] mono text-muted pointer-events-none">
          <span>
            TIME <b className="text-fg">{rt ? rt.time.toFixed(1) : '0.0'}</b> s · ×{speed}
          </span>
          <span>
            WORKS <b className="text-fg">{rt ? rt.works.length : 0}</b> · TAGS{' '}
            <b className="text-fg">{doc.io.length}</b>
          </span>
          <span>
            {rt ? (
              <>
                ON{' '}
                <b className="text-fg">
                  {doc.io
                    .filter((e) => rt.signals.get(e.tag) === true)
                    .map((e) => e.tag)
                    .join(' ') || '—'}
                </b>
              </>
            ) : (
              '정지'
            )}
          </span>
        </div>
        <div className="absolute right-3 bottom-2.5 text-[11px] text-dim pointer-events-none">
          {xray ? 'X-ray 보기 (투시 선화)' : '실사풍 보기'} · 끌면 돌려 보기 · 휠은 확대
        </div>
      </div>

      <Dock>
        <BottomPanel />
      </Dock>
    </main>
  );
}
