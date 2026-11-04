/**
 * 팩토리빌더 패널들: 왼쪽 건물(뼈대 숫자) · 설비 카드(놓기) · 오른쪽 속성(선택한 개체) · 아래 설비 표·흐름·명령 기록.
 * 전부 useFactory.dispatch 로 명령만 보낸다.
 */
import { useEffect, useState } from 'react';
import { DEFAULT_SHELL, polylineLength } from '@bse/engine';
import { floorSize, machineLibrary, machineOf, nextSlot, useFactory } from '../store-factory.js';

const OPENING_LABEL = {
  door: '출입문',
  shutter: '셔터',
  dock: '도크',
  emergency_exit: '비상구',
  window: '창',
} as const;
type OpeningKind = keyof typeof OPENING_LABEL;

/** 숫자 칸 하나 (m 단위) */
function Num({
  label,
  v,
  set,
  unit = 'm',
}: {
  label: string;
  v: number;
  set: (n: number) => void;
  unit?: string;
}) {
  return (
    <label className="contents">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <input
          className="field mono"
          type="number"
          step="0.5"
          min="0"
          value={v}
          onChange={(e) => set(Number(e.target.value))}
        />
        <span className="text-dim w-4">{unit}</span>
      </span>
    </label>
  );
}

/* ── 왼쪽: 건물 ── */
export function BuildingPanel() {
  const { doc, rebuildShell, create } = useFactory();
  const [w0, d0] = floorSize(doc);
  const wallH = doc.building.walls[0]?.height ?? DEFAULT_SHELL.height;
  const [w, setW] = useState(w0 / 1000);
  const [d, setD] = useState(d0 / 1000);
  const [h, setH] = useState(wallH / 1000);
  const [bx, setBx] = useState(DEFAULT_SHELL.bay[0] / 1000);
  const [by, setBy] = useState(DEFAULT_SHELL.bay[1] / 1000);
  const [name, setName] = useState(doc.meta.name);
  useEffect(() => setName(doc.meta.name), [doc.meta.name]);
  const shell = () => ({
    width: w * 1000,
    depth: d * 1000,
    height: h * 1000,
    bay: [bx * 1000, by * 1000] as [number, number],
  });
  const valid = w >= 6 && d >= 6 && h >= 3;
  const b = doc.building;
  return (
    <div className="text-xs">
      <h3 className="panel-h m-0" title="공장 외형: 바닥·벽·기둥·지붕·문을 숫자 몇 개로 올립니다">
        건물 (외형)
        <span className="ml-auto font-normal text-dim">
          벽 {b.walls.length} · 기둥 {b.columns.length} · 문 {b.openings.length}
        </span>
      </h3>
      <div className="kv p-3">
        <span>이름</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <Num label="가로 X" v={w} set={setW} />
        <Num label="세로 Y" v={d} set={setD} />
        <Num label="처마 높이" v={h} set={setH} />
        <Num label="기둥 간격 X" v={bx} set={setBx} />
        <Num label="기둥 간격 Y" v={by} set={setBy} />
      </div>
      <div className="flex gap-1.5 px-3 pb-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valid}
          title="지금 건물을 지우고 이 숫자로 다시 올립니다. 설비는 그대로 (실행 취소 가능)"
          onClick={() => rebuildShell(shell())}
        >
          건물 다시 올리기
        </button>
        <button
          type="button"
          className="btn"
          disabled={!valid}
          title="설비까지 비운 새 공장을 이 숫자로 만듭니다 (기준 설비 3종을 한 줄로 놓아 줌)"
          onClick={() => {
            if (confirm('지금 공장을 버리고 새로 만들까요? (저장하지 않은 것은 사라집니다)'))
              create(name || '새 공장', shell(), true);
          }}
        >
          새 공장
        </button>
      </div>
    </div>
  );
}

