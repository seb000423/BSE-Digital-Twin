/** Evolve (13 화면 지도 G, V2): 디지털 섀도 + 최적화 피드백. 지금은 무엇이 들어올지와 준비 상태만 보여 준다 */
export function Evolve() {
  const tiles = [
    {
      t: '디지털 섀도',
      d: '현장 PLC 태그를 게이트웨이(WebSocket/MQTT)로 받아 공장 3D 가 실제대로 움직임. 태그 이름은 Build 의 신호 표와 1:1',
      s: 'V2',
    },
    {
      t: '안돈 · 상태색',
      d: '가동(초록) · 대기/경고(노랑) · 알람(빨강) 세 가지로 설비 상태를 한눈에',
      s: 'V2',
    },
    {
      t: '최적화 피드백',
      d: '실제 처리량과 시뮬 결과를 비교해 버퍼·배속·레이아웃 개선안을 제안 (서버 실행)',
      s: 'V2',
    },
  ];
  return (
    <main className="flex-1 overflow-auto px-4 py-6 max-w-[1360px] w-full mx-auto flex flex-col gap-5">
      <div>
        <h1 className="m-0 text-2xl font-bold leading-10">Evolve</h1>
        <p className="m-0 text-xs text-muted">
          시뮬 결과를 현장과 맞추고, 현장 값으로 다시 고치는 자리 (V2)
        </p>
      </div>
      <section className="grid gap-5 grid-cols-1 lg:grid-cols-3">
        {tiles.map((x) => (
          <div key={x.t} className="panel border border-border rounded-sm bg-[rgb(38_37_32/70%)]">
            <h2 className="panel-h m-0 min-h-11 text-sm text-fg">
              {x.t}
              <span className="ml-auto text-[11px] font-bold px-1.5 border border-border rounded-sm text-muted">
                {x.s}
              </span>
            </h2>
            <p className="m-0 p-4 text-xs text-muted leading-5">{x.d}</p>
          </div>
        ))}
      </section>
      <section className="panel border border-border rounded-sm bg-[rgb(38_37_32/70%)]">
        <h2 className="panel-h m-0 min-h-11 text-sm text-fg">지금 할 수 있는 것</h2>
        <div className="p-4 text-xs text-muted flex flex-col gap-1.5">
          <span>
            ·{' '}
            <a href="#simulate" className="text-fg">
              Simulate
            </a>{' '}
            에서 설비를 돌려 보고 신호 표의 태그 이름을 확인
          </span>
          <span>· Build 의 "저장"으로 machine.json 을 내려받아 보관 (현장 연결 때 그대로 씀)</span>
        </div>
      </section>
    </main>
  );
}
