/** 공장 런타임: 설비 인스턴스마다 설비 런타임이 돌고, 지표가 나오고, 같은 시드면 같다 */
import { describe, expect, it } from 'vitest';
import { createLibrary } from '@bse/blocks';
import {
  FactoryEditor,
  FactoryRuntime,
  MachineEditor,
  createRng,
  createSeededIdFactory,
  getTemplate,
  newFactory,
  newMachine,
  placeLine,
  type TemplateId,
} from '../src/index.js';

const lib = createLibrary();
const docOf = (id: TemplateId, seed: number) => {
  const t = getTemplate(id);
  const newId = createSeededIdFactory(createRng(seed));
  const ed = new MachineEditor(newMachine(newId(), t.name, t.bbox), { lib, newId });
  t.build(ed);
  return ed.doc;
};

function build() {
  const docs = [docOf('conveyor-station', 1), docOf('press-station', 2)];
  const ref = (d: (typeof docs)[number]) => `${d.meta.id}@${d.meta.version}`;
  const newId = createSeededIdFactory(createRng(9));
  const ed = new FactoryEditor(newFactory(newId(), '시험'), { newId });
  placeLine(
    ed,
    docs.map((d) => ({ ref: ref(d), footprint: d.card.footprint })),
  );
  const machineOf = (r: string) => docs.find((d) => ref(d) === r);
  return new FactoryRuntime(ed.doc, machineOf, lib, { seed: 5 });
}

describe('공장 런타임', () => {
  it('설비 2대가 함께 돌고 컨베이어 스테이션은 생산 수가 올라간다', () => {
    const fr = build();
    expect(fr.machines).toHaveLength(2);
    expect(fr.missing).toHaveLength(0);
    fr.start();
    fr.advance(30);
    expect(fr.time).toBeCloseTo(30, 5);
    const k = fr.kpis();
    expect(k.map((x) => x.tagPrefix)).toEqual(['ST01.M1', 'ST02.M1']);
    expect(k[0]!.status).toBe('run');
    expect(k[0]!.produced).toBeGreaterThan(0);
    expect(k[0]!.step).not.toBe('');
    expect(fr.totals().produced).toBe(k[0]!.produced + k[1]!.produced);
  });

  it('같은 시드 → 같은 결과', () => {
    const a = build();
    const b = build();
    a.start();
    b.start();
    a.advance(20);
    b.advance(20);
    expect(a.kpis()).toEqual(b.kpis());
  });
});
