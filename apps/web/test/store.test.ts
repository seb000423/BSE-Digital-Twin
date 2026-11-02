import { describe, expect, it } from 'vitest';
import { prefixOf, useEditor } from '../src/store.js';

describe('편집 스토어', () => {
  it('시작 장면은 컨베이어 스테이션 뼈대이고, 화면은 명령으로만 문서를 바꾼다', () => {
    const s = useEditor.getState();
    expect(s.doc.nodes.length).toBe(5);
    const r = s.dispatch({ cmd: 'add_block', blockType: 'stopper', parent: s.doc.nodes[0]!.id });
    expect(r.ok).toBe(true);
    expect(useEditor.getState().doc.nodes.length).toBe(6);
    expect(prefixOf(useEditor.getState().doc, useEditor.getState().doc.nodes[5]!.id)).toBe('STP2');
    useEditor.getState().dispatch({ cmd: 'undo' });
    expect(useEditor.getState().doc.nodes.length).toBe(5);
  });
  it('실행 모드에서 force_tag 가 런타임 신호를 바꾼다', () => {
    const s = useEditor.getState();
    expect(s.dispatch({ cmd: 'force_tag', tag: 'CV1_RUN', value: true }).ok).toBe(false);
    s.dispatch({ cmd: 'run_demo', speed: 4, seed: 1 });
    expect(useEditor.getState().running).toBe(true);
    expect(useEditor.getState().speed).toBe(4);
    expect(s.dispatch({ cmd: 'force_tag', tag: 'CV1_RUN', value: true }).ok).toBe(true);
    expect(useEditor.getState().runtime()?.signals.get('CV1_RUN')).toBe(true);
    s.dispatch({ cmd: 'stop' });
    expect(useEditor.getState().running).toBe(false);
  });
});
