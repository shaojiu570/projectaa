import { DrawRecord } from '../../data/types';
import { seededRandom } from '../../utils/helpers';
import { getColor } from '../../constants/color';

const colors = ['红', '蓝', '绿'];

export function colorFreqModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const probs: Record<string, number> = {};
  const seed = baseSeed + 'color_freq'.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 2000;
  const rng = seededRandom(seed);
  colors.forEach(c => probs[c] = 0);
  const recent = data.slice(-50);
  recent.forEach((d, i) => {
    const color = getColor(d.special);
    probs[color] += ((i + 1) / recent.length) * 0.7;
  });
  colors.forEach(c => probs[c] += rng() * 0.1);
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  colors.forEach(c => probs[c] = total > 0 ? probs[c] / total : 1 / 3);
  return probs;
}

export function colorTrendModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const probs: Record<string, number> = {};
  const seed = baseSeed + 'color_trend'.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 2000;
  const rng = seededRandom(seed);
  colors.forEach(c => probs[c] = 0);
  const recent = data.slice(-30);
  let lastColor = getColor(recent[0].special);
  for (let i = 1; i < recent.length; i++) {
    const currentColor = getColor(recent[i].special);
    if (currentColor !== lastColor) {
      probs[currentColor] += 0.15;
    }
    lastColor = currentColor;
  }
  recent.forEach(d => {
    const color = getColor(d.special);
    probs[color] += 0.1;
  });
  colors.forEach(c => probs[c] += rng() * 0.1);
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  colors.forEach(c => probs[c] = total > 0 ? probs[c] / total : 1 / 3);
  return probs;
}

export function colorPatternModel(data: DrawRecord[], baseSeed: number): Record<string, number> {
  const probs: Record<string, number> = {};
  const seed = baseSeed + 'color_pattern'.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 2000;
  const rng = seededRandom(seed);
  colors.forEach(c => probs[c] = 0);
  const recent = data.slice(-40);
  const colorSeq = recent.map(d => getColor(d.special));
  for (let i = 0; i < colorSeq.length - 2; i++) {
    if (colorSeq[i] === colorSeq[i + 2]) {
      probs[colorSeq[i]] += 0.2;
    }
  }
  colors.forEach(c => probs[c] += rng() * 0.2);
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  colors.forEach(c => probs[c] = total > 0 ? probs[c] / total : 1 / 3);
  return probs;
}

export const colorModelFunctions: Record<string, (data: DrawRecord[], baseSeed: number) => Record<string, number>> = {
  color_freq: colorFreqModel,
  color_trend: colorTrendModel,
  color_pattern: colorPatternModel,
};

export const COLOR_MODELS = ['color_freq', 'color_trend', 'color_pattern'];
