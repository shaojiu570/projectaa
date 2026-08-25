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
  candidateCount: number;
  selectedCount: number;
  searchHits: number;
  searchTotal: number;
  bestHitRate: number;
  bestWeights: { id: string; weight: number }[];
  individualScores: { algoId: string; hits: number }[];
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
 * 对单个预测类型做回测（候选 = 统一模型库全部已启用算法，与该类型当前勾选无关）：
 * 1) 预计算寻优窗口内每期 × 每候选算法的概率分布（每期训练只用该期之前的数据）；
 * 2) 逐个评估候选算法单独的 TopN 命中数，取最优者作为贪心起点；
 * 3) 贪心前向选择：每轮在剩余候选中等权试加，命中数提升才纳入，无提升即停；
 * 4) 权重精调：对入选子集做网格/随机权重搜索（含0权重），样本内命中率最大化；
 * 5) 样本外盲测：最优子集+权重在盲测区逐期验证。
 * 返回 bestWeights 仅含胜出模型，可一键替换该类型的 selectedAlgorithms。
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

  // 候选池：统一模型库中全部已启用算法
  const candidates = globalAlgos.filter(ga => ga.enabled && ALGO_FACTORIES[ga.id]);
  if (candidates.length === 0) throw new Error('统一模型库中没有已启用的算法');

  const blindStart = data.length - blindN;
  const searchStart = blindStart - lookback;

  const seedAt = (pi: number): number =>
    (data[pi - 1]?.issue || '0').split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;

  // 预计算寻优区每期 × 每候选算法的概率分布
  const actuals: string[] = [];
  const probsCache = new Map<string, Record<string, number>[]>();
  for (let pi = searchStart; pi < blindStart; pi++) {
    const train = data.slice(0, pi);
    const seed = seedAt(pi);
    actuals.push(getCat(data[pi]));
    candidates.forEach((ga, ci) => {
      const row = ALGO_FACTORIES[ga.id](cats, getCat)(train, seed + ci * 1000);
      let arr = probsCache.get(ga.id);
      if (!arr) { arr = []; probsCache.set(ga.id, arr); }
      arr.push(row);
    });
  }

  const evalSubset = (ids: string[], weights: number[]): number => {
    let hits = 0;
    for (let ri = 0; ri < actuals.length; ri++) {
      const rows = ids.map(id => probsCache.get(id)![ri]);
      if (hitsTopN(rows, weights, cats, actuals[ri], topN)) hits++;
    }
    return hits;
  };

  // 阶段1a：单模型评估（贪心起点）
  const individualScores = candidates
    .map(ga => ({ algoId: ga.id, hits: evalSubset([ga.id], [1]) }))
    .sort((a, b) => b.hits - a.hits);
  const chosen: string[] = [individualScores[0].algoId];
  let currentHits = individualScores[0].hits;

  // 阶段1b：贪心前向选择（等权融合，命中率提升才加入）
  while (chosen.length < candidates.length) {
    let bestAdd: { id: string; hits: number } | null = null;
    for (const ga of candidates) {
      if (chosen.includes(ga.id)) continue;
      const ids = [...chosen, ga.id];
      const hits = evalSubset(ids, ids.map(() => 1 / ids.length));
      if (hits > currentHits && (!bestAdd || hits > bestAdd.hits)) bestAdd = { id: ga.id, hits };
    }
    if (!bestAdd) break;
    chosen.push(bestAdd.id);
    currentHits = bestAdd.hits;
  }

  // 阶段2：入选子集权重精调（含0权重组合）
  let bestWeights = chosen.map(() => 1 / chosen.length);
  let bestHits = currentHits;
  const combos = generateSearchWeights(chosen.length);
  for (const wts of combos) {
    const hits = evalSubset(chosen, wts);
    if (hits > bestHits) { bestHits = hits; bestWeights = wts; }
  }

  // 盲测：胜出子集+权重逐期样本外验证
  const idxOf = new Map(candidates.map((ga, i) => [ga.id, i]));
  const blindDetails: BacktestBlindDetail[] = [];
  let blindHits = 0;
  for (let pi = blindStart; pi < data.length; pi++) {
    const train = data.slice(0, pi);
    const seed = seedAt(pi);
    const probsRows = chosen.map(id => ALGO_FACTORIES[id](cats, getCat)(train, seed + idxOf.get(id)! * 1000));
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
    candidateCount: candidates.length,
    selectedCount: chosen.length,
    searchHits: bestHits,
    searchTotal: actuals.length,
    bestHitRate: actuals.length > 0 ? bestHits / actuals.length : 0,
    bestWeights: chosen.map((id, i) => ({ id, weight: bestWeights[i] })),
    individualScores,
    blindHits,
    blindTotal: blindN,
    blindDetails,
  };
}
