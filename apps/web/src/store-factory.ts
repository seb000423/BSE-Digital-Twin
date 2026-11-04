/**
 * 공장 문서 스토어 (팩토리빌더): 문서는 FactoryEditor 가 명령으로만 바꾼다 (store.ts 와 같은 꼴).
 * 설비 카드 목록 = 기준 설비 3종(이 세션 동안 id 고정) + 지금 Build 에 열려 있는 설비. 공장은 설비를 `id@version` 참조로만 안다.
 */
import { create } from 'zustand';
import {
  DEFAULT_SHELL,
  FactoryEditor,
  MACHINE_TEMPLATES,
  buildShell,
  createIdFactory,
  newFactory,
  placeLine,
  type LogEntry,
  type ShellOptions,
} from '@bse/engine';
import { Factory, type CommandResult, type Machine } from '@bse/schema';
import { templateDoc, useEditor } from './store.js';

const newId = createIdFactory();

export interface MachineEntry {
  ref: string;
  name: string;
  doc: Machine;
}
const refOf = (doc: Machine) => `${doc.meta.id}@${doc.meta.version}`;
const TEMPLATES: MachineEntry[] = MACHINE_TEMPLATES.map((t) => {
  const doc = templateDoc(t.id);
  return { ref: refOf(doc), name: t.name, doc };
});

/** 놓을 수 있는 설비 카드들 */
export function machineLibrary(): MachineEntry[] {
  const cur = useEditor.getState().doc;
  const ref = refOf(cur);
  if (TEMPLATES.some((t) => t.ref === ref)) return TEMPLATES;
  return [...TEMPLATES, { ref, name: `${cur.meta.name} (Build 에서 연 설비)`, doc: cur }];
}

/** 참조 → 설비 (없으면 undefined: 다른 설비를 열어서 사라진 경우) */
export function machineOf(ref: string): MachineEntry | undefined {
  return machineLibrary().find((m) => m.ref === ref);
}

/** 공장 바닥 크기 [W, D] mm (첫 바닥의 외접 사각형, 없으면 기본 뼈대 크기) */
export function floorSize(doc: Factory): [number, number] {
  const s = doc.building.slabs[0];
  if (!s) return [DEFAULT_SHELL.width, DEFAULT_SHELL.depth];
  const xs = s.polygon.map((p) => p[0]);
  const ys = s.polygon.map((p) => p[1]);
  return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
}

/** 새 설비를 놓을 자리: 제일 오른쪽 설비의 오른쪽 (없으면 가운데). 바닥을 넘으면 다음 줄 */
export function nextSlot(doc: Factory, footprint: [number, number]): [number, number, number] {
  const [w, d] = floorSize(doc);
  const gap = 2000;
  if (doc.machines.length === 0) return [0, 0, 0];
  const last = doc.machines.reduce((a, b) =>
    b.transform.position[0] > a.transform.position[0] ? b : a,
  );
  const lastFp = machineOf(last.ref)?.doc.card.footprint ?? [2000, 2000];
  let x = last.transform.position[0] + lastFp[0] / 2 + gap + footprint[0] / 2;
  let y = last.transform.position[1];
  if (x + footprint[0] / 2 > w / 2 - 1000) {
    x = -w / 2 + 1000 + footprint[0] / 2;
    y = Math.max(...doc.machines.map((m) => m.transform.position[1])) + 6000;
    if (y > d / 2 - 1000) y = 0;
  }
  return [Math.round(x / 100) * 100, Math.round(y / 100) * 100, 0];
}

function makeFactory(name: string, shell: ShellOptions | null, withLine: boolean): FactoryEditor {
  const ed = new FactoryEditor(newFactory(newId(), name), { newId });
  if (shell) buildShell(ed, shell);
  if (withLine)
    placeLine(
      ed,
      TEMPLATES.map((t) => ({ ref: t.ref, footprint: t.doc.card.footprint })),
      2500,
    );
  ed.log.length = 0;
  return ed;
}

export interface FactoryState {
  editor: FactoryEditor;
  doc: Factory;
  selection: string[];
  log: LogEntry[];
  /** 지붕을 그릴지 (보기만, 문서 아님) */
  roof: boolean;
  setRoof: (v: boolean) => void;
  dispatch: (cmd: unknown) => CommandResult;
  /** 새 공장: 이름 + 뼈대 숫자. 기준 설비 3종을 한 줄로 놓아 준다 */
  create: (name: string, shell: ShellOptions, withLine: boolean) => void;
  /** 건물만 다시 올린다 (기존 건물 요소를 지우고 뼈대 다시, 설비는 그대로) */
  rebuildShell: (shell: ShellOptions) => void;
  openJson: (text: string) => string | null;
}

export const useFactory = create<FactoryState>((set, get) => {
  const editor = makeFactory('예시 공장', DEFAULT_SHELL, true);
  const sync = (): void => {
    const ed = get().editor;
    set({ doc: ed.doc, selection: ed.selection, log: ed.log.slice(-40) });
  };
  return {
    editor,
    doc: editor.doc,
    selection: editor.selection,
    log: [],
    roof: false,
    setRoof: (v) => set({ roof: v }),
    dispatch: (cmd) => {
      const r = get().editor.dispatch(cmd);
      sync();
      return r;
    },
    create: (name, shell, withLine) => {
      set({ editor: makeFactory(name, shell, withLine) });
      sync();
    },
    rebuildShell: (shell) => {
      const ed = get().editor;
      const b = ed.doc.building;
      const ids = [
        ...b.slabs.map((x) => x.id),
        ...b.walls.map((x) => x.id),
        ...b.columns.map((x) => x.id),
        ...b.roofs.map((x) => x.id),
      ];
      if (ids.length) ed.dispatch({ cmd: 'remove', ids });
      buildShell(ed, shell);
      sync();
    },
    openJson: (text) => {
      try {
        const r = Factory.safeParse(JSON.parse(text));
        if (!r.success) return `factory.json 형식이 아닙니다: ${r.error.issues[0]?.message ?? ''}`;
        set({ editor: new FactoryEditor(r.data, { newId }) });
        sync();
        return null;
      } catch {
        return 'JSON 을 읽을 수 없습니다';
      }
    },
  };
});
