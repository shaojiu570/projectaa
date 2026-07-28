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

export function headPatternModel(data: DrawRecord[], seed: number): Record<string, number> {
  const rng = seededRandom(seed + 104);
  const probs: Record<string, number> = Object.fromEntries(HEADS.map(h => [h, 0]));
  const lastPos: Record<string, number> = {};
  const gaps: Record<string, number[]> = {};
  HEADS.forEach(h => { gaps[h] = []; });
  for (let i = 0; i < data.length; i++) {
    const h = getHeadCategory(data[i].special);
    if (lastPos[h] !== undefined) gaps[h].push(i - lastPos[h]);
    lastPos[h] = i;
  }
  const curMissing: Record<string, number> = {};
  HEADS.forEach(h => { curMissing[h] = 0; });
  for (let i = data.length - 1; i >= 0; i--) {
    const h = getHeadCategory(data[i].special);
    if (curMissing[h] === 0) curMissing[h] = data.length - 1 - i;
    if (Object.values(curMissing).every(v => v > 0)) break;
  }
  HEADS.forEach(h => {
    const avgGap = gaps[h].length > 0 ? gaps[h].reduce((a, b) => a + b, 0) / gaps[h].length : 10;
    const ratio = (curMissing[h] || 0) / avgGap;
    probs[h] = ratio > 1 ? ratio : ratio * 0.5;
  });
  HEADS.forEach(h => { probs[h]! += rng() * 0.05; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  HEADS.forEach(h => { probs[h]! /= total; });
  return probs;
}

export function headComboModel(data: DrawRecord[], seed: number): Record<string, number> {
  const rng = seededRandom(seed + 105);
  const probs: Record<string, number> = Object.fromEntries(HEADS.map(h => [h, 0]));
  const recent = data.slice(-50);
  const freq: Record<string, number> = Object.fromEntries(HEADS.map(h => [h, 0]));
  recent.forEach(d => { freq[getHeadCategory(d.special)]! += 1; });
  const maxFreq = Math.max(...Object.values(freq), 1);
  const trans: Record<string, Record<string, number>> = {};
  HEADS.forEach(h => { trans[h] = Object.fromEntries(HEADS.map(t => [t, 0.1])); });
  for (let i = 1; i < recent.length; i++) {
    trans[getHeadCategory(recent[i - 1].special)]![getHeadCategory(recent[i].special)]! += 1;
  }
  const last = getHeadCategory(recent[recent.length - 1].special);
  const row = trans[last]!;
  const rowTotal = Object.values(row).reduce((a, b) => a + b, 0);
  HEADS.forEach(h => {
    const freqScore = freq[h]! / maxFreq;
    const markovScore = row[h]! / rowTotal;
    probs[h] = freqScore * 0.4 + markovScore * 0.6;
  });
  HEADS.forEach(h => { probs[h]! += rng() * 0.03; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  HEADS.forEach(h => { probs[h]! /= total; });
  return probs;
}

export const headModelFunctions: Record<string, (data: DrawRecord[], baseSeed: number) => Record<string, number>> = {
  head_freq: headFreqModel,
  head_markov: headMarkovModel,
  head_trend: headTrendModel,
  head_pattern: headPatternModel,
  head_combo: headComboModel,
};
