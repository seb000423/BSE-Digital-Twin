import { useEffect, useState } from 'react';
import { Home } from './screens/Home.js';
import { MachineBuilder } from './screens/MachineBuilder.js';

type View = 'home' | 'machine';
const viewFromHash = (): View => (location.hash === '#machine' ? 'machine' : 'home');

const NAV: { id: View | 'simulate' | 'evolve'; label: string; hash: string }[] = [
  { id: 'home', label: '홈', hash: '#home' },
  { id: 'machine', label: 'Build', hash: '#machine' },
  { id: 'simulate', label: 'Simulate', hash: '#simulate' },
  { id: 'evolve', label: 'Evolve', hash: '#evolve' },
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
        <nav aria-label="작업 공간" className="flex gap-1">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={n.hash}
              aria-current={n.id === view ? 'page' : undefined}
              aria-disabled={n.id === 'simulate' || n.id === 'evolve' ? true : undefined}
              className="px-3 py-1.5 rounded-sm text-sm font-semibold text-muted hover:text-fg aria-[current=page]:bg-[rgb(220_235_247/14%)] aria-[current=page]:text-fg aria-disabled:opacity-40"
              onClick={(e) => {
                if (n.id === 'simulate' || n.id === 'evolve') e.preventDefault();
              }}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <a href="#home" className="flex items-center gap-2 text-fg no-underline">
          <Logo />
          <span className="font-bold text-sm">BSE : Digital Twin</span>
          <span className="text-xs text-muted">beta</span>
        </a>
        <div className="justify-self-end flex items-center gap-3 text-xs text-muted">
          <span>(주)샘플정밀 · 부승언</span>
          <button type="button" className="btn">
            설정
          </button>
        </div>
      </header>
      {view === 'home' ? <Home /> : <MachineBuilder />}
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
