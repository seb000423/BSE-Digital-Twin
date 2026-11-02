import { BlockDef, type BlockDef as BlockDefT, type BlockTypeId } from '@bse/schema';

/** 블록 라이브러리 레지스트리. 정의는 로드 시 스키마로 검증한다 */
export class BlockRegistry {
  private readonly defs = new Map<string, BlockDefT>();
  register(def: unknown): BlockDefT {
    const d = BlockDef.parse(def);
    if (this.defs.has(d.meta.id)) throw new Error(`블록 타입 중복: ${d.meta.id}`);
    this.defs.set(d.meta.id, d);
    return d;
  }
  get(id: BlockTypeId): BlockDefT | undefined {
    return this.defs.get(id);
  }
  list(): BlockDefT[] {
    return [...this.defs.values()];
  }
}
