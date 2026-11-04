/**
 * 아래 패널 틀: 위쪽 가로 손잡이를 끌어 높이를 바꾸고(최소 120px · 최대 화면의 70%), 오른쪽 단추로 접는다.
 * 높이는 이 브라우저에 기억한다. 두 번 누르면 기본 높이(220px).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

const KEY = 'bse.dock.height';
const DEFAULT = 300;
const MIN = 120;
const HEAD = 40;

function read(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return v >= MIN ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function Dock({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState(read);
  const [open, setOpen] = useState(true);
  const drag = useRef<{ y: number; h: number } | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, String(height));
    } catch {
      /* 저장 못 해도 이번 방문엔 적용 */
    }
  }, [height]);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { y: e.clientY, h: height };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const max = Math.round(window.innerHeight * 0.7);
    const h = Math.min(max, Math.max(MIN, drag.current.h + (drag.current.y - e.clientY)));
    setHeight(h);
    if (!open) setOpen(true);
  };
  const onUp = () => (drag.current = null);

  return (
    <div
      className="pane shrink-0 border-t border-border overflow-hidden flex flex-col"
      style={{ height: open ? height : HEAD }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="아래 패널 높이"
        title="끌어서 높이 조절 · 두 번 누르면 기본 높이"
        className="h-1.5 shrink-0 cursor-row-resize bg-[rgb(216_207_189/10%)] hover:bg-[rgb(216_207_189/35%)] relative"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onDoubleClick={() => setHeight(DEFAULT)}
      >
        <button
          type="button"
          className="absolute right-2 -top-0.5 h-6 px-2 text-[11px] text-muted hover:text-fg bg-bg border border-border rounded-sm cursor-pointer z-10"
          onClick={() => setOpen((o) => !o)}
          onPointerDown={(e) => e.stopPropagation()}
          title={open ? '아래 패널 접기' : '아래 패널 펼치기'}
        >
          {open ? '▾ 접기' : '▴ 펼치기'}
        </button>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
