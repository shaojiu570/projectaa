import { DrawRecord } from '../data/types';
import { getZodiacByNumber } from '../utils/lunarCalendar';
import { getElement } from '../constants/element';
import {
  resolveUnifiedModelFn, getUnifiedModels,
  ZODIAC_CATS, HEAD_CATS, TAIL_CATS, ELEMENT_CATS,
} from '../models/library';
import type { SeparatedModelType } from '../stores/SeparatedModelContext';

export interface BacktestTypeConfig {
  id: string;
  name: string;
  modelIds: string[];
  resolveFn: (modelId: string) => (data: DrawRecord[], seed: number) => Record<string, number> | number[];
  outputType: 'category_map' | 'number_array';
  categories?: string[];
  getActual: (d: DrawRecord) => string | number;
}

export const MODEL_NAMES: Record<string, string> = Object.fromEntries(
  getUnifiedModels('number').concat(
    getUnifiedModels('zodiac'),
    getUnifiedModels('head'),
    getUnifiedModels('tail'),
    getUnifiedModels('element'),
  ).map(m => [m.id, m.name]),
);

const allModelIdsFor = (type: SeparatedModelType) => getUnifiedModels(type).map(m => m.id);

export const BACKTEST_TYPES: BacktestTypeConfig[] = [
  {
    id: 'zodiac', name: '生肖',
    modelIds: allModelIdsFor('zodiac'),
    resolveFn: id => resolveUnifiedModelFn('zodiac', id),
    outputType: 'category_map',
    categories: ZODIAC_CATS,
    getActual: d => getZodiacByNumber(new Date(d.date), d.special),
  },
  {
    id: 'head', name: '头数',
    modelIds: allModelIdsFor('head'),
    resolveFn: id => resolveUnifiedModelFn('head', id),
    outputType: 'category_map',
    categories: HEAD_CATS,
    getActual: d => `${Math.floor((d.special - 1) / 10)}头`,
  },
  {
    id: 'tail', name: '尾数',
    modelIds: allModelIdsFor('tail'),
    resolveFn: id => resolveUnifiedModelFn('tail', id),
    outputType: 'category_map',
    categories: TAIL_CATS,
    getActual: d => `${d.special % 10}尾`,
  },
  {
    id: 'element', name: '五行',
    modelIds: allModelIdsFor('element'),
    resolveFn: id => resolveUnifiedModelFn('element', id),
    outputType: 'category_map',
    categories: ELEMENT_CATS,
    getActual: d => {
      const e = getElement(d.special, new Date(d.date).getFullYear());
      return ELEMENT_CATS.includes(e) ? e : '金';
    },
  },
  {
    id: 'number', name: '号码',
    modelIds: allModelIdsFor('number'),
    resolveFn: id => resolveUnifiedModelFn('number', id),
    outputType: 'number_array',
    getActual: d => d.special,
  },
];

export function generateSearchWeights(n: number): number[][] {
  const totalLimit = n >= 10 ? 15000 : n >= 7 ? 20000 : 50000;
  const step = n <= 6 ? 0.1 : n <= 9 ? 0.15 : 0.2;
  const results: number[][] = [];

  if (n <= 9) {
    function dfs(idx: number, remaining: number, cur: number[]) {
      if (results.length >= totalLimit) return;
      if (idx === n - 1) {
        const v = Math.round(remaining * 100) / 100;
        if (v >= 0) { cur.push(v); results.push([...cur]); cur.pop(); }
        return;
      }
      const max = Math.round(remaining / step);
      for (let i = 0; i <= max; i++) {
        if (results.length >= totalLimit) return;
        const v = Math.round(i * step * 100) / 100;
        if (v > remaining + 0.001) break;
        cur.push(v);
        dfs(idx + 1, Math.round((remaining - v) * 100) / 100, cur);
        cur.pop();
      }
    }
    dfs(0, 1, []);
  }

  if (results.length === 0 || n >= 10) {
    while (results.length < totalLimit) {
      const raw = Array.from({ length: n }, () => Math.random());
      const sum = raw.reduce((a, b) => a + b, 0);
      results.push(raw.map(v => Math.round(v / sum * 100) / 100));
    }
  }

  for (let i = results.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [results[i], results[j]] = [results[j], results[i]];
  }
  return results.slice(0, totalLimit);
}

export function buildBacktestType(typeId: string, selectedIds: string[]): BacktestTypeConfig | null {
  const base = BACKTEST_TYPES.find(t => t.id === typeId);
  if (!base) return null;
  const modelIds = base.modelIds.filter(id => selectedIds.includes(id));
  if (modelIds.length === 0) return null;
  return { ...base, modelIds };
}