/* ── 왼쪽: 설비 카드 ── */
export function CardsPanel() {
  const { doc, dispatch } = useFactory();
  const cards = machineLibrary();
  return (
    <div className="text-xs">
      <h3 className="panel-h m-0" title="Build 에서 만든 설비 카드. 누르면 공장에 놓입니다">
        설비 카드 (내부)
        <span className="ml-auto font-normal text-dim">누르면 놓임</span>
      </h3>
      {cards.map((c) => (
        <button
          key={c.ref}
          type="button"
          className="tree-row font-sans text-xs grid grid-cols-[1fr_auto] gap-2 items-center hover:bg-[rgb(216_207_189/8%)]"
          title={`${c.doc.card.footprint[0]} × ${c.doc.card.footprint[1]} mm · 사이클 ${c.doc.card.cycle_time} s`}
          onClick={() =>
            dispatch({
              cmd: 'place_machine',
              ref: c.ref,
              transform: { position: nextSlot(doc, c.doc.card.footprint) },
            })
          }
        >
          <span>
            <b className="text-fg">{c.name}</b>
            <br />
            <span className="mono text-dim">
              {Math.round(c.doc.card.footprint[0] / 100) / 10} ×{' '}
              {Math.round(c.doc.card.footprint[1] / 100) / 10} m · 블록 {c.doc.nodes.length}
            </span>
          </span>
          <span className="text-dim">+</span>
        </button>
      ))}
      <h3 className="panel-h m-0">놓인 설비 {doc.machines.length}</h3>
      {doc.machines.length === 0 && (
        <p className="px-3 py-2 text-muted m-0">위 카드를 누르면 바닥에 놓입니다.</p>
      )}
      {doc.machines.map((m) => (
        <MachineRow key={m.id} id={m.id} prefix={m.tagPrefix} name={machineOf(m.ref)?.name} />
      ))}
    </div>
  );
}
function MachineRow({
  id,
  prefix,
  name,
}: {
  id: string;
  prefix: string;
  name: string | undefined;
}) {
  const sel = useFactory((s) => s.selection.includes(id));
  const dispatch = useFactory((s) => s.dispatch);
  return (
    <button
      type="button"
      className="tree-row"
      aria-current={sel}
      onClick={() => dispatch({ cmd: 'select', ids: [id] })}
    >
      <span className="text-fg font-semibold">{prefix}</span>{' '}
      <span className="font-sans text-muted">{name ?? '설비 없음'}</span>
    </button>
  );
}

/* ── 오른쪽: 속성 ── */
export function FactoryProperties() {
  const { doc, selection, dispatch } = useFactory();
  const id = selection[0];
  const b = doc.building;
  const m = doc.machines.find((x) => x.id === id);
  const wall = b.walls.find((x) => x.id === id);
  const col = b.columns.find((x) => x.id === id);
  const opening = b.openings.find((x) => x.id === id);
  const slab = b.slabs.find((x) => x.id === id);
  const remove = (label: string) => (
    <button
      type="button"
      className="btn mx-3 mb-3"
      onClick={() => id && dispatch({ cmd: 'remove', ids: [id] })}
    >
      {label} 지우기
    </button>
  );

  if (m) return <MachineProps inst={m} remove={remove('설비')} />;
  if (wall) return <WallProps wall={wall} remove={remove('벽')} />;
  if (opening) {
    const w = b.walls.find((x) => x.id === opening.wall);
    return (
      <div className="text-xs">
        <h3 className="panel-h m-0">{OPENING_LABEL[opening.kind]}</h3>
        <div className="kv p-3">
          <span>종류</span>
          <span>{OPENING_LABEL[opening.kind]}</span>
          <span>폭 × 높이</span>
          <span className="mono">
            {opening.width} × {opening.height} mm
          </span>
          <span>벽 시작점부터</span>
          <span className="mono">{opening.offset} mm</span>
          <span>벽</span>
          <button
            type="button"
            className="btn justify-self-start min-h-6 px-2"
            onClick={() => w && dispatch({ cmd: 'select', ids: [w.id] })}
          >
            벽 고르기
          </button>
        </div>
        {remove('개구부')}
      </div>
    );
  }
  if (col)
    return (
      <div className="text-xs">
        <h3 className="panel-h m-0">기둥</h3>
        <div className="kv p-3">
          <span>위치</span>
          <span className="mono">
            {col.position[0]}, {col.position[1]} mm
          </span>
          <span>단면</span>
          <span className="mono">
            {col.size[0]} × {col.size[1]} mm
          </span>
          <span>높이</span>
          <span className="mono">{col.height} mm</span>
        </div>
        {remove('기둥')}
      </div>
    );
  if (slab)
    return (
      <div className="text-xs">
        <h3 className="panel-h m-0">바닥</h3>
        <div className="kv p-3">
          <span>크기</span>
          <span className="mono">
            {floorSize(doc)[0]} × {floorSize(doc)[1]} mm
          </span>
          <span>두께</span>
          <span className="mono">{slab.thickness} mm</span>
          <span>층</span>
          <span>{doc.meta.levels.find((l) => l.id === slab.level)?.name ?? slab.level}</span>
        </div>
      </div>
    );
  return (
    <div className="text-xs">
      <h3 className="panel-h m-0">속성</h3>
      <p className="px-3 py-3 text-muted m-0">
        3D 에서 설비·벽·기둥·문을 클릭하거나 왼쪽 목록에서 고르세요.
      </p>
      <h3 className="panel-h m-0">이 화면 쓰는 법</h3>
      <ol className="m-0 px-3 py-3 pl-7 flex flex-col gap-1.5 text-muted">
        <li>
          <b className="text-fg">건물</b>에 가로·세로·높이·기둥 간격을 넣고 "건물 다시 올리기"를
          누르면 바닥·벽·기둥·지붕·문이 올라갑니다.
        </li>
        <li>
          <b className="text-fg">설비 카드</b>를 누르면 공장에 놓입니다. 3D 에서 누른 채 끌어 자리를
          잡고, 오른쪽에서 회전·태그 접두어를 고칩니다.
        </li>
        <li>
          아래 <b className="text-fg">흐름</b>에서 앞 설비 → 뒤 설비를 이으면 자재 흐름이 화살표로
          보입니다.
        </li>
        <li>
          <b className="text-fg">X-ray</b>로 벽을 뚫어 보고, "지붕 얹음"으로 외형을 봅니다.
        </li>
      </ol>
      <h3 className="panel-h m-0">공장</h3>
      <div className="kv p-3">
        <span>이름</span>
        <span>{doc.meta.name}</span>
        <span>층</span>
        <span>{doc.meta.levels.map((l) => l.name).join(', ')}</span>
        <span>설비</span>
        <span className="mono">
          {doc.machines.length} 대 · 흐름 {doc.flows.length}
        </span>
      </div>
    </div>
  );
}

