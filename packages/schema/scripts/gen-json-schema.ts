/** zod → JSON Schema 2020-12 (지침서 3.2절, zod 4 내장). 출력: packages/schema/json/*.schema.json */
import { mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { BlockDef, EditCommand, Factory, Machine } from '../src/index.js';

const out = new URL('../json/', import.meta.url);
mkdirSync(out, { recursive: true });
const targets = {
  machine: Machine,
  factory: Factory,
  block: BlockDef,
  command: EditCommand,
} as const;
for (const [name, schema] of Object.entries(targets)) {
  const json = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    io: 'input',
    unrepresentable: 'any',
  });
  json.$id = `https://bse-digital-twin/schema/${name}.schema.json`;
  writeFileSync(new URL(`${name}.schema.json`, out), JSON.stringify(json, null, 2) + '\n');
  console.log('wrote', `${name}.schema.json`);
}
