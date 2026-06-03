import { DrawRecord } from '../../data/types';
import { seededRandom, normalize } from '../../utils/helpers';
import { getColor } from '../../constants/color';
import { getElement } from '../../constants/element';
import { getSize } from '../../constants/size';
import { getParity } from '../../constants/parity';
import { ModelConfig } from '../../data/types';

export function resnetModel(data: DrawRecord[], baseSeed: number): number[] {
  const probs = new Array(49).fill(0);
  const seed = baseSeed + 'resnet'.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = seededRandom(seed);
  const recent = data.slice(-50);
  recent.forEach((d, i) => {
    probs[d.special - 1] += ((i + 1) / recent.length) * 0.6;
  });
  for (let i = 1; i < recent.length; i++) {
    const gap = recent[i].special - recent[i - 1].special;
    const next = recent[i].special + gap;
    if (next >= 1 && next <= 49) {
      probs[next - 1] += 0.2;
    }
  }
  for (let i = 0; i < 49; i++) probs[i] += rng() * 0.2;
  return normalize(probs);
}

export function colorMarkovModel(data: DrawRecord[], baseSeed: number): number[] {
  const probs = new Array(49).fill(0);
  const seed = baseSeed + 'color_markov'.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = seededRandom(seed);
  const recent = data.slice(-40);
  const transitions: Record<string, Record<string, number>> = {};
  for (let i = 0; i < recent.length - 1; i++) {
    const from = getColor(recent[i].special);
    const to = getColor(recent[i + 1].special);
    if (!transitions[from]) transitions[from] = {};
    transitions[from][to] = (transitions[from][to] || 0) + 1;
  }
  const lastColor = getColor(recent[recent.length - 1].special);
  if (transitions[lastColor]) {
    const total = Object.values(transitions[lastColor]).reduce((a, b) => a + b, 0);
    Object.entries(transitions[lastColor]).forEach(([c, count]) => {
      for (let n = 1; n <= 49; n++) {
        if (getColor(n) === c) {
          probs[n - 1] += (count / total) * 0.6;
        }
      }
    });
  }
  for (let i = 0; i < 49; i++) probs[i] += rng() * 0.15;
  return normalize(probs);
}

export function elementMarkovModel(data: DrawRecord[], baseSeed: number): number[] {
  const probs = new Array(49).fill(0);
  const seed = baseSeed + 'element_markov'.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = seededRandom(seed);
  const recent = data.slice(-40);
  const currentYear = new Date().getFullYear();
  const transitions: Record<string, Record<string, number>> = {};
  for (let i = 0; i < recent.length - 1; i++) {
    const from = getElement(recent[i].special, currentYear);
    const to = getElement(recent[i + 1].special, currentYear);
    if (!transitions[from]) transitions[from] = {};
    transitions[from][to] = (transitions[from][to] || 0) + 1;
  }
  const lastElement = getElement(recent[recent.length - 1].special, currentYear);
  if (transitions[lastElement]) {
    const total = Object.values(transitions[lastElement]).reduce((a, b) => a + b, 0);
    Object.entries(transitions[lastElement]).forEach(([e, count]) => {
      for (let n = 1; n <= 49; n++) {
        if (getElement(n, currentYear) === e) {
          probs[n - 1] += (count / total) * 0.6;
        }
      }
    });
  }
  for (let i = 0; i < 49; i++) probs[i] += rng() * 0.15;
  return normalize(probs);
}

export function sizeMarkovModel(data: DrawRecord[], baseSeed: number): number[] {
  const probs = new Array(49).fill(0);
  const seed = baseSeed + 'size_markov'.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = seededRandom(seed);
  const recent = data.slice(-40);
  const transitions: Record<string, Record<string, number>> = {};
  for (let i = 0; i < recent.length - 1; i++) {
    const from = getSize(recent[i].special);
    const to = getSize(recent[i + 1].special);
    if (!transitions[from]) transitions[from] = {};
    transitions[from][to] = (transitions[from][to] || 0) + 1;
  }
  const lastSize = getSize(recent[recent.length - 1].special);
  if (transitions[lastSize]) {
    const total = Object.values(transitions[lastSize]).reduce((a, b) => a + b, 0);
    Object.entries(transitions[lastSize]).forEach(([s, count]) => {
      for (let n = 1; n <= 49; n++) {
        if (getSize(n) === s) {
          probs[n - 1] += (count / total) * 0.6;
        }
      }
    });
  }
  for (let i = 0; i < 49; i++) probs[i] += rng() * 0.15;
  return normalize(probs);
}

export function parityMarkovModel(data: DrawRecord[], baseSeed: number): number[] {
  const probs = new Array(49).fill(0);
  const seed = baseSeed + 'parity_markov'.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = seededRandom(seed);
  const recent = data.slice(-40);
  const transitions: Record<string, Record<string, number>> = {};
  for (let i = 0; i < recent.length - 1; i++) {
    const from = getParity(recent[i].special);
    const to = getParity(recent[i + 1].special);
    if (!transitions[from]) transitions[from] = {};
    transitions[from][to] = (transitions[from][to] || 0) + 1;
  }
  const lastParity = getParity(recent[recent.length - 1].special);
  if (transitions[lastParity]) {
    const total = Object.values(transitions[lastParity]).reduce((a, b) => a + b, 0);
    Object.entries(transitions[lastParity]).forEach(([p, count]) => {
      for (let n = 1; n <= 49; n++) {
        if (getParity(n) === p) {
          probs[n - 1] += (count / total) * 0.6;
        }
      }
    });
  }
  for (let i = 0; i < 49; i++) probs[i] += rng() * 0.15;
  return normalize(probs);
}

