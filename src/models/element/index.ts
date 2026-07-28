import { DrawRecord } from '../../data/types';
import { seededRandom } from '../../utils/helpers';
import { getElement } from '../../constants/element';

const ELEMENTS = ['金', '木', '水', '火', '土'];

export function elementFreqModel(data: DrawRecord[], seed: number): Record<string, number> {
  const rng = seededRandom(seed + 301);
  const probs: Record<string, number> = Object.fromEntries(ELEMENTS.map(e => [e, 0]));
  const recent = data.slice(-50);
  recent.forEach((d, i) => {
    const elem = getElement(d.special, new Date(d.date).getFullYear());
    if (ELEMENTS.includes(elem)) {
      probs[elem]! += ((i + 1) / recent.length) * 0.7;
    }
  });
  ELEMENTS.forEach(e => { probs[e]! += rng() * 0.1; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  ELEMENTS.forEach(e => { probs[e]! /= total; });
  return probs;
}

export function elementMarkovModel(data: DrawRecord[], seed: number): Record<string, number> {
  const rng = seededRandom(seed + 302);
  const probs: Record<string, number> = Object.fromEntries(ELEMENTS.map(e => [e, 0]));
  const recent = data.slice(-80);
  const transition: Record<string, Record<string, number>> = {};
  ELEMENTS.forEach(e => {
    transition[e] = Object.fromEntries(ELEMENTS.map(t => [t, 0.1]));
  });
  for (let i = 1; i < recent.length; i++) {
    const y1 = new Date(recent[i - 1].date).getFullYear();
    const y2 = new Date(recent[i].date).getFullYear();
    const from = getElement(recent[i - 1].special, y1);
    const to = getElement(recent[i].special, y2);
    if (ELEMENTS.includes(from) && ELEMENTS.includes(to)) {
      transition[from]![to]! += 1;
    }
  }
  const lastItem = recent[recent.length - 1];
  const lastYear = lastItem ? new Date(lastItem.date).getFullYear() : new Date().getFullYear();
  const last = lastItem ? getElement(lastItem.special, lastYear) : ELEMENTS[0];
  const lastCat = ELEMENTS.includes(last) ? last : ELEMENTS[0];
  const row = transition[lastCat]!;
  const rowTotal = Object.values(row).reduce((a, b) => a + b, 0);
  ELEMENTS.forEach(e => { probs[e] = row[e]! / rowTotal; });
  ELEMENTS.forEach(e => { probs[e]! += rng() * 0.02; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  ELEMENTS.forEach(e => { probs[e]! /= total; });
  return probs;
}

export function elementTrendModel(data: DrawRecord[], seed: number): Record<string, number> {
  const rng = seededRandom(seed + 303);
  const probs: Record<string, number> = Object.fromEntries(ELEMENTS.map(e => [e, 0]));
  const recent = data.slice(-30);
  for (let i = 0; i < recent.length; i++) {
    const elem = getElement(recent[i].special, new Date(recent[i].date).getFullYear());
    if (ELEMENTS.includes(elem)) {
      probs[elem]! += 0.1;
      if (i >= 2) {
        const prev = getElement(recent[i - 2].special, new Date(recent[i - 2].date).getFullYear());
        if (prev === elem) probs[elem]! += 0.2;
      }
    }
  }
  ELEMENTS.forEach(e => { probs[e]! += rng() * 0.2; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  ELEMENTS.forEach(e => { probs[e]! /= total; });
  return probs;
}

function getElementByRecord(d: DrawRecord): string {
  return getElement(d.special, new Date(d.date).getFullYear());
}

export function elementPatternModel(data: DrawRecord[], seed: number): Record<string, number> {
  const rng = seededRandom(seed + 304);
  const probs: Record<string, number> = Object.fromEntries(ELEMENTS.map(e => [e, 0]));
  const lastPos: Record<string, number> = {};
  const gaps: Record<string, number[]> = {};
  ELEMENTS.forEach(e => { gaps[e] = []; });
  for (let i = 0; i < data.length; i++) {
    const e = getElementByRecord(data[i]);
    if (!ELEMENTS.includes(e)) continue;
    if (lastPos[e] !== undefined) gaps[e].push(i - lastPos[e]);
    lastPos[e] = i;
  }
  const curMissing: Record<string, number> = {};
  ELEMENTS.forEach(e => { curMissing[e] = 0; });
  for (let i = data.length - 1; i >= 0; i--) {
    const e = getElementByRecord(data[i]);
    if (!ELEMENTS.includes(e)) continue;
    if (curMissing[e] === 0) curMissing[e] = data.length - 1 - i;
    if (Object.values(curMissing).every(v => v > 0)) break;
  }
  ELEMENTS.forEach(e => {
    const avgGap = gaps[e].length > 0 ? gaps[e].reduce((a, b) => a + b, 0) / gaps[e].length : 10;
    const ratio = (curMissing[e] || 0) / avgGap;
    probs[e] = ratio > 1 ? ratio : ratio * 0.5;
  });
  ELEMENTS.forEach(e => { probs[e]! += rng() * 0.05; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  ELEMENTS.forEach(e => { probs[e]! /= total; });
  return probs;
}

export function elementComboModel(data: DrawRecord[], seed: number): Record<string, number> {
  const rng = seededRandom(seed + 305);
  const probs: Record<string, number> = Object.fromEntries(ELEMENTS.map(e => [e, 0]));
  const recent = data.slice(-50);
  const freq: Record<string, number> = Object.fromEntries(ELEMENTS.map(e => [e, 0]));
  recent.forEach(d => {
    const e = getElementByRecord(d);
    if (ELEMENTS.includes(e)) freq[e]! += 1;
  });
  const maxFreq = Math.max(...Object.values(freq), 1);
  const trans: Record<string, Record<string, number>> = {};
  ELEMENTS.forEach(e => { trans[e] = Object.fromEntries(ELEMENTS.map(t => [t, 0.1])); });
  for (let i = 1; i < recent.length; i++) {
    const from = getElementByRecord(recent[i - 1]);
    const to = getElementByRecord(recent[i]);
    if (ELEMENTS.includes(from) && ELEMENTS.includes(to)) trans[from]![to]! += 1;
  }
  const last = getElementByRecord(recent[recent.length - 1]);
  const lastCat = ELEMENTS.includes(last) ? last : ELEMENTS[0];
  const row = trans[lastCat]!;
  const rowTotal = Object.values(row).reduce((a, b) => a + b, 0);
  ELEMENTS.forEach(e => {
    const freqScore = freq[e]! / maxFreq;
    const markovScore = row[e]! / rowTotal;
    probs[e] = freqScore * 0.4 + markovScore * 0.6;
  });
  ELEMENTS.forEach(e => { probs[e]! += rng() * 0.03; });
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  ELEMENTS.forEach(e => { probs[e]! /= total; });
  return probs;
}

export const elementModelFunctions: Record<string, (data: DrawRecord[], baseSeed: number) => Record<string, number>> = {
  element_freq: elementFreqModel,
  element_markov: elementMarkovModel,
  element_trend: elementTrendModel,
  element_pattern: elementPatternModel,
  element_combo: elementComboModel,
};
