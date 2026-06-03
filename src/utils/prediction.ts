import { DrawRecord, ModelConfig } from '../data/types';
import { FunnelConfig } from '../stores/AppContext';
import { getZodiac as defaultGetZodiac, getColor as defaultGetColor, getElement as defaultGetElement, ZODIAC_NUMBERS } from '../constants';
import { computeMarkov } from './markov';

export interface FunnelStage {
  name: string;
  description: string;
  inputCount: number;
  outputCount: number;
  candidates: number[];
}

export interface ModelOutput {
  modelId: string;
  modelName: string;
  probs: number[];
  rawWeight: number;
  normalizedWeight: number;
}

export interface PredictionResult {
  predictions: {
    number: number;
    probability: number;
    zodiac: string;
    color: string;
    element: string;
    rank: number;
  }[];
  funnelStages: FunnelStage[];
  topZodiacs: { zodiac: string; probability: number }[];
  modelOutputs: ModelOutput[];
  fusedProbs: number[];
  timestamp: string;
  activeModelCount: number;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function normalize(arr: number[]): number[] {
  const s = arr.reduce((a, b) => a + b, 0);
  return s > 0 ? arr.map(v => v / s) : arr.map(() => 1 / arr.length);
}

interface NumberFeatures {
  missingPeriods: number;
  recentFreq: number;
  isRepeat: boolean;
  isSequential: boolean;
  elementScore: number;
  colorScore: number;
  zodiacScore: number;
  tailScore: number;
  compositeScore: number;
}

function extractFeatures(data: DrawRecord[], num: number): NumberFeatures {
  const recent10 = data.slice(-10);
  const recent30 = data.slice(-30);
  const recent50 = data.slice(-50);

  let missing = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].special === num) break;
    missing++;
  }

  const freq10 = recent10.filter(d => d.special === num).length;
  const freq30 = recent30.filter(d => d.special === num).length;
  const freq50 = recent50.filter(d => d.special === num).length;

  const isRepeat = data.length > 1 && data[data.length - 1].special === num;
  const isSequential = data.length > 1 && Math.abs(data[data.length - 1].special - num) === 1;

  const currentYear = new Date().getFullYear();
  const element = defaultGetElement(num, currentYear);
  const elementFreq = recent10.filter(d => defaultGetElement(d.special, currentYear) === element).length;
  const elementScore = elementFreq / 10;

  const color = defaultGetColor(num);
  const colorFreq = recent10.filter(d => defaultGetColor(d.special) === color).length;
  const colorScore = colorFreq / 10;

  const zodiac = defaultGetZodiac(num);
  const zodiacFreq = recent10.filter(d => defaultGetZodiac(d.special) === zodiac).length;
  const zodiacScore = zodiacFreq / 10;

  const tail = num % 10;
  const tailFreq = recent10.filter(d => d.special % 10 === tail).length;
  const tailScore = tailFreq / 10;

  const composite = Math.floor(num / 10) + (num % 10);
  const compositeFreq = recent10.filter(d => Math.floor(d.special / 10) + (d.special % 10) === composite).length;
  const compositeScore = compositeFreq / 10;

  return {
    missingPeriods: missing,
    recentFreq: freq10 * 3 + freq30 * 2 + freq50,
    isRepeat,
    isSequential,
    elementScore,
    colorScore,
    zodiacScore,
    tailScore,
    compositeScore,
  };
}

function computeFeatureScore(features: NumberFeatures): number {
  let score = 0;

  if (features.missingPeriods > 30) score += 0.15;
  else if (features.missingPeriods > 20) score += 0.1;
  else if (features.missingPeriods > 10) score += 0.05;

  score += features.recentFreq * 0.02;

  if (features.isRepeat) score += 0.15;
  if (features.isSequential) score += 0.1;

  score += features.elementScore * 0.1;
  score += features.colorScore * 0.08;
  score += features.zodiacScore * 0.12;
  score += features.tailScore * 0.05;
  score += features.compositeScore * 0.05;

  return score;
}

