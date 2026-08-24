import { DrawRecord } from '../data/types';
import { ALGO_FACTORIES, computeTopN, getTypeMapper } from '../models/dynamic';
import { AlgorithmConfig, PredictionTypeConfig } from '../models/dynamic/types';

export interface BacktestBlindDetail {
  issue: string;
  predicted: string[];
  actual: string;
  hit: boolean;
}

export interface TypeBacktestResult {
  typeId: string;
  typeName: string;
  topN: number;
  lookback: number;
  totalCombos: number;
  searchHits: number;
  searchTotal: number;
  bestHitRate: number;
  bestWeights: { id: string; weight: number }[];
  blindHits: number;
  blindTotal: number;
  blindDetails: BacktestBlindDetail[];
}

/**
 * 生成权重组合候选：
 * 少算法（<=9）时按步长网格穷举；多算法或组合过多时随机采样。
 * 每组权重和为 1，最多 totalLimit 组。
 */
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

/** 加权融合各算法概率后，判断 actual 是否落在 TopN 内（不排序，O(cats)） */
function hitsTopN(
  probsRows: Record<string, number>[],
  weights: number[],
  cats: string[],
  actual: string,
  topN: number,
): boolean {
  const fused: Record<string, number> = {};
  cats.forEach(c => fused[c] = 0);
  probsRows.forEach((probs, i) => {
    const w = weights[i];
    if (!w) return;
    for (const c of cats) {
      const p = probs[c];
      if (p) fused[c] += w * p;
    }
  });
  const pa = fused[actual];
  if (pa == null) return false;
  let higher = 0;
  for (const c of cats) {
    if (fused[c] > pa) higher++;
    if (higher >= topN) return false;
  }
  return true;
}

/** 加权融合并返回完整排序（用于盲测明细展示） */
function fuseAndRank(
  probsRows: Record<string, number>[],
  weights: number[],
  cats: string[],
): { c: string; p: number }[] {
  const fused: Record<string, number> = {};
  cats.forEach(c => fused[c] = 0);
  probsRows.forEach((probs, i) => {
    const w = weights[i];
    if (!w) return;
    for (const c of cats) {
      const p = probs[c];
      if (p) fused[c] += w * p;
    }
  });
  return cats.map(c => ({ c, p: fused[c] })).sort((a, b) => b.p - a.p);
}

/**
 * 对单个预测类型做回测：
 * 1) 样本内权重寻优：在 [盲测区前 lookback 期] 的滚动窗口上（每期训练只用该期之前的数据），
 *    网格/随机搜索最优算法权重组合，目标为融合结果 TopN 命中率最大化；
 * 2) 样本外盲测：用最优权重在盲测区逐期预测并统计命中率。
 * 返回的 bestWeights 可一键写入该类型的 selectedAlgorithms 权重。
 */
export function runTypeBacktest(
  data: DrawRecord[],
  type: PredictionTypeConfig,
  globalAlgos: AlgorithmConfig[],
  options?: { lookback?: number; blindN?: number },
): TypeBacktestResult {
  if (data.length < 15) throw new Error('历史数据不足（至少 15 期）');
  const lookback = Math.max(5, Math.min(options?.lookback ?? 20, data.length - 10));
  const blindN = Math.max(0, Math.min(options?.blindN ?? 0, data.length - lookback - 5));

  const cats = type.categories;
  const getCat = getTypeMapper(type);
  const topN = computeTopN(type);
  const algos = type.selectedAlgorithms.filter(ta =>
    globalAlgos.some(ga => ga.id === ta.id && ga.enabled) && ALGO_FACTORIES[ta.id]);
  if (algos.length === 0) throw new Error(`「${type.name}」没有可用的已选算法`);

  const blindStart = data.length - blindN;
  const searchStart = blindStart - lookback;

  const seedAt = (pi: number): number =>
    (data[pi - 1]?.issue || '0').split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;

  // 预计算寻优区每期 × 每算法的概率分布（避免组合循环内重复计算）
  const searchProbs: Record<string, number>[][] = [];
  const searchActuals: string[] = [];
  for (let pi = searchStart; pi < blindStart; pi++) {
    const train = data.slice(0, pi);
    const seed = seedAt(pi);
    searchProbs.push(algos.map((ta, i) => ALGO_FACTORIES[ta.id](cats, getCat)(train, seed + i * 1000)));
    searchActuals.push(getCat(data[pi]));
  }

  // 权重寻优
  const combos = generateSearchWeights(algos.length);
  let bestWeights = combos[0];
  let bestHits = -1;
  for (const wts of combos) {
    let hits = 0;
    for (let ri = 0; ri < searchProbs.length; ri++) {
      if (hitsTopN(searchProbs[ri], wts, cats, searchActuals[ri], topN)) hits++;
    }
    if (hits > bestHits) { bestHits = hits; bestWeights = wts; }
  }

  // 盲测：最优权重逐期样本外验证
  const blindDetails: BacktestBlindDetail[] = [];
  let blindHits = 0;
  for (let pi = blindStart; pi < data.length; pi++) {
    const train = data.slice(0, pi);
    const seed = seedAt(pi);
    const probsRows = algos.map((ta, i) => ALGO_FACTORIES[ta.id](cats, getCat)(train, seed + i * 1000));
    const sorted = fuseAndRank(probsRows, bestWeights, cats);
    const actual = getCat(data[pi]);
    const predicted = sorted.slice(0, topN).map(x => x.c);
    const hit = predicted.includes(actual);
    if (hit) blindHits++;
    blindDetails.push({ issue: data[pi].issue.slice(-3), predicted, actual, hit });
  }

  return {
    typeId: type.id,
    typeName: type.name,
    topN,
    lookback,
    totalCombos: combos.length,
    searchHits: bestHits,
    searchTotal: searchProbs.length,
    bestHitRate: searchProbs.length > 0 ? bestHits / searchProbs.length : 0,
    bestWeights: algos.map((ta, i) => ({ id: ta.id, weight: bestWeights[i] })),
    blindHits,
    blindTotal: blindN,
    blindDetails,
  };
}
