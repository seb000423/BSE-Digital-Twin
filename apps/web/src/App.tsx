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

const NAV: { id: 'machine' | 'simulate' | 'evolve'; label: string; hash: string; on: View[] }[] = [
  { id: 'machine', label: 'Build', hash: '#machine', on: ['machine', 'factory'] },
  { id: 'simulate', label: 'Simulate', hash: '#simulate', on: ['simulate'] },
  { id: 'evolve', label: 'Evolve', hash: '#evolve', on: ['evolve'] },
];

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
            aria-label="홈"
            title="홈"
            aria-current={view === 'home' ? 'page' : undefined}
            className="inline-flex items-center justify-center w-9 h-8 rounded-sm text-muted hover:text-fg aria-[current=page]:bg-[rgb(220_235_247/14%)] aria-[current=page]:text-fg"
          >
            <HouseIcon />
          </a>
          {NAV.map((n) => (
            <a
              key={n.id}
              href={n.hash}
              aria-current={n.on.includes(view) ? 'page' : undefined}
              className="px-3 py-1.5 rounded-sm text-sm font-semibold text-muted hover:text-fg aria-[current=page]:bg-[rgb(220_235_247/14%)] aria-[current=page]:text-fg"
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

function HouseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v10h13V10" />
      <path d="M10 20v-6h4v6" />
    </svg>
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
