/**
 * 공장 편집기 (13 화면 지도 C-공장, 팩토리빌더 1차): 위 작업줄 → 왼쪽 건물·설비 카드·놓인 설비 → 가운데 3D → 오른쪽 속성·흐름.
 * 머신빌더와 같은 틀. 공장 외형(바닥·벽·기둥·지붕·문)과 내부(설비 배치·흐름)를 편집한다. 모든 변경은 명령.
 */
import { useRef, useState } from 'react';
import { FactoryViewport } from '../three/FactoryViewport.js';
import { XrayToggle } from '../panels/XrayToggle.js';
import {
  BuildingPanel,
  CardsPanel,
  FlowPanel,
  FactoryProperties,
} from '../panels/FactoryPanels.js';
import { floorSize, useFactory } from '../store-factory.js';

export function FactoryBuilder() {
  const { doc, dispatch, editor, roof, setRoof, openJson } = useFactory();
  const [xray, setXray] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const [w, d] = floorSize(doc);

  const save = () => {
    dispatch({ cmd: 'save' });
    const blob = new Blob([editor.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.meta.name}.factory.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const err = openJson(await f.text());
    if (err) alert(err);
  };

  return (
    <main className="flex-1 min-h-0 flex flex-col">
      <div className="flex flex-wrap items-center gap-3 min-h-11 px-4 border-b border-border">
        <div className="flex items-center gap-2 text-muted">
          <span>공장</span>
          <span>/</span>
          <b className="text-fg">{doc.meta.name}</b>
          <span className="mono text-dim">
            {Math.round(w / 1000)} × {Math.round(d / 1000)} m · 설비 {doc.machines.length} · 흐름{' '}
            {doc.flows.length} · {editor.canUndo ? '수정됨' : '저장됨'}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <button type="button" className="btn" onClick={() => file.current?.click()}>
            factory.json 열기
          </button>
          <a
            href="#simulate"
            className="btn no-underline"
            title="공장 시뮬(DES)은 다음 단계. 지금은 설비 시뮬로"
          >
            Simulate →
          </a>
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
          className={`btn gap-1.5 cursor-pointer ${roof ? 'border-accent text-accent' : ''}`}
          title="켜면 지붕을 얹어 외형을 보고, 끄면 걷어서 안을 봅니다 (보기만 바뀜)"
        >
          <input
            type="checkbox"
            className="accent-[#f2a93b] m-0"
            checked={roof}
            onChange={(e) => setRoof(e.target.checked)}
          />
          지붕 {roof ? '켜짐' : '꺼짐'}
        </label>
        <span className="w-px h-5 bg-border mx-1.5" />
        <span className="text-dim">
          설비를 누른 채 끌면 옮겨집니다 (100 mm) · 벽·기둥·문은 누르면 선택 · 빈 곳을 끌면 화면
          회전
        </span>
        <span
          className="ml-auto mono"
          title="단위는 mm 와 도(deg), 높이 방향은 Z, 원점은 바닥 가운데"
        >
          mm · deg · Z-up · 격자 1000 mm · 원점 = 바닥 가운데
        </span>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside className="pane w-[248px] shrink-0 border-r border-border overflow-auto">
          <BuildingPanel />
          <CardsPanel />
        </aside>
        <section className="flex-1 min-w-0 relative">
          <FactoryViewport look={xray ? 'lines' : 'solid'} mode="edit" />
          <XrayToggle xray={xray} onChange={setXray} />
        </section>
        <aside className="pane w-[320px] shrink-0 border-l border-border overflow-auto">
          <FactoryProperties />
          <FlowPanel />
        </aside>
      </div>
    </main>
  );
}
