import { useEffect, useState } from 'react';
import { Home } from './screens/Home.js';
import { MachineBuilder } from './screens/MachineBuilder.js';
import { FactoryBuilder } from './screens/FactoryBuilder.js';
import { Simulate } from './screens/Simulate.js';
import { Evolve } from './screens/Evolve.js';

/** 주소 해시 = 화면. Build 는 설비(#machine)·공장(#factory) 두 범위 */
type View = 'home' | 'machine' | 'factory' | 'simulate' | 'evolve';
const VIEWS: View[] = ['home', 'machine', 'factory', 'simulate', 'evolve'];
const viewFromHash = (): View => {
  const h = location.hash.replace('#', '') as View;
  return VIEWS.includes(h) ? h : 'home';
};

/** 상단 메뉴: Studio · Build(Factory | Machine) · Simulate · Evolve. 공장을 짓고 → 설비를 들여오는 순서 (D-42·D-43) */
const NAV: { id: View; label: string; title: string }[] = [
  {
    id: 'factory',
    label: 'Factory',
    title: '팩토리 빌더: 공장을 짓고(외형) 설비를 들여놓는다(내부)',
  },
  {
    id: 'machine',
    label: 'Machine',
    title: '머신 빌더: 설비(컨베이어·로봇·작업대…)를 만들고 동작을 점검한다',
  },
  { id: 'simulate', label: 'Simulate', title: '공장 안에서 설비들이 함께 도는 전체 흐름 · 관제' },
  { id: 'evolve', label: 'Evolve', title: '현장과 맞추기 (V2)' },
];
const LINK =
  'px-3 py-1.5 rounded-sm text-sm font-semibold text-muted hover:text-fg aria-[current=page]:bg-[rgb(216_207_189/14%)] aria-[current=page]:text-fg';

export function App() {
  const [view, setView] = useState<View>(viewFromHash);
  useEffect(() => {
    const on = () => setView(viewFromHash());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return (
    <div className="h-full flex flex-col">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center min-h-13 px-4 border-b border-border bg-bg">
        <nav aria-label="작업 공간" className="flex gap-1 items-center">
          <a
            href="#home"
            title="Studio 홈 (설비·공장 목록)"
            aria-current={view === 'home' ? 'page' : undefined}
            className={LINK}
          >
            Studio
          </a>
          <span
            className="flex items-center gap-0.5 ml-1 pl-2 border-l border-border"
            title="Build = 머신 빌더 + 팩토리 빌더"
          >
            <span className="text-[11px] font-semibold text-dim mr-1 select-none">Build</span>
            {NAV.slice(0, 2).map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                title={n.title}
                aria-current={view === n.id ? 'page' : undefined}
                className={LINK}
              >
                {n.label}
              </a>
            ))}
          </span>
          <span className="w-px h-5 bg-border mx-1" />
          {NAV.slice(2).map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              title={n.title}
              aria-current={view === n.id ? 'page' : undefined}
              className={LINK}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <a
          href="/"
          className="flex items-center gap-2 text-fg no-underline"
          title="소개 페이지(랜딩)로 나가기"
        >
          <Logo />
          <span className="font-bold text-sm">BSE : Digital Twin</span>
          <span className="text-xs text-muted">beta</span>
        </a>
        <div className="justify-self-end" aria-hidden="true" />
      </header>
      {view === 'home' && <Home />}
      {view === 'machine' && <MachineBuilder />}
      {view === 'factory' && <FactoryBuilder />}
      {view === 'simulate' && <Simulate />}
      {view === 'evolve' && <Evolve />}
    </div>
  );
}

function Logo() {
  return (
    <svg
      width="26"
      height="24"
      viewBox="10 8 80 74"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinejoin="round"
    >
      <path d="M53.4,21 L69,48 A4,4 0 0 1 65.5,54 L34.4,54 A4,4 0 0 1 30.9,48 L46.5,21 A4,4 0 0 1 53.4,21 Z" />
      <path d="M63.8,39 L79.4,66 A4,4 0 0 1 75.9,72 L44.8,72 A4,4 0 0 1 41.3,66 L56.9,39 A4,4 0 0 1 63.8,39 Z" />
      <path d="M43,39 L58.6,66 A4,4 0 0 1 55.2,72 L24,72 A4,4 0 0 1 20.5,66 L36.1,39 A4,4 0 0 1 43,39 Z" />
    </svg>
  );
}
