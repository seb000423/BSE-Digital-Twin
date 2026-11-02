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
  newMachine,
  type LogEntry,
  type MachineRuntime,
} from '@bse/engine';
import type { CommandResult, Machine } from '@bse/schema';

export const lib = createLibrary();
const newId = createIdFactory();

function makeEditor(): MachineEditor {
  const ed = new MachineEditor(newMachine(newId(), '컨베이어 스테이션', [9000, 4000, 2400]), {
    lib,
    newId,
  });
  // 시작 장면: 기준 설비 1 (컨베이어 스테이션) 의 뼈대. 치수는 예시값
  const r = ed.dispatch({
    cmd: 'add_block',
    blockType: 'roller-conveyor',
    params: { length: 3000, width: 600, speed: 300 },
  });
  if (r.ok) {
    const cv = r.created[0]!;
    ed.dispatch({
      cmd: 'add_block',
      blockType: 'source',
      parent: cv,
      params: { interval: 4 },
      transform: { position: [-1300, 0, 750] },
    });
    ed.dispatch({
      cmd: 'add_block',
      blockType: 'photo-sensor',
      parent: cv,
      transform: { position: [600, 0, 750] },
    });
    ed.dispatch({
      cmd: 'add_block',
      blockType: 'stopper',
      parent: cv,
      transform: { position: [1000, 0, 700] },
    });
    ed.dispatch({
      cmd: 'add_block',
      blockType: 'sink',
      parent: cv,
      transform: { position: [1400, 0, 750] },
    });
    ed.dispatch({ cmd: 'select', ids: [cv] });
  }
  ed.log.length = 0;
  return ed;
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
  reset: () => void;
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
    reset: () => {
      set({ editor: makeEditor() });
      sync();
    },
  };
});

/** 노드의 태그 접두어 (CYL1 …) */
export function prefixOf(doc: Machine, id: string): string {
  const n = doc.nodes.find((x) => x.id === id);
  const b = n?.components['block'];
  return b && typeof b === 'object' && 'prefix' in b
    ? String((b as { prefix: string }).prefix)
    : '';
}