function simulateModel(id: string, data: DrawRecord[], baseSeed: number): number[] {
  const probs = new Array(49).fill(0);
  const rng = seededRandom(baseSeed + id.split('').reduce((a, c) => a + c.charCodeAt(0), 0));

  switch (id) {
    case 'resnet': {
      const recent = data.slice(-50);
      recent.forEach((d, i) => {
        probs[d.special - 1] += ((i + 1) / recent.length) * 0.5;
      });
      const lastApp = new Array(49).fill(data.length);
      for (let i = data.length - 1; i >= 0; i--) {
        if (lastApp[data[i].special - 1] === data.length)
          lastApp[data[i].special - 1] = data.length - 1 - i;
      }
      for (let i = 0; i < 49; i++) {
        probs[i] += rng() * 0.3 + 0.1;
        if (lastApp[i] > 30) probs[i] *= 1.2;
      }
      break;
    }
    case 'lstm': {
      const recent = data.slice(-30);
      for (let i = 0; i < recent.length - 2; i++) {
        const diff = recent[i + 1].special - recent[i].special;
        const next = recent[i + 1].special + diff;
        if (next >= 1 && next <= 49) probs[next - 1] += 0.15;
      }
      recent.forEach((d, i) => probs[d.special - 1] += ((i + 1) / recent.length) * 0.4);
      for (let i = 0; i < 49; i++) probs[i] += rng() * 0.2 + 0.05;
      break;
    }
    case 'xgboost': {
      const recent = data.slice(-30);
      const nf = new Array(49).fill(0);
      recent.forEach(d => d.normals.forEach(n => nf[n - 1]++));
      for (let i = 0; i < 49; i++) probs[i] = nf[i] / (recent.length * 6) + rng() * 0.02 + 0.01;
      break;
    }
    case 'gru': {
      const recent = data.slice(-40);
      recent.forEach((d, i) => {
        probs[d.special - 1] += Math.exp(-0.05 * (recent.length - 1 - i)) * 0.3;
      });
      for (let i = 0; i < 49; i++) probs[i] += rng() * 0.15 + 0.08;
      break;
    }
    case 'transformer': {
      const recent = data.slice(-60);
      const pos = new Map<number, number[]>();
      recent.forEach((d, i) => {
        if (!pos.has(d.special)) pos.set(d.special, []);
        pos.get(d.special)!.push(i);
      });
      for (const [num, ps] of pos) {
        let att = 0;
        ps.forEach(p => att += Math.exp(-0.03 * (recent.length - 1 - p)));
        probs[num - 1] += att * 0.2;
      }
      for (let i = 0; i < 49; i++) probs[i] += rng() * 0.1 + 0.05;
      break;
    }
    case 'random_forest': {
      const freq = new Array(49).fill(0);
      data.forEach(d => freq[d.special - 1]++);
      for (let i = 0; i < 49; i++) probs[i] = freq[i] / data.length + rng() * 0.01;
      break;
    }
    case 'lightgbm': {
      const recent = data.slice(-20);
      recent.forEach(d => {
        probs[d.special - 1] += 0.2;
        d.normals.forEach(n => probs[n - 1] += 0.05);
      });
      for (let i = 0; i < 49; i++) probs[i] += rng() * 0.15 + 0.05;
      break;
    }
    case 'markov': {
      const freq = new Array(49).fill(0);
      const last = data[data.length - 1].special;
      for (let i = 0; i < data.length - 1; i++) {
        if (data[i].special === last) freq[data[i + 1].special - 1]++;
      }
      const total = freq.reduce((a: number, b: number) => a + b, 0);
      if (total > 0) {
        for (let i = 0; i < 49; i++) probs[i] = freq[i] / total + rng() * 0.005;
      } else {
        for (let i = 0; i < 49; i++) probs[i] = 1 / 49 + rng() * 0.005;
      }
      break;
    }
    case 'feature_engineered': {
      for (let i = 0; i < 49; i++) {
        const features = extractFeatures(data, i + 1);
        probs[i] = computeFeatureScore(features);
      }
      break;
    }
    default:
      for (let i = 0; i < 49; i++) probs[i] = rng();
  }

  return normalize(probs);
}

