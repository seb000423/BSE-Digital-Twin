/**
 * 홈 (13 화면 지도 B, 04 §9.3): 한 페이지에 설비 · 공장 · 최근 실행을 같은 패널로 쌓는다.
 * 패널 머리글 오른쪽에 그 패널의 "새로 만들기" 하나씩. 카드·행을 누르면 그 화면으로 이어진다.
 */
import { useMemo, useRef } from 'react';
import { MACHINE_TEMPLATES } from '@bse/engine';
import { Thumb } from '../panels/Thumb.js';
import { lib, templateDoc, useEditor, type OpenSource } from '../store.js';

const GRADE: Record<string, string> = {
  'conveyor-station': 'L2',
  'pick-place-cell': 'L2',
  'press-station': 'L1',
};

export function Home() {
  const open = useEditor((s) => s.open);
  const openJson = useEditor((s) => s.openJson);
  const file = useRef<HTMLInputElement>(null);
  const docs = useMemo(() => MACHINE_TEMPLATES.map((t) => ({ t, doc: templateDoc(t.id) })), []);

  const go = (src: OpenSource) => {
    open(src);
    location.hash = '#machine';
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const err = openJson(await f.text());
    if (err) alert(err);
    else location.hash = '#machine';
  };

  return (
    <main
      className="flex-1 overflow-auto px-4 py-6 max-w-[1360px] w-full mx-auto flex flex-col gap-5"
      style={{
        background: 'radial-gradient(ellipse 70% 65% at 50% 58%, var(--color-glow), transparent)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-bold leading-10">BSE Studio</h1>
          <p className="m-0 text-xs text-muted">
            설비를 만들고(Build) → 돌려 보고(Simulate) → 현장과 맞춘다(Evolve)
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <button type="button" className="btn h-10 px-4" onClick={() => file.current?.click()}>
            저장한 설비 열기 (machine.json)
          </button>
        </div>
      </div>

      <section className="panel border border-border rounded-sm bg-[rgb(22_57_92/45%)]">
        <h2 className="panel-h m-0 min-h-11 text-sm text-fg">
          설비 <span className="font-normal text-muted">{docs.length}</span>
          <span className="text-muted font-normal">
            · 블록 {lib.size}종으로 조립 · Build 에서 편집
          </span>
          <button
            type="button"
            className="btn btn-primary ml-auto min-h-8"
            onClick={() => go('blank')}
          >
            + 새 설비
          </button>
        </h2>
        <div className="grid gap-4 p-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map(({ t, doc }) => {
            const unverified = doc.joints.filter(
              (j) => !j.verified.vmax || !j.verified.amax,
            ).length;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => go(t.id)}
                className="grid gap-2 p-3 border border-border rounded-sm bg-[rgb(15_42_69/55%)] text-fg text-left cursor-pointer hover:border-line"
                title="Build 에서 연다"
              >
                <div className="h-[130px] border border-[rgb(207_228_245/25%)] rounded-sm bg-bg bg-[linear-gradient(rgb(207_228_245/12%)_1px,transparent_1px),linear-gradient(90deg,rgb(207_228_245/12%)_1px,transparent_1px)] bg-[size:18px_18px] text-line p-2">
                  <Thumb doc={doc} className="w-full h-full" />
                </div>
                <div className="flex items-center justify-between font-bold text-sm">
                  <span>{t.name}</span>
                  <span className="text-[11px] font-bold px-1.5 border border-line rounded-sm text-line">
                    {GRADE[t.id]}
                  </span>
                </div>
                <div className="text-xs text-muted leading-[18px]">
                  {t.summary}
                  <br />
                  <span className="mono">
                    {t.bbox[0]} × {t.bbox[1]} mm · 블록 {doc.nodes.length} · 태그 {doc.io.length}
                  </span>
                </div>
                <div className="text-xs text-muted">
                  <i className={`dot ${unverified ? 'bg-warn' : 'bg-ok'}`} />
                  {unverified ? `관절 속도 미확인 ${unverified}건 · 치수 예시값` : '치수 확인됨'}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 grid-cols-1 lg:grid-cols-2">
        <div className="panel border border-border rounded-sm bg-[rgb(22_57_92/45%)]">
          <h2 className="panel-h m-0 min-h-11 text-sm text-fg">
            공장 <span className="font-normal text-muted">2</span>
            <span className="text-muted font-normal">· 예시 · 3단계에서 만듭니다</span>
            <a href="#factory" className="btn ml-auto min-h-8 no-underline">
              + 새 공장
            </a>
          </h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>이름</th>
                <th className="text-right">설비</th>
                <th className="text-right">바닥</th>
                <th className="text-right">수정</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['2공장 A라인', '12대', '48 × 30 m', '오늘 14:02'],
                ['신규 라인 검토안', '7대', '30 × 24 m', '어제'],
              ].map((r) => (
                <tr
                  key={r[0]}
                  className="cursor-pointer hover:bg-[rgb(220_235_247/6%)]"
                  onClick={() => (location.hash = '#factory')}
                >
                  <td className="font-semibold">{r[0]}</td>
                  <td className="text-right">{r[1]}</td>
                  <td className="text-right mono">{r[2]}</td>
                  <td className="text-right text-muted">{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel border border-border rounded-sm bg-[rgb(22_57_92/45%)]">
          <h2 className="panel-h m-0 min-h-11 text-sm text-fg">
            최근 실행 <span className="font-normal text-muted">2</span>
            <span className="text-muted font-normal">· 예시 · 정식 실행은 4단계</span>
            <a href="#simulate" className="btn ml-auto min-h-8 no-underline">
              Simulate 열기
            </a>
          </h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>시나리오</th>
                <th className="text-right">결과</th>
                <th className="text-right">상태</th>
              </tr>
            </thead>
            <tbody>
              <tr
                className="cursor-pointer hover:bg-[rgb(220_235_247/6%)]"
                onClick={() => (location.hash = '#simulate')}
              >
                <td>
                  <b>A라인 — 버퍼 3 vs 5</b> <span className="text-muted">· 8 h × 10회</span>
                </td>
                <td className="text-right mono text-line">412 → 436 개/h</td>
                <td className="text-right text-muted">
                  <i className="dot bg-ok" />
                  완료
                </td>
              </tr>
              <tr
                className="cursor-pointer hover:bg-[rgb(220_235_247/6%)]"
                onClick={() => (location.hash = '#simulate')}
              >
                <td>
                  <b>신규 라인 — 로봇 1대 vs 2대</b>{' '}
                  <span className="text-muted">· 8 h × 10회</span>
                </td>
                <td className="text-right mono text-line">진행 중 6/10</td>
                <td className="text-right text-muted">
                  <i className="dot bg-warn" />
                  진행
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
