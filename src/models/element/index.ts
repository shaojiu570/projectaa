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

export const elementModelFunctions: Record<string, (data: DrawRecord[], baseSeed: number) => Record<string, number>> = {
  element_freq: elementFreqModel,
  element_markov: elementMarkovModel,
  element_trend: elementTrendModel,
};