export function runMultiModelPrediction(
  data: DrawRecord[],
  models: ModelConfig[],
  funnel: FunnelConfig,
  zodiacNumbers: Record<string, number[]>,
  getZodiac: (n: number) => string,
  getColor: (n: number) => string,
  getElement: (n: number) => string,
): PredictionResult {
  const enabled = models.filter(m => m.enabled);
  if (enabled.length === 0) {
    return {
      predictions: [],
      funnelStages: [],
      topZodiacs: [],
      modelOutputs: [],
      fusedProbs: new Array(49).fill(1 / 49),
      timestamp: new Date().toISOString(),
      activeModelCount: 0,
    };
  }

  const baseSeed = data.length * 7 + 31;
  const totalWeight = enabled.reduce((s, m) => s + m.weight, 0);

  const outputs: ModelOutput[] = enabled.map(m => {
    const probs = simulateModel(m.id, data, baseSeed);
    const nw = totalWeight > 0 ? m.weight / totalWeight : 1 / enabled.length;
    return { modelId: m.id, modelName: m.name, probs, rawWeight: m.weight, normalizedWeight: nw };
  });

  const fused = new Array(49).fill(0);
  outputs.forEach(o => {
    for (let i = 0; i < 49; i++) fused[i] += o.normalizedWeight * o.probs[i];
  });
  const fusedNorm = normalize(fused);

  const stages: FunnelStage[] = [];
  const all49 = Array.from({ length: 49 }, (_, i) => i + 1);

  const sorted1 = [...all49].sort((a, b) => fusedNorm[b - 1] - fusedNorm[a - 1]);
  const keep1 = Math.max(1, Math.round(49 * funnel.level1KeepRatio));
  const s1 = sorted1.slice(0, keep1);
  stages.push({
    name: 'Level 1-1：全局剔除',
    description: `按融合概率保留前 ${(funnel.level1KeepRatio * 100).toFixed(0)}% 号码`,
    inputCount: 49,
    outputCount: s1.length,
    candidates: [...s1].sort((a, b) => a - b),
  });

  const zodiacNames = Object.keys(zodiacNumbers);
  const zodiacProbs: Record<string, number> = {};

  if (funnel.useMarkovForZodiac) {
    const markov = computeMarkov(data, '生肖');
    const resnetZP: Record<string, number> = {};
    zodiacNames.forEach(z => {
      resnetZP[z] = (zodiacNumbers[z] || []).reduce((s, n) => s + fusedNorm[n - 1], 0);
    });
    zodiacNames.forEach(z => {
      const mp = markov.predictions.find(p => p.state === z)?.probability || 0;
      zodiacProbs[z] = funnel.zodiacFusionAlpha * (resnetZP[z] || 0) + (1 - funnel.zodiacFusionAlpha) * mp;
    });
  } else {
    zodiacNames.forEach(z => {
      zodiacProbs[z] = (zodiacNumbers[z] || []).reduce((s, n) => s + fusedNorm[n - 1], 0);
    });
  }

  const sortedZ = Object.entries(zodiacProbs).sort(([, a], [, b]) => b - a);
  const topK = Math.min(funnel.zodiacTopK, sortedZ.length);
  const topZNames = new Set(sortedZ.slice(0, topK).map(([z]) => z));
  const zodiacNums = new Set<number>();
  topZNames.forEach(z => (zodiacNumbers[z] || []).forEach(n => zodiacNums.add(n)));
  const s2 = s1.filter(n => zodiacNums.has(n));

  stages.push({
    name: 'Level 1-2：生肖筛选',
    description: `保留 Top-${topK} 生肖: ${sortedZ.slice(0, topK).map(([z]) => z).join('、')}`,
    inputCount: s1.length,
    outputCount: s2.length,
    candidates: [...s2].sort((a, b) => a - b),
  });

  const scored2 = s2.map(n => {
    const z = getZodiac(n);
    const zp = zodiacProbs[z] || 0;
    return { number: n, score: fusedNorm[n - 1] * (1 + zp) };
  }).sort((a, b) => b.score - a.score);
  const s3 = scored2.slice(0, Math.min(funnel.level2KeepCount, scored2.length)).map(s => s.number);

  stages.push({
    name: 'Level 2：加权保留',
    description: `结合属性概率加权，保留前 ${funnel.level2KeepCount} 个号码`,
    inputCount: s2.length,
    outputCount: s3.length,
    candidates: [...s3].sort((a, b) => a - b),
  });

  const final = s3.map(n => ({
    number: n,
    probability: fusedNorm[n - 1],
  })).sort((a, b) => b.probability - a.probability);
  const out = final.slice(0, Math.min(funnel.level3OutputCount, final.length));

  stages.push({
    name: 'Level 3：最终排序',
    description: `融合概率排序，输出 Top-${funnel.level3OutputCount}`,
    inputCount: s3.length,
    outputCount: out.length,
    candidates: out.map(o => o.number),
  });

  const predictions = out.map((o, i) => ({
    number: o.number,
    probability: o.probability,
    zodiac: getZodiac(o.number),
    color: getColor(o.number),
    element: getElement(o.number),
    rank: i + 1,
  }));

  return {
    predictions,
    funnelStages: stages,
    topZodiacs: sortedZ.map(([zodiac, probability]) => ({ zodiac, probability })),
    modelOutputs: outputs,
    fusedProbs: fusedNorm,
    timestamp: new Date().toISOString(),
    activeModelCount: enabled.length,
  };
}

