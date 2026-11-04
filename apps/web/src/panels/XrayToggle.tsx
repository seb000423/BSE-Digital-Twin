/**
 * 보기 전환 (04 §9.4): 면 보기 ↔ X-ray (투시 선화: 면을 비우고 외곽선만 남겨 속까지 보임).
 * 뷰포트 왼쪽 위에 떠 있는 작은 단추 두 개. 보기만 바꾸고 문서는 건드리지 않는다.
 */
export function XrayToggle({
  xray,
  onChange,
  solidLabel = '면',
}: {
  xray: boolean;
  onChange: (x: boolean) => void;
  solidLabel?: string;
}) {
  return (
    <span
      className="seg absolute left-3 bottom-2.5 bg-[rgb(28_27_25/80%)] z-10"
      role="group"
      aria-label="보기"
    >
      <button
        type="button"
        aria-pressed={!xray}
        title="면을 채워서 보기"
        onClick={() => onChange(false)}
      >
        {solidLabel}
      </button>
      <button
        type="button"
        aria-pressed={xray}
        title="X-ray: 면을 비우고 선만 남겨 속까지 보기"
        onClick={() => onChange(true)}
      >
        X-ray
      </button>
    </span>
  );
}
