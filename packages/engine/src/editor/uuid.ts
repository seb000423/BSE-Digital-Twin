/** UUID v7 (CLAUDE.md 5장). 테스트·재현을 위해 난수원을 바꿔 끼울 수 있다 */
import type { Rng } from '../rng.js';

export type IdFactory = () => string;

function hex(n: number, width: number): string {
  return n.toString(16).padStart(width, '0');
}

/** 시각(ms) + 난수 → UUID v7 문자열 */
export function uuidV7(nowMs: number, rand: () => number): string {
  const t = Math.max(0, Math.floor(nowMs));
  const timeHi = Math.floor(t / 0x10000);
  const timeLo = t % 0x10000;
  const r = () => Math.floor(rand() * 0x10000);
  const ver = 0x7000 | (r() & 0x0fff);
  const variant = 0x8000 | (r() & 0x3fff);
  return `${hex(timeHi, 8)}-${hex(timeLo, 4)}-${hex(ver, 4)}-${hex(variant, 4)}-${hex(r(), 4)}${hex(r(), 4)}${hex(r(), 4)}`;
}

/** 실제 사용: 현재 시각 + crypto 난수 */
export function createIdFactory(): IdFactory {
  const buf = new Uint32Array(1);
  const rand = () => {
    globalThis.crypto.getRandomValues(buf);
    return (buf[0] ?? 0) / 0x1_0000_0000;
  };
  return () => uuidV7(Date.now(), rand);
}

/** 결정적 id (테스트·회귀용): 고정 시각에서 1ms 씩 증가 + 시드 난수 */
export function createSeededIdFactory(rng: Rng, startMs = 1_700_000_000_000): IdFactory {
  let t = startMs;
  return () => uuidV7(t++, () => rng.next());
}
