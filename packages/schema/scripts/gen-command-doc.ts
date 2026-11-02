/** 편집 명령 표 생성: zod(EditCommand) → JSON Schema → docs/14_EDIT_COMMANDS.md 2장. 손으로 고치지 않음 */
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { COMMAND_SCOPE, EditCommand, type EditCommandName } from '../src/index.js';

type Js = Record<string, unknown>;
const GROUPS: ReadonlyArray<readonly [string, readonly EditCommandName[]]> = [
  [
    '공통 (편집기 코어)',
    [
      'select',
      'move',
      'snap',
      'group',
      'ungroup',
      'duplicate',
      'mirror',
      'array',
      'remove',
      'rename',
      'set_reference',
      'measure',
      'check_collision',
      'undo',
      'redo',
      'save',
      'export',
    ],
  ],
  [
    '머신빌더 (Build, 지침서 6장)',
    [
      'set_bbox',
      'add_block',
      'set_param',
      'load_glb',
      'load_urdf',
      'add_joint',
      'set_joint',
      'bind_tag',
      'rename_tag',
      'import_io',
      'add_work',
      'attach',
      'detach',
      'set_sequence',
      'force_tag',
      'set_fidelity',
      'make_card',
    ],
  ],
  [
    '팩토리빌더 (Build, 지침서 7장)',
    [
      'add_level',
      'draw_slab',
      'draw_wall',
      'place_columns',
      'add_opening',
      'draw_marking',
      'place_machine',
      'set_card_override',
      'connect_flow',
      'add_storage',
      'add_mover',
      'build_nav',
      'add_drop',
    ],
  ],
  [
    '시뮬레이션 (Simulate, 지침서 8장)',
    ['run_demo', 'stop', 'create_scenario', 'run_scenario', 'compare', 'replay', 'optimize'],
  ],
];

const schema = z.toJSONSchema(EditCommand, {
  target: 'draft-2020-12',
  io: 'input',
  unrepresentable: 'any',
}) as Js;
const options = (schema.oneOf ?? schema.anyOf) as Js[];
const byName = new Map(options.map((o) => [((o.properties as Js).cmd as Js).const as string, o]));

function typeOf(s: Js): string {
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (Array.isArray(s.enum)) return (s.enum as unknown[]).map(String).join(' \\| ');
  const alts = (s.anyOf ?? s.oneOf) as Js[] | undefined;
  if (alts) return alts.map(typeOf).join(' \\| ');
  if (s.prefixItems) return '[' + (s.prefixItems as Js[]).map(typeOf).join(', ') + ']';
  if (s.type === 'array') return typeOf((s.items as Js) ?? {}) + '[]';
  if (s.type === 'object')
    return s.additionalProperties && typeof s.additionalProperties === 'object' ? 'record' : '{…}';
  if (Array.isArray(s.type)) return (s.type as string[]).join(' \\| ');
  if (s.type === 'null') return 'null';
  if (typeof s.type === 'string') return s.type;
  return 'any(검증은 대상 스키마)';
}

function row(name: EditCommandName): string {
  const o = byName.get(name);
  if (!o) throw new Error(`명령 없음: ${name}`);
  const sc = COMMAND_SCOPE[name];
  const scope =
    sc === 'both' ? '설비·공장' : sc.map((s) => (s === 'machine' ? '설비' : '공장')).join('·');
  const required = new Set((o.required as string[] | undefined) ?? []);
  const args = Object.entries(o.properties as Record<string, Js>)
    .filter(([k]) => k !== 'cmd')
    .map(([k, v]) => {
      const suffix = required.has(k) ? '' : v.default !== undefined ? ' (기본값 있음)' : '?';
      return `\`${k}\`: ${typeOf(v)}${suffix}${v.description ? ' — ' + String(v.description) : ''}`;
    })
    .join('<br>');
  return `| \`${name}\` | ${scope} | ${args || '—'}${o.description ? '<br>_' + String(o.description) + '_' : ''} |`;
}

const listed = GROUPS.flatMap(([, n]) => n);
const missing = [...byName.keys()].filter((k) => !listed.includes(k as EditCommandName));
if (missing.length || listed.length !== byName.size)
  throw new Error('표에 없는 명령: ' + missing.join(', '));

let body = `## 2. 명령 (${byName.size}개)\n`;
for (const [title, names] of GROUPS) {
  body += `\n### ${title} — ${names.length}개\n| 명령 | 범위 | 인자 |\n|------|------|------|\n${names.map(row).join('\n')}\n`;
}
body += '\n';

const docPath = new URL('../../../docs/14_EDIT_COMMANDS.md', import.meta.url);
const doc = readFileSync(docPath, 'utf8');
const start = doc.indexOf('## 2. ');
const end = doc.indexOf('## 3. ');
if (start < 0 || end < 0) throw new Error('docs/14 에 2장·3장 제목이 없음');
writeFileSync(docPath, doc.slice(0, start) + body + doc.slice(end));
console.log(`docs/14_EDIT_COMMANDS.md 2장 갱신 (${byName.size}개 명령)`);
