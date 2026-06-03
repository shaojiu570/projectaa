import { DrawRecord } from './types';

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateDraw(rng: () => number): { normals: number[]; special: number } {
  const all: number[] = [];
  while (all.length < 7) {
    const n = Math.floor(rng() * 49) + 1;
    if (!all.includes(n)) all.push(n);
  }
  const special = all.pop()!;
  return { normals: all, special };
}

export function generateHistoricalData(): DrawRecord[] {
  const rng = seededRandom(42);
  const records: DrawRecord[] = [];
  const startDate = new Date('2020-01-02');
  const currentDate = new Date();
  let issueCounter = 1;

  while (true) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + (issueCounter - 1));

    if (date > currentDate) break;

    const { normals, special } = generateDraw(rng);
    const issue = String(issueCounter).padStart(3, '0');
    records.push({
      issue,
      date: date.toISOString().split('T')[0],
      normals,
      special,
    });
    issueCounter++;
  }
  return records;
}

export const historicalData = generateHistoricalData();

export const latestDraw: DrawRecord = {
  issue: '078',
  date: '2026-03-19',
  normals: [5, 12, 18, 25, 31, 38],
  special: 39,
};

export const completeHistoricalData = [...historicalData, latestDraw];
