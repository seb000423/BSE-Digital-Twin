/** 실행 조작: 재생 · 정지 단추와 가로 배속 바 (×1 ~ ×10). 배속은 실행 중에도 바로 바뀐다 */
import { useEditor } from '../store.js';

export function Transport({ onPlay, bar = false }: { onPlay?: () => void; bar?: boolean }) {
  const { running, speed, dispatch, setSpeed } = useEditor();
  return (
    <div className="flex items-center gap-2">
      {!bar && (
        <>
          <button
            type="button"
            className="btn btn-primary min-w-20"
            disabled={running}
            onClick={onPlay}
            title="데모 실행을 시작합니다"
          >
            ▶ 재생
          </button>
          <button
            type="button"
            className="btn min-w-20"
            disabled={!running}
            onClick={() => dispatch({ cmd: 'stop' })}
            title="실행을 멈추고 편집 상태로 돌아갑니다"
          >
            ■ 정지
          </button>
        </>
      )}
      <label className="flex items-center gap-2 pl-2 text-xs text-muted whitespace-nowrap">
        배속
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="speed w-40"
          aria-label="배속"
        />
        <span className="mono text-fg w-8">×{speed}</span>
      </label>
    </div>
  );
}
