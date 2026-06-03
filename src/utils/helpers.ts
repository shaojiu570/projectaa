export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function normalize(arr: number[]): number[] {
  const s = arr.reduce((a, b) => a + b, 0);
  return s > 0 ? arr.map(v => v / s) : arr.map(() => 1 / arr.length);
}