export function hotTrendModel(data: DrawRecord[], baseSeed: number): number[] {
  const probs = new Array(49).fill(0);
  const seed = baseSeed + 'hot_trend'.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = seededRandom(seed);
  const recent = data.slice(-30);
  const freq = new Array(49).fill(0);
  recent.forEach(d => { freq[d.special - 1]++; });
  const maxFreq = Math.max(...freq);
  for (let i = 0; i < 49; i++) {
    probs[i] += (freq[i] / maxFreq) * 0.8;
    probs[i] += rng() * 0.2;
  }
  return normalize(probs);
}

export function coldTrendModel(data: DrawRecord[], baseSeed: number): number[] {
  const probs = new Array(49).fill(0);
  const seed = baseSeed + 'cold_trend'.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = seededRandom(seed);
  const recent = data.slice(-50);
  const lastAppear = new Array(49).fill(-1);
  for (let i = recent.length - 1; i >= 0; i--) {
    if (lastAppear[recent[i].special - 1] === -1) {
      lastAppear[recent[i].special - 1] = i;
    }
  }
  const maxGap = Math.max(...lastAppear.map(v => v === -1 ? 50 : recent.length - v));
  for (let i = 0; i < 49; i++) {
    const gap = lastAppear[i] === -1 ? 50 : recent.length - lastAppear[i];
    probs[i] += (gap / maxGap) * 0.6;
    probs[i] += rng() * 0.3;
  }
  return normalize(probs);
}

export function maTrendModel(data: DrawRecord[], baseSeed: number): number[] {
  const probs = new Array(49).fill(0);
  const seed = baseSeed + 'ma_trend'.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = seededRandom(seed);
  const recent = data.slice(-20);
  const specials = recent.map(d => d.special);
  const ma5 = specials.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const ma10 = specials.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const trend = ma5 - ma10;
  for (let i = 0; i < 49; i++) {
    const deviation = i - ma5;
    if ((trend > 0 && deviation > 0) || (trend < 0 && deviation < 0)) {
      probs[i] += 0.3;
    }
    probs[i] += Math.max(0, 0.4 - Math.abs(deviation) * 0.02);
    probs[i] += rng() * 0.25;
  }
  return normalize(probs);
}

function createNumberFallback(id: string): (data: DrawRecord[], baseSeed: number) => number[] {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return (data, baseSeed) => {
    const rng = seededRandom(baseSeed + hash);
    const probs = new Array(49).fill(0);
    for (let i = 0; i < 49; i++) probs[i] = rng();
    return normalize(probs);
  };
}

export function randomNumberModel(data: DrawRecord[], baseSeed: number): number[] {
  const rng = seededRandom(baseSeed);
  const probs = new Array(49).fill(0);
  for (let i = 0; i < 49; i++) probs[i] = rng();
  return normalize(probs);
}

export const numberModelFunctions: Record<string, (data: DrawRecord[], baseSeed: number) => number[]> = {
  resnet: resnetModel,
  color_markov: colorMarkovModel,
  element_markov: elementMarkovModel,
  size_markov: sizeMarkovModel,
  parity_markov: parityMarkovModel,
  hot_trend: hotTrendModel,
  cold_trend: coldTrendModel,
  ma_trend: maTrendModel,
  lstm: createNumberFallback('lstm'),
  xgboost: createNumberFallback('xgboost'),
  lightgbm: createNumberFallback('lightgbm'),
  hot_cold: createNumberFallback('hot_cold'),
  interval: createNumberFallback('interval'),
};

export const DEFAULT_NUMBER_MODELS: ModelConfig[] = [
  { id: 'resnet', name: '号码-ResNet', desc: '1D残差网络', enabled: true, weight: 0.2 },
  { id: 'lstm', name: '号码-LSTM', desc: '长短期记忆网络', enabled: true, weight: 0.15 },
  { id: 'xgboost', name: '号码-XGBoost', desc: '梯度提升树', enabled: true, weight: 0.1 },
  { id: 'lightgbm', name: '号码-LightGBM', desc: '轻量梯度提升', enabled: true, weight: 0.08 },
  { id: 'hot_cold', name: '号码-冷热', desc: '冷热号趋势分析', enabled: true, weight: 0.1 },
  { id: 'interval', name: '号码-间隔', desc: '号码间隔分析', enabled: true, weight: 0.07 },
  { id: 'color_markov', name: '号码-波色马尔可夫', desc: '波色转移矩阵', enabled: true, weight: 0.1 },
  { id: 'element_markov', name: '号码-五行马尔可夫', desc: '五行转移矩阵', enabled: true, weight: 0.1 },
  { id: 'size_markov', name: '号码-大小马尔可夫', desc: '大小转移矩阵', enabled: true, weight: 0.05 },
  { id: 'parity_markov', name: '号码-奇偶马尔可夫', desc: '奇偶转移矩阵', enabled: true, weight: 0.05 },
  { id: 'hot_trend', name: '号码-热号趋势', desc: '近期热号加权', enabled: true, weight: 0.08 },
  { id: 'cold_trend', name: '号码-冷号趋势', desc: '遗漏较大号码', enabled: true, weight: 0.05 },
  { id: 'ma_trend', name: '号码-MA趋势', desc: '移动平均趋势', enabled: true, weight: 0.07 },
];
