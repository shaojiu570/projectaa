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

/** 返回 fused 后 actual 类别是否落在 TopN 内（O(C*subset) 计算并排序选 topN） */
function evalSubsetHits(
  scoreMatrix: number[][][],
  actualIdx: number[],
  topN: number,
  subset: number[],
  weights: number[],
): number {
  const C = scoreMatrix[0][0].length;
  const order = new Array(C).fill(0).map((_, i) => i);
  let hits = 0;
  for (let r = 0; r < scoreMatrix.length; r++) {
    const fused = new Array(C).fill(0);
    for (let i = 0; i < subset.length; i++) {
      const w = weights[i];
      if (!w) continue;
      const row = scoreMatrix[r][subset[i]];
      for (let c = 0; c < C; c++) fused[c] += row[c] * w;
    }
    order.sort((a, b) => fused[b] - fused[a]);
    const a = actualIdx[r];
    let hit = false;
    for (let k = 0; k < topN && k < C; k++) {
      if (order[k] === a) { hit = true; break; }
    }
    if (hit) hits++;
  }
  return hits;
}

/** 对入选子集做权重网格 + 随机精调（含 0 权重，自动剔除） */
function refineWeights(
  scoreMatrix: number[][][],
  actualIdx: number[],
  topN: number,
  subset: number[],
  baseHits: number,
): { weights: number[]; hits: number } {
  const n = subset.length;
  if (n === 0) return { weights: [], hits: 0 };
  let bestWeights = subset.map(() => 1 / n);
  let bestHits = baseHits;

  if (n <= 5) {
    const STEPS = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1.0];
    const combos: number[][] = [];
    const dfs = (idx: number, remaining: number, cur: number[]) => {
      if (combos.length >= 30000) return;
      if (idx === n - 1) {
        const v = Math.round(remaining * 100) / 100;
        if (v >= -0.001) { cur.push(Math.max(0, v)); combos.push([...cur]); cur.pop(); }
        return;
      }
      for (const s of STEPS) {
        if (combos.length >= 30000) return;
        const v = Math.round(s * 100) / 100;
        if (v > remaining + 0.001) break;
        cur.push(v);
        dfs(idx + 1, Math.round((remaining - v) * 100) / 100, cur);
        cur.pop();
      }
    };
    dfs(0, 1, []);
    for (const cb of combos) {
      const sum = cb.reduce((a, b) => a + b, 0);
      if (sum < 0.01) continue;
      const w = cb.map(x => x / sum);
      const hits = evalSubsetHits(scoreMatrix, actualIdx, topN, subset, w);
      if (hits > bestHits) { bestHits = hits; bestWeights = w; }
    }
  }

  for (let iter = 0; iter < 30; iter++) {
    const candidate = bestWeights.map(w => Math.max(0, w + (Math.random() - 0.5) * 0.12));
    const sum = candidate.reduce((a, b) => a + b, 0);
    if (sum < 0.01) continue;
    const w = candidate.map(x => x / sum);
    const hits = evalSubsetHits(scoreMatrix, actualIdx, topN, subset, w);
    if (hits > bestHits) { bestHits = hits; bestWeights = w; }
  }

  return { weights: bestWeights, hits: bestHits };
}

/**
 * 对单个预测类型做穷举回测（候选 = 统一模型库全部已启用算法，与该类型当前勾选无关）：
 * 1) 预计算寻优窗口内每期 × 每候选算法的类别概率分布（训练只用该期之前数据）；
 * 2) N+N 穷举：遍历全部 2^n-1 个算法子集，以等权融合的样本内 TopN 命中数为准则，取全局最优子集；
 * 3) 权重精调：对最优子集做网格/随机权重搜索（含 0 权重）；
 * 4) 样本外盲测：最优子集+权重在盲测区逐期验证。
 * 返回 bestWeights 仅含胜出模型，可一键替换该类型的 selectedAlgorithms。
 */
