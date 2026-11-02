/**
 * 설비 편집 세션: 문서 + 실행 취소/다시 실행 + 선택 + (붙어 있으면) 런타임으로 force_tag 전달.
 * UI 는 dispatch() 만 부른다. 모든 호출이 기록(log)에 남아 AI·MCP 래핑과 회귀 테스트의 근거가 된다.
 */
import { EditCommand, Machine, type CommandResult } from '@bse/schema';
import { applyCommand, type EditorContext } from './commands.js';
import { MachineRuntime } from '../runtime/machine-runtime.js';

export interface LogEntry {
  cmd: EditCommand;
  result: CommandResult;
}

export class MachineEditor {
  doc: Machine;
  selection: string[] = [];
  readonly log: LogEntry[] = [];
  private readonly undoStack: Machine[] = [];
  private readonly redoStack: Machine[] = [];
  private runtime: MachineRuntime | null = null;

  constructor(
    doc: Machine,
    private readonly ctx: EditorContext,
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

  /** 실행 모드(데모 시뮬) 런타임. run_demo 로 만들고 stop 으로 버린다 */
  get run(): MachineRuntime | null {
    return this.runtime;
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
        const missing = cmd.ids.filter((id) => !this.doc.nodes.some((n) => n.id === id));
        if (missing.length) return { ok: false, error: `노드 없음: ${missing.join(', ')}` };
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
        return cmd.format === 'json' || cmd.format === 'card'
          ? { ok: true, changed: [], created: [] }
          : { ok: false, error: `${cmd.format} 내보내기는 이 묶음에서 아직 구현하지 않음` };
      case 'run_demo':
        this.runtime = new MachineRuntime(this.doc, this.ctx.lib, {
          seed: cmd.seed,
          speed: cmd.speed,
        });
        return { ok: true, changed: [], created: [] };
      case 'stop':
        this.runtime = null;
        return { ok: true, changed: [], created: [] };
      case 'force_tag': {
        if (!this.runtime) return { ok: false, error: '실행 모드가 아님 (run_demo 먼저)' };
        if (!this.runtime.signals.has(cmd.tag))
          return { ok: false, error: `없는 태그: ${cmd.tag}` };
        this.runtime.signals.force(cmd.tag, cmd.value);
        return { ok: true, changed: [], created: [] };
      }
      default: {
        const { doc, result } = applyCommand(this.doc, cmd, this.ctx);
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
    const ids = new Set(this.doc.nodes.map((n) => n.id));
    this.selection = this.selection.filter((id) => ids.has(id));
    if (this.runtime)
      this.runtime = new MachineRuntime(this.doc, this.ctx.lib, {
        seed: this.runtime.seed,
        speed: this.runtime.speed,
      });
  }

  /** machine.json 문자열 (스키마로 다시 검증해서 내보냄) */
  exportJson(): string {
    return JSON.stringify(Machine.parse(this.doc), null, 2);
  }
}
