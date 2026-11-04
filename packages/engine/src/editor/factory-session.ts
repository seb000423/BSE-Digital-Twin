/**
 * 공장 편집 세션: factory.json 문서 + 실행 취소/다시 실행 + 선택. UI 는 dispatch() 만 부른다.
 * 머신빌더 세션(session.ts)과 같은 꼴. 공장 시뮬(DES) 런타임은 서버 몫이라 여기 없다 (원칙 7).
 */
import { EditCommand, Factory, type CommandResult } from '@bse/schema';
import { applyFactoryCommand, factoryIds, type FactoryContext } from './factory-commands.js';
import type { LogEntry } from './session.js';

export class FactoryEditor {
  doc: Factory;
  selection: string[] = [];
  readonly log: LogEntry[] = [];
  private readonly undoStack: Factory[] = [];
  private readonly redoStack: Factory[] = [];

  constructor(
    doc: Factory,
    private readonly ctx: FactoryContext,
    private readonly historyLimit = 200,
  ) {
    this.doc = doc;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  dispatch(input: unknown): CommandResult {
    const parsed = EditCommand.safeParse(input);
    if (!parsed.success)
      return {
        ok: false,
        error: `명령 형식 오류: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
      };
    const cmd = parsed.data;
    const result = this.execute(cmd);
    this.log.push({ cmd, result });
    return result;
  }

  private execute(cmd: EditCommand): CommandResult {
    switch (cmd.cmd) {
      case 'select': {
        const known = factoryIds(this.doc);
        const missing = cmd.ids.filter((id) => !known.has(id));
        if (missing.length) return { ok: false, error: `개체 없음: ${missing.join(', ')}` };
        this.selection = cmd.ids;
        return { ok: true, changed: [], created: [] };
      }
      case 'undo': {
        const prev = this.undoStack.pop();
        if (!prev) return { ok: false, error: '되돌릴 것이 없음' };
        this.redoStack.push(this.doc);
        this.doc = prev;
        this.afterDocChange();
        return { ok: true, changed: [], created: [] };
      }
      case 'redo': {
        const next = this.redoStack.pop();
        if (!next) return { ok: false, error: '다시 실행할 것이 없음' };
        this.undoStack.push(this.doc);
        this.doc = next;
        this.afterDocChange();
        return { ok: true, changed: [], created: [] };
      }
      case 'save':
        return { ok: true, changed: [this.doc.meta.id], created: [] };
      case 'export':
        return cmd.format === 'json'
          ? { ok: true, changed: [], created: [] }
          : { ok: false, error: `${cmd.format} 내보내기는 이 묶음에서 아직 구현하지 않음` };
      default: {
        const { doc, result } = applyFactoryCommand(this.doc, cmd, this.ctx);
        if (result.ok) {
          this.undoStack.push(this.doc);
          if (this.undoStack.length > this.historyLimit) this.undoStack.shift();
          this.redoStack.length = 0;
          this.doc = doc;
          this.afterDocChange();
        }
        return result;
      }
    }
  }

  private afterDocChange(): void {
    const known = factoryIds(this.doc);
    this.selection = this.selection.filter((id) => known.has(id));
  }

  /** factory.json 문자열 (스키마로 다시 검증해서 내보냄) */
  exportJson(): string {
    return JSON.stringify(Factory.parse(this.doc), null, 2);
  }
}
