/**
 * 동작 순서 (자동 운전) 패널: 문서의 sequence 를 보여 주고, 실행 모드에서 자동으로 돌린다.
 * 단추 = 자동 운전 시작/멈춤 · 자동 만들기(generate_sequence, 실행 취소 가능) · 워크 리셋. 전부 명령 호출.
 */
import { describeTag } from '@bse/blocks';
import { useLiveTick } from '../screens/MachineBuilder.js';
import { useEditor } from '../store.js';

export function SequencePanel() {
  const { doc, dispatch, running, speed } = useEditor();
  useLiveTick();
  const rt = useEditor.getState().runtime();
  const steps = doc.sequence.steps;
  const auto = rt?.auto.on ?? false;
  const cur = auto ? (rt?.auto.step ?? -1) : -1;

  const startAuto = () => {
    if (!running) dispatch({ cmd: 'run_demo', speed, seed: 1 });
    dispatch({ cmd: 'auto', on: true });
  };
  const fmt = (x: { tag: string; value: boolean | number }) =>
    `${x.tag} ${typeof x.value === 'boolean' ? (x.value ? '켜기' : '끄기') : `= ${x.value}`}`;

  return (
    <div className="flex flex-col min-h-0 h-full">
      <h3 className="panel-h m-0">
        동작 순서{' '}
        <span className="font-normal">{steps.length ? `${steps.length}단계` : '없음'}</span>
        <span className="ml-auto mr-14 flex gap-1.5">
          {auto ? (
            <button
              type="button"
              className="btn btn-primary min-h-6 px-2 text-[11px]"
              onClick={() => dispatch({ cmd: 'auto', on: false })}
            >
              ■ 자동 운전 멈춤
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary min-h-6 px-2 text-[11px]"
              disabled={steps.length === 0}
              title={
                steps.length === 0
                  ? '먼저 "자동 만들기"로 순서를 만드세요'
                  : '순서대로 태그를 켜고 끕니다'
              }
              onClick={startAuto}
            >
              ▶ 자동 운전
            </button>
          )}
          <button
            type="button"
            className="btn min-h-6 px-2 text-[11px]"
            title="블록과 태그를 보고 한 사이클 순서를 만듭니다 (실행 취소 가능)"
            onClick={() => dispatch({ cmd: 'generate_sequence' })}
          >
            자동 만들기
          </button>
          <button
            type="button"
            className="btn min-h-6 px-2 text-[11px]"
            disabled={!running}
            title="시뮬이 만든 워크를 치웁니다"
            onClick={() => dispatch({ cmd: 'reset_works' })}
          >
            ↺ 워크
          </button>
        </span>
      </h3>
      <ol className="overflow-auto flex-1 m-0 p-0 list-none">
        {steps.length === 0 && (
          <li className="px-3 py-2 text-muted">
            아직 순서가 없습니다. "자동 만들기"를 누르면 준비 → 워크 도착 대기 → 스토퍼 통과 같은
            순서를 블록을 보고 만들어 줍니다. 저장하면 machine.json 에 같이 들어갑니다.
          </li>
        )}
        {steps.map((s, i) => (
          <li
            key={s.id}
            aria-current={i === cur ? 'step' : undefined}
            className="px-3 py-1.5 border-b border-border grid grid-cols-[1.5rem_1fr] gap-x-2 aria-[current=step]:bg-[rgb(216_207_189/10%)]"
          >
            <span className={`mono ${i === cur ? 'text-fg font-bold' : 'text-dim'}`}>{i + 1}</span>
            <div className="min-w-0">
              <div className={i === cur ? 'text-fg font-semibold' : ''}>{s.name || s.id}</div>
              {s.set.length > 0 && (
                <div
                  className="mono text-[11px] text-muted truncate"
                  title={s.set.map(fmt).join(', ')}
                >
                  {s.set.map(fmt).join(', ')}
                </div>
              )}
              {(s.wait.length > 0 || s.timeout_ms) && (
                <div className="mono text-[11px] text-dim truncate">
                  {s.wait.length > 0 &&
                    `조건 ${s.wait.map((w) => `${w.tag} ${describeTag(w.tag) || ''} ${typeof w.value === 'boolean' ? (w.value ? '켜짐' : '꺼짐') : `= ${w.value}`}`).join(' · ')}`}
                  {s.wait.length > 0 && s.timeout_ms ? ' · ' : ''}
                  {s.timeout_ms ? `${s.timeout_ms / 1000} s 기다림` : ''}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
