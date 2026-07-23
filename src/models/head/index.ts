import { DrawRecord } from '../../data/types';
import { seededRandom } from '../../utils/helpers';

const HEADS = ['0头', '1头', '2头', '3头', '4头'];

function getHeadCategory(num: number): string {
  return `${Math.floor((num - 1) / 10)}头`;
}

export function headFreqModel(data: DrawRecord[], seed: number): Record<string, number> {
  const rng = seededRandom(seed + 101);
  const probs: Record<string, number> = Object.fromEntries(HEADS.map(h => [h, 0]));
  const recent = data.slice(-50);
  recent.forEach((d, i) => {
    probs[getHeadCategory(d.special)]! += ((i + 1) / recent.length) * 0.7;
  });
  HEADS.forEach(h => { probs[h]! += rng() * 0.1; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  HEADS.forEach(h => { probs[h]! /= total; });
  return probs;
}

export function headMarkovModel(data: DrawRecord[], seed: number): Record<string, number> {
  const rng = seededRandom(seed + 102);
  const probs: Record<string, number> = Object.fromEntries(HEADS.map(h => [h, 0]));
  const recent = data.slice(-80);
  const transition: Record<string, Record<string, number>> = {};
  HEADS.forEach(h => {
    transition[h] = Object.fromEntries(HEADS.map(t => [t, 0.1]));
  });
  for (let i = 1; i < recent.length; i++) {
    const from = getHeadCategory(recent[i - 1].special);
    const to = getHeadCategory(recent[i].special);
    transition[from]![to]! += 1;
  }
  const last = recent.length > 0 ? getHeadCategory(recent[recent.length - 1].special) : HEADS[0];
  const row = transition[last]!;
  const rowTotal = Object.values(row).reduce((a, b) => a + b, 0);
  HEADS.forEach(h => { probs[h] = row[h]! / rowTotal; });
  HEADS.forEach(h => { probs[h]! += rng() * 0.02; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  HEADS.forEach(h => { probs[h]! /= total; });
  return probs;
}

export function headTrendModel(data: DrawRecord[], seed: number): Record<string, number> {
  const rng = seededRandom(seed + 103);
  const probs: Record<string, number> = Object.fromEntries(HEADS.map(h => [h, 0]));
  const recent = data.slice(-30);
  for (let i = 0; i < recent.length; i++) {
    const h = getHeadCategory(recent[i].special);
    probs[h]! += 0.1;
    if (i >= 2 && getHeadCategory(recent[i - 2].special) === h) {
      probs[h]! += 0.2;
    }
  }
  HEADS.forEach(h => { probs[h]! += rng() * 0.2; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  HEADS.forEach(h => { probs[h]! /= total; });
  return probs;
}

export const headModelFunctions: Record<string, (data: DrawRecord[], baseSeed: number) => Record<string, number>> = {
  head_freq: headFreqModel,
  head_markov: headMarkovModel,
  head_trend: headTrendModel,
};
