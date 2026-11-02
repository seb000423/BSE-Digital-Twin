/** 결정적 난수 (CLAUDE.md 6장): 같은 시드 → 같은 결과. Math.random 금지 */
import seedrandom from 'seedrandom';

export interface Rng {
  /** [0, 1) */
  next(): number;
  /** 지수 분포 (DES 도착·고장 간격). mean 초 */
  exponential(mean: number): number;
  /** 삼각 분포 (사이클타임 흔들림) */
  triangular(min: number, mode: number, max: number): number;
}

export function createRng(seed: number | string): Rng {
  const r = seedrandom(String(seed));
  return {
    next: () => r(),
    exponential: (mean) => -Math.log(1 - r()) * mean,
    triangular: (min, mode, max) => {
      const u = r();
      const f = (mode - min) / (max - min);
      return u < f
        ? min + Math.sqrt(u * (max - min) * (mode - min))
        : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
    },
  };
}