export function runBacktest(
  data: DrawRecord[],
  typeConfig: BacktestTypeConfig,
  lookback: number,
  topN: number,
  options?: { blindN?: number; onProgress?: (current: number, total: number) => void },
): {
  bestWeights: { id: string; weight: number }[];
  bestHitRate: number;
  totalCombos: number;
  bestBlindHitRate: number;
  blindHits: number;
  blindTotal: number;
} {
  const { modelIds, resolveFn, outputType, categories, getActual } = typeConfig;
  const n = modelIds.length;
  const onProgress = options?.onProgress;
  const blindN = Math.max(0, Math.min(options?.blindN ?? 0, data.length - 10));
  const blindStart = data.length - blindN;

  if (data.length < lookback + blindN + 5) {
    throw new Error(`数据不足，需要至少 ${lookback + blindN + 5} 期`);
  }

  const allCombos = generateSearchWeights(n);
  const total = allCombos.length;
  let bestWeights = allCombos[0];
  let bestHitRate = 0;

  for (let ci = 0; ci < total; ci++) {
    const weights = allCombos[ci];
    let hits = 0;

    for (let pi = blindStart - lookback; pi < blindStart; pi++) {
      const trainData = data.slice(0, pi);
      const testRecord = data[pi];
      const lastIssue = trainData[trainData.length - 1]?.issue || '0';
      const seed = lastIssue.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;

      if (outputType === 'category_map' && categories) {
        const fused: Record<string, number> = {};
        categories.forEach(c => fused[c] = 0);
        modelIds.forEach((id, i) => {
          const probs = resolveFn(id)(trainData, seed + i * 1000) as Record<string, number>;
          Object.entries(probs).forEach(([c, p]) => { fused[c] = (fused[c] || 0) + weights[i] * p; });
        });
        const totalP = Object.values(fused).reduce((a, b) => a + b, 0) || 1;
        categories.forEach(c => fused[c] = (fused[c] || 0) / totalP);

        const sorted = categories.map(c => ({ c, p: fused[c] || 0 })).sort((a, b) => b.p - a.p);
        const actual = getActual(testRecord) as string;
        const rank = sorted.findIndex(x => x.c === actual);
        if (rank >= 0 && rank < topN) hits++;
      } else {
        const fused = new Array(49).fill(0);
        modelIds.forEach((id, i) => {
          const probs = resolveFn(id)(trainData, seed + i * 1000) as number[];
          for (let j = 0; j < 49; j++) fused[j] += weights[i] * probs[j];
        });
        const sorted = Array.from({ length: 49 }, (_, i) => i + 1)
          .map(n => ({ n, p: fused[n - 1] }))
          .sort((a, b) => b.p - a.p);
        const actual = getActual(testRecord) as number;
        const rank = sorted.findIndex(x => x.n === actual);
        if (rank >= 0 && rank < topN) hits++;
      }
    }

    const hitRate = hits / lookback;
    if (hitRate > bestHitRate) {
      bestHitRate = hitRate;
      bestWeights = weights;
    }

    if (ci % Math.max(1, Math.floor(total / 100)) === 0) {
      onProgress?.(ci + 1, total);
    }
  }

  // 样本外盲测：使用最优权重在屏蔽区逐期预测（屏蔽区数据不参与权重寻优）
  let blindHits = 0;
  if (blindN > 0) {
    for (let pi = blindStart; pi < data.length; pi++) {
      const trainData = data.slice(0, pi);
      const testRecord = data[pi];
      const lastIssue = trainData[trainData.length - 1]?.issue || '0';
      const seed = lastIssue.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;

      if (outputType === 'category_map' && categories) {
        const fused: Record<string, number> = {};
        categories.forEach(c => fused[c] = 0);
        modelIds.forEach((id, i) => {
          const w = bestWeights[i];
          const probs = resolveFn(id)(trainData, seed + i * 1000) as Record<string, number>;
          Object.entries(probs).forEach(([c, p]) => { fused[c] = (fused[c] || 0) + w * p; });
        });
        const sorted = categories.map(c => ({ c, p: fused[c] || 0 })).sort((a, b) => b.p - a.p);
        const rank = sorted.findIndex(x => x.c === getActual(testRecord) as string);
        if (rank >= 0 && rank < topN) blindHits++;
      } else {
        const fused = new Array(49).fill(0);
        modelIds.forEach((id, i) => {
          const w = bestWeights[i];
          const probs = resolveFn(id)(trainData, seed + i * 1000) as number[];
          for (let j = 0; j < 49; j++) fused[j] += w * probs[j];
        });
        const sorted = Array.from({ length: 49 }, (_, i) => i + 1)
          .map(n => ({ n, p: fused[n - 1] }))
          .sort((a, b) => b.p - a.p);
        const rank = sorted.findIndex(x => x.n === getActual(testRecord) as number);
        if (rank >= 0 && rank < topN) blindHits++;
      }
    }
  }

  return {
    bestWeights: modelIds.map((id, i) => ({ id, weight: bestWeights[i] })),
    bestHitRate,
    totalCombos: total,
    bestBlindHitRate: blindN > 0 ? blindHits / blindN : 0,
    blindHits,
    blindTotal: blindN,
  };
}
