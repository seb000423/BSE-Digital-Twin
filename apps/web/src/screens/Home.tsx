/** 홈 (13 화면 지도 B, 04 §9.3): 제목 줄 + 설비 라이브러리 패널 + 공장 표 · 최근 실행 결과 표. 값은 시연용 */
import { lib } from '../store.js';

const CARDS = [
  {
    name: '컨베이어 스테이션',
    grade: 'L2',
    meta: '사이클 12.0 s · 양품률 99.2%',
    size: '3000 × 800 mm',
    dot: 'bg-ok',
    stat: '치수 확인됨 · 태그 14개',
  },
  {
    name: '픽앤플레이스 셀',
    grade: 'L2',
    meta: '사이클 4.5 s · 양품률 99.8%',
    size: '1800 × 1800 mm',
    dot: 'bg-warn',
    stat: '관절 속도 미확인 2건',
  },
  {
    name: '프레스 스테이션',
    grade: 'L1',
    meta: '사이클 8.0 s · 양품률 98.5%',
    size: '2400 × 2000 mm',
    dot: 'bg-muted',
    stat: '카드만 있음 (상자 + 수치)',
  },
];

export function Home() {
  return (
    <main
      className="flex-1 overflow-auto px-4 py-6 max-w-[1360px] w-full mx-auto flex flex-col gap-5"
      style={{
        background: 'radial-gradient(ellipse 70% 65% at 50% 58%, var(--color-glow), transparent)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-2xl font-bold leading-10">BSE Studio</h1>
        <div className="flex gap-2">
          <a href="#machine" className="btn btn-primary min-w-30 h-10 text-sm">
            새 설비
          </a>
          <a
            href="#factory"
            className="btn min-w-30 h-10 text-sm border-line"
            aria-disabled="true"
            onClick={(e) => e.preventDefault()}
          >
            새 공장
          </a>
        </div>
      </div>

      <section className="panel border border-border rounded-sm bg-[rgb(22_57_92/45%)]">
        <h2 className="panel-h m-0 min-h-11 text-sm text-fg">
          설비 라이브러리 <span className="font-normal text-muted">{CARDS.length}</span>
          <span className="ml-auto text-muted font-normal">블록 {lib.size}종 준비됨</span>
        </h2>
        <div className="grid gap-4 p-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((c) => (
            <a
              key={c.name}
              href="#machine"
              className="grid gap-2 p-3 border border-border rounded-sm bg-[rgb(15_42_69/55%)] text-fg no-underline hover:border-line"
            >
              <div className="h-[110px] border border-[rgb(207_228_245/25%)] rounded-sm bg-bg bg-[linear-gradient(rgb(207_228_245/12%)_1px,transparent_1px),linear-gradient(90deg,rgb(207_228_245/12%)_1px,transparent_1px)] bg-[size:18px_18px] flex items-center justify-center text-muted text-xs">
                3D 미리보기
              </div>
              <div className="flex items-center justify-between font-bold text-sm">
                <span>{c.name}</span>
                <span className="text-[11px] font-bold px-1.5 border border-line rounded-sm text-line">
                  {c.grade}
                </span>
              </div>
              <div className="text-xs text-muted leading-[18px] h-9">
                {c.meta}
                <br />
                {c.size}
              </div>
              <div className="text-xs text-muted">
                <i className={`dot ${c.dot}`} />
                {c.stat}
              </div>
            </a>
          ))}
          <a
            href="#machine"
            className="flex flex-col items-center justify-center gap-2 p-3 border border-dashed border-border rounded-sm text-muted no-underline hover:border-line min-h-[220px]"
          >
            <span className="text-2xl">+</span>
            <span className="font-bold text-fg">새 설비 만들기</span>
            <span className="text-xs text-dim">빈 설비 · 템플릿 3종</span>
          </a>
        </div>
      </section>

      <section className="grid gap-5 grid-cols-1 lg:grid-cols-2">
        <div className="panel border border-border rounded-sm bg-[rgb(22_57_92/45%)]">
          <h2 className="panel-h m-0 min-h-11 text-sm text-fg">
            공장 <span className="font-normal text-muted">2</span>
            <span className="ml-auto mono text-dim font-normal">최근 수정순</span>
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
              <tr>
                <td className="font-semibold">2공장 A라인</td>
                <td className="text-right">12대</td>
                <td className="text-right mono">48 × 30 m</td>
                <td className="text-right text-muted">오늘 14:02</td>
              </tr>
              <tr>
                <td className="font-semibold">신규 라인 검토안</td>
                <td className="text-right">7대</td>
                <td className="text-right mono">30 × 24 m</td>
                <td className="text-right text-muted">어제</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel border border-border rounded-sm bg-[rgb(22_57_92/45%)]">
          <h2 className="panel-h m-0 min-h-11 text-sm text-fg">
            최근 실행 결과 <span className="font-normal text-muted">2</span>
            <span className="ml-auto mono text-dim font-normal">서버 실행</span>
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
              <tr>
                <td>
                  <b>A라인 — 버퍼 3 vs 5</b> <span className="text-muted">· 8 h × 10회</span>
                </td>
                <td className="text-right mono text-line">412 → 436 개/h</td>
                <td className="text-right text-muted">
                  <i className="dot bg-ok" />
                  완료
                </td>
              </tr>
              <tr>
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
