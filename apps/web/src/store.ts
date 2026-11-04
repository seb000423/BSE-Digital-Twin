/**
 * 문서 상태 스토어 (CLAUDE.md 6장): 문서는 편집기 코어(MachineEditor)가 명령으로만 바꾼다.
 * 스토어는 코어가 돌려준 새 문서 참조와 선택·실행 상태를 들고 있을 뿐이다. 실행 취소/다시 실행도 코어 명령(undo/redo).
 * 시뮬 런타임 값(관절 위치·신호)은 스토어에 넣지 않고 런타임 객체에서 직접 읽는다 (매 프레임 바뀌므로).
 */
import { create } from 'zustand';
import { createLibrary } from '@bse/blocks';
import {
  MachineEditor,
  createIdFactory,
  getTemplate,
  newMachine,
  type LogEntry,
  type MachineRuntime,
  type TemplateId,
} from '@bse/engine';
import { Machine, type CommandResult } from '@bse/schema';

export const lib = createLibrary();
const newId = createIdFactory();

/** 무엇을 열지: 빈 설비 · 템플릿 3종 · 저장해 둔 machine.json */
export type OpenSource = 'blank' | TemplateId | Machine;

function makeEditor(src: OpenSource = 'conveyor-station'): MachineEditor {
  if (typeof src === 'object') return new MachineEditor(src, { lib, newId });
  if (src === 'blank')
    return new MachineEditor(newMachine(newId(), '새 설비', [3000, 2000, 2000]), { lib, newId });
  const t = getTemplate(src);
  const ed = new MachineEditor(newMachine(newId(), t.name, t.bbox), { lib, newId });
  t.build(ed);
  ed.log.length = 0;
  return ed;
}

/** 템플릿을 조립만 해서 문서를 돌려준다 (홈 카드 미리보기용, 편집기 상태와 무관) */
export function templateDoc(id: TemplateId): Machine {
  return makeEditor(id).doc;
}

export interface EditorState {
  editor: MachineEditor;
  doc: Machine;
  selection: string[];
  log: LogEntry[];
  running: boolean;
  speed: number;
  /** 명령 하나 실행. UI 의 유일한 쓰기 경로 */
  dispatch: (cmd: unknown) => CommandResult;
  runtime: () => MachineRuntime | null;
  /** 배속 (화면 값, 문서 아님). 실행 중이면 런타임에도 바로 적용 */
  setSpeed: (v: number) => void;
  /** 새 문서로 바꾼다 (빈 설비 · 템플릿 · 파일) */
  open: (src: OpenSource) => void;
  /** machine.json 글자를 검사해서 연다. 실패하면 오류 글자 */
  openJson: (text: string) => string | null;
}

export const useEditor = create<EditorState>((set, get) => {
  const editor = makeEditor();
  const sync = (): void => {
    const ed = get().editor;
    set({ doc: ed.doc, selection: ed.selection, log: ed.log.slice(-40), running: ed.run !== null });
  };
  return {
    editor,
    doc: editor.doc,
    selection: editor.selection,
    log: [],
    running: false,
    speed: 1,
    dispatch: (cmd) => {
      const r = get().editor.dispatch(cmd);
      if (typeof cmd === 'object' && cmd && 'speed' in cmd && typeof cmd.speed === 'number')
        set({ speed: cmd.speed });
      sync();
      return r;
    },
    runtime: () => get().editor.run,
    setSpeed: (v) => {
      const rt = get().editor.run;
      if (rt) rt.speed = v;
      set({ speed: v });
    },
    open: (src) => {
      get().editor.dispatch({ cmd: 'stop' });
      set({ editor: makeEditor(src) });
      sync();
    },
    openJson: (text) => {
      try {
        const r = Machine.safeParse(JSON.parse(text));
        if (!r.success) return `machine.json 형식이 아닙니다: ${r.error.issues[0]?.message ?? ''}`;
        get().open(r.data);
        return null;
      } catch {
        return 'JSON 을 읽을 수 없습니다';
      }
    },
  };
});

/** 데모를 켜는 출력 태그: 컨베이어 RUN, 로봇·프레스 START (소스는 자동) */
const AUTO_ON = /_(RUN|START)$/;

/**
 * "실행": 데모 런타임을 만들고 바로 움직이게 한다 — RUN·START 류 출력 태그를 켜고,
 * 동작 순서가 있으면 자동 운전까지 켠다. Build 의 실행 단추와 Simulate 가 같이 쓴다.
 */
export function startDemo(): void {
  const { doc, dispatch, speed } = useEditor.getState();
  dispatch({ cmd: 'run_demo', speed, seed: 1 });
  for (const e of doc.io)
    if (e.dir === 'out' && AUTO_ON.test(e.tag))
      dispatch({ cmd: 'force_tag', tag: e.tag, value: true });
  if (doc.sequence.steps.length > 0) dispatch({ cmd: 'auto', on: true });
}

/** 노드의 태그 접두어 (CYL1 …) */
export function prefixOf(doc: Machine, id: string): string {
  const n = doc.nodes.find((x) => x.id === id);
  const b = n?.components['block'];
  return b && typeof b === 'object' && 'prefix' in b
    ? String((b as { prefix: string }).prefix)
    : '';
}
