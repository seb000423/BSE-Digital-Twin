/** 오른쪽: 선택한 블록의 파라미터 폼(블록 정의에서 생성) · 치수 표(verified 표시) · 관절 · 등급. 모든 변경은 명령 */
import type { ParamDef } from '@bse/schema';
import { lib, prefixOf, useEditor } from '../store.js';

export function Properties() {
  const { doc, selection, dispatch } = useEditor();
  const node = doc.nodes.find((n) => n.id === selection[0]);
  if (!node || node.type !== 'block' || !node.blockType) {
    return (
      <div className="text-xs">
        <h3 className="panel-h m-0">속성</h3>
        <p className="px-3 py-3 text-muted">
          3D 에서 블록을 클릭하거나 왼쪽 노드 트리에서 고르세요.
        </p>
        <h3 className="panel-h m-0">이 화면 쓰는 법</h3>
        <ol className="m-0 px-3 py-3 pl-7 flex flex-col gap-1.5 text-muted">
          <li>
            <b className="text-fg">왼쪽 팔레트</b>에서 블록을 누르면 바닥에 놓입니다. 컨베이어를
            고른 상태면 센서·스토퍼는 그 위에 놓입니다.
          </li>
          <li>
            <b className="text-fg">3D</b>에서 블록을 누른 채 끌면 옮겨집니다 (50 mm 단위). 빈 곳을
            끌면 화면이 돌고, 휠은 확대입니다.
          </li>
          <li>
            블록을 고르면 <b className="text-fg">여기</b>에 길이·속도 같은 숫자가 나옵니다. 고치면
            3D 가 바로 바뀝니다.
          </li>
          <li>
            위의 <b className="text-fg">실행</b>을 누르면 설비가 움직이고, 아래 신호 표에서 태그를
            켜고 끌 수 있습니다.
          </li>
        </ol>
        <h3 className="panel-h m-0">설비</h3>
        <div className="kv p-3">
          <span>이름</span>
          <span>{doc.meta.name}</span>
          <span>외곽</span>
          <span className="mono">{doc.meta.bbox.join(' × ')} mm</span>
          <span>카드</span>
          <span className="mono">
            사이클 {doc.card.cycle_time} s · 양품률 {Math.round(doc.card.ok_rate * 100)}%
          </span>
        </div>
      </div>
    );
  }
  const def = lib.require(node.blockType).def;
  const joints = doc.joints.filter((j) => j.node === node.id);
  const prefix = prefixOf(doc, node.id);
  const set = (key: string, value: number | string | boolean) =>
    dispatch({ cmd: 'set_param', id: node.id, key, value });

  return (
    <div className="text-xs">
      <h3 className="panel-h m-0">
        속성 <span className="ml-auto mono text-fg">{prefix}</span>
      </h3>
      <div className="p-3 flex flex-col gap-2 border-b border-border">
        <input
          className="field font-semibold"
          value={node.name}
          aria-label="이름"
          onChange={(e) =>
            dispatch({ cmd: 'rename', id: node.id, name: e.target.value || node.name })
          }
        />
        <div className="text-muted">
          {def.meta.name} <span className="mono text-dim">{def.meta.id}</span>
        </div>
        <div className="kv">
          {def.params.map((p) => (
            <ParamField
              key={p.key}
              p={p}
              value={node.params[p.key]}
              onChange={(v) => set(p.key, v)}
            />
          ))}
        </div>
        <div className="kv pt-1">
          <span>위치 mm</span>
          <span className="flex gap-1">
            {([0, 1, 2] as const).map((i) => (
              <input
                key={`${i}:${node.transform.position[i]}`}
                className="field mono px-1"
                type="number"
                step={50}
                aria-label={`위치 ${'XYZ'[i]}`}
                title={['X 투입→배출', 'Y 좌측', 'Z 높이'][i]}
                defaultValue={node.transform.position[i]}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v) || v === node.transform.position[i]) return;
                  const position = [...node.transform.position] as [number, number, number];
                  position[i] = v;
                  dispatch({ cmd: 'move', id: node.id, transform: { position } });
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
            ))}
          </span>
          <span>회전</span>
          <span className="flex gap-1 items-center">
            <span className="mono">{node.transform.rotation[2]}°</span>
            <button
              type="button"
              className="btn min-h-6 px-2"
              title="위에서 봤을 때 반시계로 90° 돌리기"
              onClick={() =>
                dispatch({
                  cmd: 'move',
                  id: node.id,
                  transform: {
                    rotation: [
                      node.transform.rotation[0],
                      node.transform.rotation[1],
                      (node.transform.rotation[2] + 90) % 360,
                    ],
                  },
                })
              }
            >
              ↻ 90°
            </button>
          </span>
        </div>
        <div className="flex gap-1.5 pt-1">
          <button
            type="button"
            className="btn"
            onClick={() => dispatch({ cmd: 'duplicate', ids: [node.id], offset: [0, 800, 0] })}
          >
            복제
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => dispatch({ cmd: 'remove', ids: [node.id] })}
          >
            삭제
          </button>
        </div>
      </div>

      {def.geometry.dimTable.length > 0 && (
        <>
          <h3 className="panel-h m-0">
            치수 표{' '}
            <span className="ml-auto font-normal text-warn">
              ● 미확인 {def.geometry.dimTable.filter((r) => !r.verified).length}
            </span>
          </h3>
          <table className="tbl">
            <tbody>
              {def.geometry.dimTable.map((r) => (
                <tr key={r.key}>
                  <td>{r.key}</td>
                  <td className="mono text-muted">
                    {Object.entries(r.values)
                      .map(([k, v]) => `${k} ${v}`)
                      .join(' · ')}
                  </td>
                  <td className={r.verified ? 'text-ok' : 'text-warn'}>{r.verified ? '✓' : '?'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {joints.length > 0 && (
        <>
          <h3 className="panel-h m-0">
            관절 <span className="ml-auto font-normal">{joints.length}</span>
          </h3>
          {joints.map((j, i) => (
            <div key={j.id} className="kv px-3 py-2 border-b border-border">
              <span>종류</span>
              <span className="mono">
                {j.type} · {j.mode} · 축 [{j.axis.join(', ')}]
              </span>
              <span>범위</span>
              <span className="mono">
                {j.min} ~ {j.max ?? '—'} {j.type === 'rot' ? 'deg' : j.type === 'lin' ? 'mm' : ''}
              </span>
              <span>속도 vmax</span>
              <span className="mono">
                <input
                  className="field w-24 inline-block mr-1"
                  type="number"
                  value={j.vmax}
                  aria-label={`관절 ${i + 1} vmax`}
                  onChange={(e) =>
                    dispatch({
                      cmd: 'set_joint',
                      id: j.id,
                      patch: { vmax: Number(e.target.value) || j.vmax },
                    })
                  }
                />
                <i className={`dot ${j.verified.vmax ? 'bg-ok' : 'bg-warn'}`} />
                {j.verified.vmax ? '확인됨' : '미확인'}
              </span>
              <span>가속 amax</span>
              <span className="mono">
                <input
                  className="field w-24 inline-block mr-1"
                  type="number"
                  value={j.amax}
                  aria-label={`관절 ${i + 1} amax`}
                  onChange={(e) =>
                    dispatch({
                      cmd: 'set_joint',
                      id: j.id,
                      patch: { amax: Number(e.target.value) || j.amax },
                    })
                  }
                />
                <i className={`dot ${j.verified.amax ? 'bg-ok' : 'bg-warn'}`} />
                {j.verified.amax ? '확인됨' : '미확인'}
              </span>
            </div>
          ))}
        </>
      )}

      <h3 className="panel-h m-0">등급</h3>
      <div className="p-3">
        <span className="seg" role="group" aria-label="fidelity">
          {(['L1', 'L2', 'L3'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={doc.meta.fidelity === f}
              disabled={f === 'L3'}
              onClick={() => dispatch({ cmd: 'set_fidelity', fidelity: f })}
            >
              {f} {f === 'L1' ? '카드' : f === 'L2' ? '동작' : '정밀'}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}

function ParamField({
  p,
  value,
  onChange,
}: {
  p: ParamDef;
  value: unknown;
  onChange: (v: number | string | boolean) => void;
}) {
  const label = (
    <span>
      {p.label}
      {p.unit ? <span className="text-dim"> {p.unit}</span> : null}
    </span>
  );
  if (p.type === 'enum')
    return (
      <>
        {label}
        <select
          className="field"
          value={String(value ?? p.default ?? '')}
          onChange={(e) => onChange(e.target.value)}
        >
          {p.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </>
    );
  if (p.type === 'boolean')
    return (
      <>
        {label}
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      </>
    );
  return (
    <>
      {label}
      <input
        className="field mono"
        type="number"
        step={p.type === 'integer' ? 1 : 'any'}
        min={p.min}
        max={p.max}
        defaultValue={String(value ?? p.default ?? '')}
        key={String(value)}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n !== value) onChange(n);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </>
  );
}
