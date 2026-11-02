import { describe, expect, it } from 'vitest';
import { SignalTable, createRng } from '../src/index.js';

describe('신호 테이블', () => {
  it('정의·읽기·쓰기·강제', () => {
    const t = new SignalTable();
    t.define('CYL1_FWD', false);
    t.set('CYL1_FWD', true);
    expect(t.get('CYL1_FWD')).toBe(true);
    t.force('CYL1_FWD', false);
    t.set('CYL1_FWD', true); // 강제 중엔 무시
    expect(t.get('CYL1_FWD')).toBe(false);
    t.force('CYL1_FWD', null);
    t.set('CYL1_FWD', true);
    expect(t.get('CYL1_FWD')).toBe(true);
  });
  it('태그 규칙을 어기면 거부', () => {
    const t = new SignalTable();
    expect(() => t.define('cyl1', false)).toThrow();
    expect(() => t.get('NOPE')).toThrow();
  });
});

describe('결정적 난수', () => {
  it('같은 시드면 같은 수열', () => {
    const a = createRng(42),
      b = createRng(42);
    const sa = [a.next(), a.exponential(10), a.triangular(1, 2, 4)];
    const sb = [b.next(), b.exponential(10), b.triangular(1, 2, 4)];
    expect(sa).toEqual(sb);
    expect(createRng(43).next()).not.toBe(createRng(42).next());
  });
});
