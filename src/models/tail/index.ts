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

export function tailPatternModel(data: DrawRecord[], seed: number): Record<string, number> {
  const rng = seededRandom(seed + 204);
  const probs: Record<string, number> = Object.fromEntries(TAILS.map(t => [t, 0]));
  const lastPos: Record<string, number> = {};
  const gaps: Record<string, number[]> = {};
  TAILS.forEach(t => { gaps[t] = []; });
  for (let i = 0; i < data.length; i++) {
    const t = getTailCategory(data[i].special);
    if (lastPos[t] !== undefined) gaps[t].push(i - lastPos[t]);
    lastPos[t] = i;
  }
  const curMissing: Record<string, number> = {};
  TAILS.forEach(t => { curMissing[t] = 0; });
  for (let i = data.length - 1; i >= 0; i--) {
    const t = getTailCategory(data[i].special);
    if (curMissing[t] === 0) curMissing[t] = data.length - 1 - i;
    if (Object.values(curMissing).every(v => v > 0)) break;
  }
  TAILS.forEach(t => {
    const avgGap = gaps[t].length > 0 ? gaps[t].reduce((a, b) => a + b, 0) / gaps[t].length : 10;
    const ratio = (curMissing[t] || 0) / avgGap;
    probs[t] = ratio > 1 ? ratio : ratio * 0.5;
  });
  TAILS.forEach(t => { probs[t]! += rng() * 0.05; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  TAILS.forEach(t => { probs[t]! /= total; });
  return probs;
}

export function tailComboModel(data: DrawRecord[], seed: number): Record<string, number> {
  const rng = seededRandom(seed + 205);
  const probs: Record<string, number> = Object.fromEntries(TAILS.map(t => [t, 0]));
  const recent = data.slice(-50);
  const freq: Record<string, number> = Object.fromEntries(TAILS.map(t => [t, 0]));
  recent.forEach(d => { freq[getTailCategory(d.special)]! += 1; });
  const maxFreq = Math.max(...Object.values(freq), 1);
  const trans: Record<string, Record<string, number>> = {};
  TAILS.forEach(t => { trans[t] = Object.fromEntries(TAILS.map(s => [s, 0.1])); });
  for (let i = 1; i < recent.length; i++) {
    trans[getTailCategory(recent[i - 1].special)]![getTailCategory(recent[i].special)]! += 1;
  }
  const last = getTailCategory(recent[recent.length - 1].special);
  const row = trans[last]!;
  const rowTotal = Object.values(row).reduce((a, b) => a + b, 0);
  TAILS.forEach(t => {
    const freqScore = freq[t]! / maxFreq;
    const markovScore = row[t]! / rowTotal;
    probs[t] = freqScore * 0.4 + markovScore * 0.6;
  });
  TAILS.forEach(t => { probs[t]! += rng() * 0.03; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  TAILS.forEach(t => { probs[t]! /= total; });
  return probs;
}

export const tailModelFunctions: Record<string, (data: DrawRecord[], baseSeed: number) => Record<string, number>> = {
  tail_freq: tailFreqModel,
  tail_markov: tailMarkovModel,
  tail_trend: tailTrendModel,
  tail_pattern: tailPatternModel,
  tail_combo: tailComboModel,
};