export async function runExhaustiveBacktest(
  data: DrawRecord[],
  type: PredictionTypeConfig,
  globalAlgos: AlgorithmConfig[],
  options?: { lookback?: number; blindN?: number },
  onProgress?: (phase: number, current: number, total: number) => void,
): Promise<TypeBacktestResult> {
  if (data.length < 15) throw new Error('历史数据不足（至少 15 期）');
  const lookback = Math.max(5, Math.min(options?.lookback ?? 20, data.length - 10));
  const blindN = Math.max(0, Math.min(options?.blindN ?? 0, data.length - lookback - 5));

  const cats = type.categories;
  const getCat = getTypeMapper(type);
  const topN = computeTopN(type);

  const candidates = globalAlgos.filter(ga => ga.enabled && ALGO_FACTORIES[ga.id]);
  if (candidates.length === 0) throw new Error('统一模型库中没有已启用的算法');
  const ids = candidates.map(ga => ga.id);

  const blindStart = data.length - blindN;
  const searchStart = blindStart - lookback;

  const seedAt = (pi: number): number =>
    (data[pi - 1]?.issue || '0').split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;

  const totalRecords = blindStart - searchStart;
  // 预计算：每期 × 每候选算法的类别概率向量
  const scoreMatrix: number[][][] = [];
  const actualIdx: number[] = [];
  const catIdx = new Map(cats.map((c, i) => [c, i]));
  onProgress?.(1, 0, totalRecords);
  for (let pi = searchStart; pi < blindStart; pi++) {
    const train = data.slice(0, pi);
    const seed = seedAt(pi);
    const actual = getCat(data[pi]);
    actualIdx.push(catIdx.get(actual) ?? 0);
    const row: number[][] = [];
    for (let ci = 0; ci < candidates.length; ci++) {
      const probs = ALGO_FACTORIES[candidates[ci].id](cats, getCat)(train, seed + ci * 1000);
      row.push(cats.map(c => probs[c] || 0));
    }
    scoreMatrix.push(row);
    if ((pi - searchStart + 1) % 20 === 0) onProgress?.(1, pi - searchStart + 1, totalRecords);
    if ((pi - searchStart + 1) % 100 === 0) await new Promise(r => setTimeout(r, 0));
  }

  // 单模型命中（用于明细展示）
  const individualScores = candidates.map((ga, ci) => ({
    algoId: ga.id,
    hits: evalSubsetHits(scoreMatrix, actualIdx, topN, [ci], [1]),
  })).sort((a, b) => b.hits - a.hits);

  // N+N 穷举：全部 2^n-1 个非空子集，等权融合，取样本内命中率全局最优
  const n = candidates.length;
  const totalSubsets = (1 << n) - 1;
  let bestHits = -1;
  let bestSubset: number[] = [];
  onProgress?.(2, 0, totalSubsets);

  const CHUNK = 400;
  let mask = 1;
  await new Promise<void>((resolve) => {
    function processChunk() {
      const end = Math.min(mask + CHUNK, totalSubsets + 1);
      for (; mask < end; mask++) {
        const subset: number[] = [];
        for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(i);
        const w = 1 / subset.length;
        const hits = evalSubsetHits(scoreMatrix, actualIdx, topN, subset, subset.map(() => w));
        if (hits > bestHits) { bestHits = hits; bestSubset = [...subset]; }
      }
      onProgress?.(2, Math.min(mask - 1, totalSubsets), totalSubsets);
      if (mask <= totalSubsets) setTimeout(processChunk, 0);
      else resolve();
    }
    processChunk();
  });

  const refined = refineWeights(scoreMatrix, actualIdx, topN, bestSubset, bestHits);
  const weightsArr = refined.weights;

  // 盲测：胜出子集+权重逐期样本外验证（重新计算分布）
  const blindDetails: BacktestBlindDetail[] = [];
  let blindHits = 0;
  for (let pi = blindStart; pi < data.length; pi++) {
    const train = data.slice(0, pi);
    const seed = seedAt(pi);
    const fused = new Array(cats.length).fill(0);
    for (let i = 0; i < bestSubset.length; i++) {
      const probs = ALGO_FACTORIES[ids[bestSubset[i]]](cats, getCat)(train, seed + bestSubset[i] * 1000);
      const w = weightsArr[i];
      for (let c = 0; c < cats.length; c++) fused[c] += (probs[cats[c]] || 0) * w;
    }
    const order = Array.from({ length: cats.length }, (_, i) => i).sort((a, b) => fused[b] - fused[a]);
    const predicted = order.slice(0, topN).map(i => cats[i]);
    const actual = getCat(data[pi]);
    const hit = predicted.includes(actual);
    if (hit) blindHits++;
    blindDetails.push({ issue: data[pi].issue.slice(-3), predicted, actual, hit });
  }

  onProgress?.(3, 1, 1);

  return {
    typeId: type.id,
    typeName: type.name,
    topN,
    lookback,
    candidateCount: candidates.length,
    selectedCount: bestSubset.length,
    searchHits: refined.hits,
    searchTotal: totalRecords,
    bestHitRate: totalRecords > 0 ? refined.hits / totalRecords : 0,
    bestWeights: bestSubset.map((idx, i) => ({
      id: ids[idx],
      weight: parseFloat(weightsArr[i].toFixed(2)),
    })),
    individualScores,
    blindHits,
    blindTotal: blindN,
    blindDetails,
  };
}
