/** 공장 편집기 자리 (13 화면 지도 C-공장, 3단계). 지금은 무엇이 들어올지와 가는 길만 */
export function FactoryBuilder() {
  return (
    <main className="flex-1 overflow-auto px-4 py-6 max-w-[1360px] w-full mx-auto flex flex-col gap-5">
      <div>
        <h1 className="m-0 text-2xl font-bold leading-10">공장 (Build)</h1>
        <p className="m-0 text-xs text-muted">
          설비 카드를 바닥에 놓고 흐름을 잇는 화면 · 3단계에서 만듭니다
        </p>
      </div>
      <section className="panel border border-border rounded-sm bg-[rgb(22_57_92/45%)]">
        <h2 className="panel-h m-0 min-h-11 text-sm text-fg">들어올 것</h2>
        <div className="p-4 text-xs text-muted flex flex-col gap-1.5">
          <span>· 바닥·벽·기둥·층·문·마킹·랙·펜스 같은 공장 블록 약 25종</span>
          <span>
            · Build 에서 만든 설비 카드를 끌어다 놓고 자재 흐름을 연결 (place_machine ·
            connect_flow)
          </span>
          <span>· 평면도(DXF·이미지) 깔기, 동선 자동 생성, 설비 태그 접두어 자동 (ST01.M1)</span>
        </div>
      </section>
      <div className="flex gap-2">
        <a href="#machine" className="btn btn-primary no-underline">
          설비 만들기로
        </a>
        <a href="#home" className="btn no-underline">
          홈
        </a>
      </div>
    </main>
  );
}