function MachineProps({
  inst,
  remove,
}: {
  inst: ReturnType<typeof useFactory.getState>['doc']['machines'][number];
  remove: React.ReactNode;
}) {
  const dispatch = useFactory((s) => s.dispatch);
  const entry = machineOf(inst.ref);
  const p = inst.transform.position;
  const rz = inst.transform.rotation[2];
  const [x, setX] = useState(String(p[0]));
  const [y, setY] = useState(String(p[1]));
  useEffect(() => {
    setX(String(p[0]));
    setY(String(p[1]));
  }, [p[0], p[1]]);
  const move = () => {
    const nx = Number(x);
    const ny = Number(y);
    if (Number.isFinite(nx) && Number.isFinite(ny) && (nx !== p[0] || ny !== p[1]))
      dispatch({ cmd: 'move', id: inst.id, transform: { position: [nx, ny, p[2]] } });
  };
  const rotate = (dz: number) =>
    dispatch({
      cmd: 'move',
      id: inst.id,
      transform: { rotation: [0, 0, (((rz + dz) % 360) + 360) % 360] },
    });
  const card = { ...(entry?.doc.card ?? {}), ...inst.cardOverride };
  return (
    <div className="text-xs">
      <h3 className="panel-h m-0">
        <span className="mono">{inst.tagPrefix}</span> {entry?.name ?? '설비 없음'}
      </h3>
      <div className="kv p-3">
        <span>위치 X</span>
        <span className="flex items-center gap-1">
          <input
            className="field mono"
            value={x}
            onChange={(e) => setX(e.target.value)}
            onBlur={move}
            onKeyDown={(e) => e.key === 'Enter' && move()}
          />
          <span className="text-dim">mm</span>
        </span>
        <span>위치 Y</span>
        <span className="flex items-center gap-1">
          <input
            className="field mono"
            value={y}
            onChange={(e) => setY(e.target.value)}
            onBlur={move}
            onKeyDown={(e) => e.key === 'Enter' && move()}
          />
          <span className="text-dim">mm</span>
        </span>
        <span>회전</span>
        <span className="flex items-center gap-1">
          <span className="mono w-10">{rz}°</span>
          <button type="button" className="btn min-h-6 px-2" onClick={() => rotate(-90)}>
            ↺ 90°
          </button>
          <button type="button" className="btn min-h-6 px-2" onClick={() => rotate(90)}>
            ↻ 90°
          </button>
        </span>
        <span>태그 접두어</span>
        <span
          className="mono"
          title="이 설비의 PLC 태그는 전부 이 접두어 뒤에 붙습니다 (ST01.M1.CV1_RUN)"
        >
          {inst.tagPrefix}
        </span>
        <span>참조</span>
        <span className="mono truncate" title={inst.ref}>
          {entry?.doc.meta.name ?? '?'} v{inst.ref.split('@')[1]}
        </span>
        <span>바닥</span>
        <span className="mono">
          {card.footprint ? `${card.footprint[0]} × ${card.footprint[1]} mm` : '—'}
        </span>
        <span>사이클</span>
        <span className="mono">
          {card.cycle_time ?? '—'} s · 양품률{' '}
          {card.ok_rate !== undefined ? Math.round(card.ok_rate * 100) : '—'}%
        </span>
      </div>
      {remove}
      {entry && (
        <p className="px-3 text-dim m-0">
          설비 자체(블록·관절·태그)는 Machine 빌더에서 고칩니다. 공장에는 참조만 들어갑니다.
        </p>
      )}
    </div>
  );
}