export interface PredictionConfig {
  fusionBeta: number;
  level1KeepRatio: number;
  zodiacTopK: number;
  level2KeepCount: number;
  level3OutputCount: number;
  useMarkovForZodiac: boolean;
  zodiacFusionAlpha: number;
}

export const DEFAULT_CONFIG: PredictionConfig = {
  fusionBeta: 0.7,
  level1KeepRatio: 0.6,
  zodiacTopK: 3,
  level2KeepCount: 15,
  level3OutputCount: 10,
  useMarkovForZodiac: true,
  zodiacFusionAlpha: 0.5,
};

export function runPrediction(data: DrawRecord[], config: PredictionConfig = DEFAULT_CONFIG) {
  const defaultModels: ModelConfig[] = [
    { id: 'resnet', name: 'ResNet', desc: '', enabled: true, weight: config.fusionBeta },
    { id: 'xgboost', name: 'XGBoost', desc: '', enabled: true, weight: 1 - config.fusionBeta },
  ];
  const funnel: FunnelConfig = {
    level1KeepRatio: config.level1KeepRatio,
    zodiacTopK: config.zodiacTopK,
    level2KeepCount: config.level2KeepCount,
    level3OutputCount: config.level3OutputCount,
    useMarkovForZodiac: config.useMarkovForZodiac,
    zodiacFusionAlpha: config.zodiacFusionAlpha,
  };
  return runMultiModelPrediction(data, defaultModels, funnel, ZODIAC_NUMBERS, defaultGetZodiac, defaultGetColor, defaultGetElement);
}

export interface BacktestResult {
  total: number;
  top1Hits: number;
  top3Hits: number;
  top5Hits: number;
  top10Hits: number;
  s1Recalls: number;
  s2Recalls: number;
  s3Recalls: number;
  zodiacAccuracy: number;
  colorAccuracy: number;
}

export function runBacktest(data: DrawRecord[], config: PredictionConfig = DEFAULT_CONFIG, testSize = 100): BacktestResult {
  const trainEnd = data.length - testSize;
  let top1 = 0, top3 = 0, top5 = 0, top10 = 0, s1R = 0, s2R = 0, s3R = 0, zH = 0, cH = 0;
  for (let i = 0; i < testSize; i++) {
    const trainData = data.slice(0, trainEnd + i);
    const actual = data[trainEnd + i].special;
    const result = runPrediction(trainData, config);
    const pn = result.predictions.map(p => p.number);
    if (pn[0] === actual) top1++;
    if (pn.slice(0, 3).includes(actual)) top3++;
    if (pn.slice(0, 5).includes(actual)) top5++;
    if (pn.includes(actual)) top10++;
    if (result.funnelStages[0]?.candidates.includes(actual)) s1R++;
    if (result.funnelStages[1]?.candidates.includes(actual)) s2R++;
    if (result.funnelStages[2]?.candidates.includes(actual)) s3R++;
    if (result.topZodiacs.slice(0, 3).some(z => z.zodiac === defaultGetZodiac(actual))) zH++;
    if (result.predictions[0]?.color === defaultGetColor(actual)) cH++;
  }
  return { total: testSize, top1Hits: top1, top3Hits: top3, top5Hits: top5, top10Hits: top10, s1Recalls: s1R, s2Recalls: s2R, s3Recalls: s3R, zodiacAccuracy: zH / testSize, colorAccuracy: cH / testSize };
}
