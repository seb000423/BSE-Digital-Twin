/**
 * 태그(신호) 규칙 (지침서 4.4절, 5장).
 * 이름: 대문자·숫자·밑줄, 32자 이내. 인스턴스 접두어 `{station}.{machine}.{tag}` 는 팩토리 배치 시 자동.
 */
import { z } from 'zod';
import { Uuid } from './ids.js';

export const TAG_MAX = 32;
export const TagName = z
  .string()
  .min(1)
  .max(TAG_MAX)
  .regex(/^[A-Z][A-Z0-9_]*$/, '대문자·숫자·밑줄, 대문자로 시작');
export type TagName = z.infer<typeof TagName>;

/** `ST01.M1.CYL1_FWD` — 접두어 세그먼트도 같은 문자 규칙 */
export const QualifiedTag = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/, '{station}.{machine}.{tag} 형식');
export type QualifiedTag = z.infer<typeof QualifiedTag>;

export const TagPrefix = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/, '{station}.{machine} 형식');

export const TagDir = z.enum(['in', 'out']);
export const TagType = z.enum(['bool', 'int', 'real']);

/** 동작 종류별 태그 세트 (4.4절). `{n}` 자리에 노드 접두어가 들어감 */
export const TAG_SETS = {
  onoff_axis: ['{n}_FWD', '{n}_BWD', '{n}_FWD_LS', '{n}_BWD_LS'],
  onoff_rotate: ['{n}_CW', '{n}_CCW', '{n}_CW_LS', '{n}_CCW_LS'],
  clamp: ['{n}_CLAMP', '{n}_UNCLAMP', '{n}_CLAMP_LS', '{n}_UNCLAMP_LS'],
  lifter: ['{n}_UP', '{n}_DOWN', '{n}_UP_LS', '{n}_DOWN_LS'],
  position_axis: ['{n}_POS_CMD', '{n}_POS_FB', '{n}_INPOS', '{n}_HOME', '{n}_SVON', '{n}_ALARM'],
  speed_axis: ['{n}_RUN', '{n}_DIR', '{n}_SPEED'],
  gripper: ['{n}_OPEN', '{n}_CLOSE', '{n}_OPEN_LS', '{n}_CLOSE_LS'],
  vacuum: ['{n}_VAC_ON', '{n}_VAC_OK'],
  sensor_bool: ['{n}_ON'],
  sensor_dist: ['{n}_DIST'],
  sensor_value: ['{n}_VALUE'],
  sensor_safety: ['{n}_SAFE'],
  process: ['{n}_START', '{n}_BUSY', '{n}_DONE', '{n}_OK', '{n}_NG', '{n}_ALARM', '{n}_READY'],
  robot: ['{n}_PGM_NO', '{n}_START', '{n}_INPOS', '{n}_RUNNING', '{n}_ALARM'],
  carrier: ['{n}_FULL', '{n}_EMPTY', '{n}_COUNT', '{n}_ID'],
  machine_common: [
    'START',
    'STOP',
    'RESET',
    'EMO',
    'AUTO_MAN',
    'DOOR_CLOSED',
    'SAFE',
    'RUN',
    'ALARM',
  ],
} as const;
export type TagSetKind = keyof typeof TAG_SETS;

/** 세트 템플릿에 노드 접두어를 넣어 실제 태그 이름을 만든다 */
export function expandTagSet(kind: TagSetKind, nodePrefix: string): string[] {
  return TAG_SETS[kind].map((t) => t.replace('{n}', nodePrefix));
}

export const TagBindingKind = z.enum(['joint', 'sensor', 'process', 'carrier', 'trajectory']);
export type TagBindingKind = z.infer<typeof TagBindingKind>;

export const IoEntry = z.object({
  tag: TagName,
  dir: TagDir,
  type: TagType,
  binding: z
    .object({ kind: TagBindingKind, target: Uuid.describe('관절·센서·공정 노드 id') })
    .nullable()
    .default(null),
});
export type IoEntry = z.infer<typeof IoEntry>;