function WallProps({
  wall,
  remove,
}: {
  wall: ReturnType<typeof useFactory.getState>['doc']['building']['walls'][number];
  remove: React.ReactNode;
}) {
  const { doc, dispatch } = useFactory();
  const L = Math.round(polylineLength(wall.polyline));
  const ops = doc.building.openings.filter((o) => o.wall === wall.id);
  const [kind, setKind] = useState<OpeningKind>('door');
  const [offset, setOffset] = useState('1000');
  const SIZE: Record<OpeningKind, [number, number]> = {
    door: [1200, 2400],
    shutter: [4000, 4500],
    dock: [3000, 3500],
    emergency_exit: [1000, 2400],
    window: [2000, 1200],
  };
  const add = () => {
    const [w, h] = SIZE[kind];
    const r = dispatch({
      cmd: 'add_opening',
      wall: wall.id,
      kind,
      offset: Number(offset),
      width: w,
      height: Math.min(h, wall.height - 300),
    });
    if (!r.ok) alert(r.error);
  };
  return (
    <div className="text-xs">
      <h3 className="panel-h m-0">벽</h3>
      <div className="kv p-3">
        <span>길이</span>
        <span className="mono">
          {L} mm · {wall.polyline.length - 1} 변
        </span>
        <span>높이</span>
        <span className="mono">{wall.height} mm</span>
        <span>두께</span>
        <span className="mono">{wall.thickness} mm</span>
      </div>
      <h3 className="panel-h m-0">개구부 {ops.length}</h3>
      {ops.map((o) => (
        <button
          key={o.id}
          type="button"
          className="tree-row font-sans text-xs"
          onClick={() => dispatch({ cmd: 'select', ids: [o.id] })}
        >
          {OPENING_LABEL[o.kind]}{' '}
          <span className="mono text-dim">
            @{o.offset} · {o.width} × {o.height}
          </span>
        </button>
      ))}
      <div className="kv p-3">
        <span>종류</span>
        <select
          className="field"
          value={kind}
          onChange={(e) => setKind(e.target.value as OpeningKind)}
        >
          {(Object.keys(OPENING_LABEL) as OpeningKind[]).map((k) => (
            <option key={k} value={k}>
              {OPENING_LABEL[k]}
            </option>
          ))}
        </select>
        <span title="벽 폴리라인의 시작점에서 잰 거리. 둘레 벽은 (-X,-Y) 모서리에서 시계 반대 방향">
          시작점부터
        </span>
        <span className="flex items-center gap-1">
          <input
            className="field mono"
            value={offset}
            onChange={(e) => setOffset(e.target.value)}
          />
          <span className="text-dim">mm</span>
        </span>
      </div>
      <button type="button" className="btn btn-primary mx-3 mb-3" onClick={add}>
        + {OPENING_LABEL[kind]} 내기
      </button>
      {remove}
    </div>
  );
}

