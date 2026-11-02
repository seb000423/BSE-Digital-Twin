/** 왼쪽: 블록 팔레트(10 분류) + 노드 트리. 버튼은 add_block / select 명령을 부를 뿐 */
import { useState } from 'react';
import type { BlockCategory } from '@bse/schema';
import { lib, useEditor } from '../store.js';

const CATEGORIES: { id: BlockCategory; label: string }[] = [
  { id: 'structure', label: '구조' },
  { id: 'transport', label: '반송' },
  { id: 'actuator_pneumatic', label: '공압' },
  { id: 'actuator_electric', label: '전동' },
  { id: 'robot', label: '로봇' },
  { id: 'sensor', label: '센서' },
  { id: 'work_carrier', label: '워크·용기' },
  { id: 'feeder', label: '피더' },
  { id: 'process', label: '공정' },
];

export function Palette() {
  const { doc, selection, dispatch } = useEditor();
  const [open, setOpen] = useState<BlockCategory>('transport');
  const selected = doc.nodes.find((n) => n.id === selection[0]);
  // 컨베이어처럼 이송면이 있는 노드를 골라 두면 그 위에 올린다
  const surfaceParent =
    selected && doc.joints.some((j) => j.node === selected.id && j.type === 'surface')
      ? selected
      : undefined;

  // 이송면 위에 올리는 것은 센서·워크·스토퍼뿐, 나머지는 바닥에 놓는다
  const add = (blockType: string) => {
    const cat = lib.require(blockType).def.meta.category;
    const onSurface = cat === 'sensor' || cat === 'work_carrier' || blockType === 'stopper';
    const parent = onSurface ? (surfaceParent?.id ?? null) : null;
    const n = doc.nodes.filter((x) => x.parent === parent).length;
    const z = parent && surfaceParent ? Number(surfaceParent.params['height'] ?? 750) : 0;
    const position: [number, number, number] = parent
      ? [-1000 + n * 500, 0, z]
      : [0, 1200 + n * 600, 0];
    dispatch({ cmd: 'add_block', blockType, parent, transform: { position } });
  };

  return (
    <div className="flex flex-col text-xs">
      <h3 className="panel-h m-0">블록 팔레트</h3>
      {CATEGORIES.map((c) => {
        const items = lib.list(c.id);
        const isOpen = open === c.id;
        return (
          <div key={c.id}>
            <button
              type="button"
              className="tree-row flex justify-between font-sans text-xs"
              aria-expanded={isOpen}
              onClick={() => setOpen(c.id)}
              style={{ background: isOpen ? 'rgb(220 235 247 / 8%)' : undefined }}
            >
              <span className={isOpen ? 'font-bold text-fg' : ''}>{c.label}</span>
              <span className="text-muted">{items.length}</span>
            </button>
            {isOpen && (
              <div className="grid grid-cols-2 gap-1.5 p-2 border-b border-border">
                {items.map((d) => (
                  <button
                    key={d.meta.id}
                    type="button"
                    className="btn flex-col gap-0.5 h-14 px-1 text-[11px] font-semibold leading-tight"
                    onClick={() => add(d.meta.id)}
                    title={surfaceParent ? `${surfaceParent.name} 위에 놓기` : '바닥에 놓기'}
                  >
                    <span className="mono text-dim text-[10px]">{lib.prefix(d.meta.id)}</span>
                    {d.meta.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <h3 className="panel-h m-0 mt-1">
        노드 트리 <span className="ml-auto font-normal">{doc.nodes.length}</span>
      </h3>
      <div className="py-1">
        <div className="px-3 py-1 mono text-muted">{doc.meta.name}</div>
        <Tree parent={null} depth={1} />
      </div>
    </div>
  );
}

function Tree({ parent, depth }: { parent: string | null; depth: number }) {
  const { doc, selection, dispatch } = useEditor();
  return (
    <>
      {doc.nodes
        .filter((n) => n.parent === parent)
        .map((n) => (
          <div key={n.id}>
            <button
              type="button"
              className="tree-row"
              style={{ paddingLeft: 12 + depth * 12 }}
              aria-current={selection.includes(n.id)}
              onClick={() => dispatch({ cmd: 'select', ids: [n.id] })}
            >
              {n.name}
            </button>
            <Tree parent={n.id} depth={depth + 1} />
          </div>
        ))}
    </>
  );
}
