import { describe, expect, it } from 'vitest';
import {
  EditCommand,
  QualifiedTag,
  TagName,
  degToRad,
  expandTagSet,
  mmToM,
  COMMAND_SCOPE,
} from '../src/index.js';

describe('태그 규칙', () => {
  it('이름 규칙: 대문자·숫자·밑줄, 32자', () => {
    expect(TagName.safeParse('CYL1_FWD').success).toBe(true);
    expect(TagName.safeParse('cyl1_fwd').success).toBe(false);
    expect(TagName.safeParse('A'.repeat(33)).success).toBe(false);
    expect(QualifiedTag.safeParse('ST01.M1.CYL1_FWD').success).toBe(true);
  });
  it('세트 전개', () => {
    expect(expandTagSet('onoff_axis', 'CYL1')).toEqual([
      'CYL1_FWD',
      'CYL1_BWD',
      'CYL1_FWD_LS',
      'CYL1_BWD_LS',
    ]);
  });
});

describe('단위', () => {
  it('mm→m, deg→rad', () => {
    expect(mmToM(1500)).toBe(1.5);
    expect(degToRad(180)).toBeCloseTo(Math.PI);
  });
});

describe('편집 명령', () => {
  it('명령 하나하나가 구별된다', () => {
    const c = EditCommand.parse({
      cmd: 'add_block',
      blockType: 'air-cylinder',
      params: { bore: 32 },
    });
    expect(c.cmd).toBe('add_block');
    expect(EditCommand.safeParse({ cmd: 'fly' }).success).toBe(false);
    expect(EditCommand.safeParse({ cmd: 'add_block', blockType: 'Air Cylinder' }).success).toBe(
      false,
    );
  });
  it('모든 명령에 범위가 적혀 있다', () => {
    const names = EditCommand.options.map((o) => o.shape.cmd.value);
    for (const n of names) expect(COMMAND_SCOPE[n]).toBeDefined();
    expect(names.length).toBeGreaterThanOrEqual(50);
  });
});