/* ── 아래: 설비 표 · 흐름 · 명령 기록 ── */
export function FactoryBottom() {
  const { doc, selection, dispatch, log } = useFactory();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const name = (id: string) => {
    const m = doc.machines.find((x) => x.id === id);
    return m ? `${m.tagPrefix} ${machineOf(m.ref)?.name ?? ''}` : '?';
  };
  const connect = () => {
    if (!from || !to) return;
    const r = dispatch({ cmd: 'connect_flow', from: `${from}.out`, to: `${to}.in` });
    if (!r.ok) alert(r.error);
  };
  return (
    <div className="h-full grid text-xs grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0 flex flex-col overflow-hidden border-r border-border">
        <h3 className="panel-h m-0">
          설비 표 <span className="font-normal text-muted">{doc.machines.length} 대</span>
          <span className="ml-auto font-normal text-dim">행을 누르면 선택</span>
        </h3>
        <div className="overflow-auto flex-1">
          <table className="tbl">
            <thead>
              <tr>
                <th>접두어</th>
                <th>설비</th>
                <th className="text-right">X</th>
                <th className="text-right">Y</th>
                <th className="text-right">회전</th>
                <th className="text-right">사이클</th>
                <th>등급</th>
              </tr>
            </thead>
            <tbody>
              {doc.machines.map((m) => {
                const e = machineOf(m.ref);
                return (
                  <tr
                    key={m.id}
                    className={`cursor-pointer hover:bg-[rgb(216_207_189/6%)] ${
                      selection.includes(m.id) ? 'bg-[rgb(216_207_189/12%)]' : ''
                    }`}
                    onClick={() => dispatch({ cmd: 'select', ids: [m.id] })}
                  >
                    <td className="mono font-semibold text-fg">{m.tagPrefix}</td>
                    <td>{e?.name ?? '설비 없음'}</td>
                    <td className="text-right mono">{m.transform.position[0]}</td>
                    <td className="text-right mono">{m.transform.position[1]}</td>
                    <td className="text-right mono">{m.transform.rotation[2]}°</td>
                    <td className="text-right mono">{e ? `${e.doc.card.cycle_time} s` : '—'}</td>
                    <td>{m.fidelityOverride ?? e?.doc.meta.fidelity ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="min-w-0 grid grid-rows-[minmax(0,3fr)_minmax(0,2fr)] overflow-hidden">
        <div className="min-h-0 flex flex-col overflow-hidden border-b border-border">
          <h3 className="panel-h m-0">
            흐름 <span className="font-normal text-muted">{doc.flows.length}</span>
            <span className="ml-auto mr-14 flex items-center gap-1">
              <select
                className="field min-h-6 w-32"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="출발 설비"
              >
                <option value="">출발 설비</option>
                {doc.machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {name(m.id)}
                  </option>
                ))}
              </select>
              <span className="text-dim">→</span>
              <select
                className="field min-h-6 w-32"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="도착 설비"
              >
                <option value="">도착 설비</option>
                {doc.machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {name(m.id)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary min-h-6 px-2 text-[11px] whitespace-nowrap"
                disabled={!from || !to || from === to}
                onClick={connect}
              >
                잇기
              </button>
            </span>
          </h3>
          <ul className="overflow-auto flex-1 m-0 p-0 list-none">
            {doc.flows.length === 0 && (
              <li className="px-3 py-2 text-muted">
                아직 흐름이 없습니다. 출발 → 도착 설비를 골라 "잇기".
              </li>
            )}
            {doc.flows.map((f) => (
              <li key={f.id} className="px-3 py-1.5 border-b border-border flex items-center gap-2">
                <span className="truncate">
                  {name(f.from.split('.')[0] ?? '')} <span className="text-accent">→</span>{' '}
                  {name(f.to.split('.')[0] ?? '')}
                </span>
                <button
                  type="button"
                  className="btn ml-auto min-h-6 px-2 text-[11px]"
                  onClick={() => dispatch({ cmd: 'remove', ids: [f.id] })}
                >
                  끊기
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-h-0 flex flex-col overflow-hidden">
          <h3 className="panel-h m-0">
            명령 기록 <span className="font-normal text-muted">{log.length}</span>
          </h3>
          <ul className="overflow-auto flex-1 m-0 p-0 list-none mono">
            {[...log].reverse().map((e, i) => (
              <li
                key={i}
                className={`px-3 py-0.5 truncate ${e.result.ok ? 'text-muted' : 'text-alarm'}`}
                title={JSON.stringify(e.cmd)}
              >
                {e.cmd.cmd}
                {e.result.ok ? '' : ` ✗ ${e.result.error}`}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
