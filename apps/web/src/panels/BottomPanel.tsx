/** 아래: 신호 표(실행 중 실시간 값) · 수동 조작 패널(force_tag) · 명령 기록 */
import { useRef, useState } from 'react';
import { useLiveTick } from '../screens/MachineBuilder.js';
import { prefixOf, useEditor } from '../store.js';

export function BottomPanel() {
  const { doc, selection, dispatch, running, log } = useEditor();
  useLiveTick();
  const rt = useEditor.getState().runtime();
  const prefix = selection[0] ? prefixOf(doc, selection[0]) : '';
  const rows = prefix ? doc.io.filter((e) => e.tag.startsWith(prefix + '_')) : doc.io;
  const outs = rows.filter((e) => e.dir === 'out');
  const val = (tag: string): string => {
    if (!rt || !rt.signals.has(tag)) return '—';
    const v = rt.signals.get(tag);
    return typeof v === 'boolean' ? (v ? '1' : '0') : String(Math.round(v * 10) / 10);
  };
  const force = (tag: string, type: string) => {
    if (!rt) return;
    if (type === 'bool') dispatch({ cmd: 'force_tag', tag, value: rt.signals.get(tag) !== true });
    else {
      const s = prompt(`${tag} 값`, String(rt.signals.get(tag)));
      if (s !== null && Number.isFinite(Number(s)))
        dispatch({ cmd: 'force_tag', tag, value: Number(s) });
    }
  };

  // 두 칸 사이 세로 손잡이: 왼쪽(신호 표) 비율 35~80%
  const [left, setLeft] = useState(0.66);
  const box = useRef<HTMLDivElement>(null);
  const onSplit = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = box.current;
    if (!el || e.buttons !== 1) return;
    const r = el.getBoundingClientRect();
    setLeft(Math.min(0.8, Math.max(0.35, (e.clientX - r.left) / r.width)));
  };

  return (
    <div
      ref={box}
      className="h-full grid text-xs"
      style={{ gridTemplateColumns: `minmax(0,${left}fr) 6px minmax(0,${1 - left}fr)` }}
    >
      <div className="min-w-0 flex flex-col overflow-hidden">
        <h3 className="panel-h m-0">
          신호 표{' '}
          <span className="font-normal">
            {prefix ? `${prefix} · ${rows.length}개` : `전체 ${doc.io.length}개`}
          </span>
          <span className="ml-auto flex gap-1.5">
            <button
              type="button"
              className="btn min-h-6 px-2 text-[11px]"
              disabled
              title="I/O 엑셀은 다음 묶음"
            >
              I/O 엑셀 붙여넣기
            </button>
            <button
              type="button"
              className="btn min-h-6 px-2 text-[11px]"
              disabled
              title="다음 묶음"
            >
              내보내기
            </button>
          </span>
        </h3>
        <div className="overflow-auto flex-1">
          <table className="tbl mono">
            <thead>
              <tr>
                <th>태그</th>
                <th>방향</th>
                <th>형식</th>
                <th>연결</th>
                <th>값</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.tag}>
                  <td>{e.tag}</td>
                  <td className="text-muted">{e.dir.toUpperCase()}</td>
                  <td className="text-muted">{e.type.toUpperCase()}</td>
                  <td className={e.binding ? '' : 'text-warn'}>
                    {e.binding ? e.binding.kind : '미연결'}
                  </td>
                  <td>
                    {running ? (
                      <>
                        <i
                          className={`dot ${val(e.tag) === '1' ? 'bg-ok' : val(e.tag) === '0' ? 'border border-muted' : 'bg-line'}`}
                        />
                        {val(e.tag)}
                      </>
                    ) : (
                      <span className="text-dim">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="신호 표 너비"
        title="끌어서 너비 조절"
        className="cursor-col-resize bg-[rgb(200_225_245/10%)] hover:bg-[rgb(200_225_245/35%)]"
        onPointerDown={(e) => (e.target as Element).setPointerCapture(e.pointerId)}
        onPointerMove={onSplit}
      />
      <div className="min-w-0 flex flex-col overflow-hidden">
        <h3 className="panel-h m-0">수동 조작 · 명령 기록</h3>
        <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-border">
          {running ? (
            outs.slice(0, 12).map((e) => (
              <button
                key={e.tag}
                type="button"
                className="btn min-h-7 px-2 mono"
                aria-pressed={val(e.tag) === '1'}
                onClick={() => force(e.tag, e.type)}
              >
                {e.tag.replace(prefix ? prefix + '_' : '', '')}{' '}
                {e.type === 'bool' ? (val(e.tag) === '1' ? '●' : '○') : val(e.tag)}
              </button>
            ))
          ) : (
            <span className="text-muted">
              위의 모드에서 "실행"을 누르면 태그를 켜고 끌 수 있습니다.
            </span>
          )}
        </div>
        <div className="overflow-auto flex-1 px-3 py-1.5 mono leading-5">
          {[...log].reverse().map((l, i) => (
            <div key={i} className={l.result.ok ? '' : 'text-alarm'}>
              <span className="text-dim">{l.cmd.cmd}</span> {JSON.stringify(stripCmd(l.cmd))}
              {!l.result.ok && ` → ${l.result.error}`}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function stripCmd(cmd: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(cmd).filter(([k]) => k !== 'cmd'));
}
