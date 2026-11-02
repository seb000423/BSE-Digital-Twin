/**
 * 신호 테이블 (원칙 2): 시뮬 레이어(신호·기구학·DES·네비)는 이것으로만 대화한다.
 * 실PLC 태그와 1:1 치환되도록 이름은 태그 규칙을 따른다. V1 1단계: 메모리 Map 구현. SharedArrayBuffer 버전은 2단계.
 */
import { TagName } from '@bse/schema';

export type SignalValue = boolean | number;

export class SignalTable {
  private readonly values = new Map<string, SignalValue>();
  private readonly forced = new Set<string>();

  define(tag: string, initial: SignalValue): void {
    TagName.parse(tag);
    if (this.values.has(tag)) throw new Error(`태그 중복: ${tag}`);
    this.values.set(tag, initial);
  }
  has(tag: string): boolean {
    return this.values.has(tag);
  }
  get(tag: string): SignalValue {
    const v = this.values.get(tag);
    if (v === undefined) throw new Error(`없는 태그: ${tag}`);
    return v;
  }
  /** 레이어가 쓰는 값. 수동 강제(force) 중인 태그는 바뀌지 않는다 */
  set(tag: string, value: SignalValue): void {
    if (!this.values.has(tag)) throw new Error(`없는 태그: ${tag}`);
    if (this.forced.has(tag)) return;
    this.values.set(tag, value);
  }
  /** 수동 조작 패널: 값을 고정한다. value 가 null 이면 해제 */
  force(tag: string, value: SignalValue | null): void {
    if (!this.values.has(tag)) throw new Error(`없는 태그: ${tag}`);
    if (value === null) this.forced.delete(tag);
    else {
      this.forced.add(tag);
      this.values.set(tag, value);
    }
  }
  snapshot(): Record<string, SignalValue> {
    return Object.fromEntries(this.values);
  }
  get size(): number {
    return this.values.size;
  }
}
