import { DrawRecord } from '../../data/types';
import { seededRandom } from '../../utils/helpers';

const TAILS = ['0尾','1尾','2尾','3尾','4尾','5尾','6尾','7尾','8尾','9尾'];

function getTailCategory(num: number): string {
  return `${num % 10}尾`;
}

export function tailFreqModel(data: DrawRecord[], seed: number): Record<string, number> {
  const rng = seededRandom(seed + 201);
  const probs: Record<string, number> = Object.fromEntries(TAILS.map(t => [t, 0]));
  const recent = data.slice(-50);
  recent.forEach((d, i) => {
    probs[getTailCategory(d.special)]! += ((i + 1) / recent.length) * 0.7;
  });
  TAILS.forEach(t => { probs[t]! += rng() * 0.1; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  TAILS.forEach(t => { probs[t]! /= total; });
  return probs;
}

export function tailMarkovModel(data: DrawRecord[], seed: number): Record<string, number> {
  const rng = seededRandom(seed + 202);
  const probs: Record<string, number> = Object.fromEntries(TAILS.map(t => [t, 0]));
  const recent = data.slice(-80);
  const transition: Record<string, Record<string, number>> = {};
  TAILS.forEach(t => {
    transition[t] = Object.fromEntries(TAILS.map(s => [s, 0.1]));
  });
  for (let i = 1; i < recent.length; i++) {
    const from = getTailCategory(recent[i - 1].special);
    const to = getTailCategory(recent[i].special);
    transition[from]![to]! += 1;
  }
  const last = recent.length > 0 ? getTailCategory(recent[recent.length - 1].special) : TAILS[0];
  const row = transition[last]!;
  const rowTotal = Object.values(row).reduce((a, b) => a + b, 0);
  TAILS.forEach(t => { probs[t] = row[t]! / rowTotal; });
  TAILS.forEach(t => { probs[t]! += rng() * 0.02; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  TAILS.forEach(t => { probs[t]! /= total; });
  return probs;
}

export function tailTrendModel(data: DrawRecord[], seed: number): Record<string, number> {
  const rng = seededRandom(seed + 203);
  const probs: Record<string, number> = Object.fromEntries(TAILS.map(t => [t, 0]));
  const recent = data.slice(-30);
  for (let i = 0; i < recent.length; i++) {
    const t = getTailCategory(recent[i].special);
    probs[t]! += 0.1;
    if (i >= 2 && getTailCategory(recent[i - 2].special) === t) {
      probs[t]! += 0.2;
    }
  }
  TAILS.forEach(t => { probs[t]! += rng() * 0.2; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  TAILS.forEach(t => { probs[t]! /= total; });
  return probs;
}

export const tailModelFunctions: Record<string, (data: DrawRecord[], baseSeed: number) => Record<string, number>> = {
  tail_freq: tailFreqModel,
  tail_markov: tailMarkovModel,
  tail_trend: tailTrendModel,
};
