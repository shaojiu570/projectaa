/**
 * V2.0 子集搜索
 * 
 * 全子集搜索算法：
 * - 穷举搜索 (2^n - 1)
 * - 剪枝搜索
 * - 评估每个子集的综合得分
 */

import { EvaluationWeights, MetricsResult } from '../types';
import { computeCompositeScore } from './metrics';

export interface SubsetResult {
  modelIndices: number[];
  weight: number;
  compositeScore: number;
  metrics: MetricsResult;
}

/**
 * 穷举搜索所有可能的模型子集
 */
export function exhaustiveSubsetSearch(
  modelScores: MetricsResult[],
  modelCorrelations: number[][],
  weights: EvaluationWeights,
  maxModels?: number,
): SubsetResult[] {
  const n = modelScores.length;
  if (n === 0) return [];

  const totalSubsets = (1 << n) - 1;
  const results: SubsetResult[] = [];

  // 遍历所有非空子集
  for (let mask = 1; mask <= totalSubsets; mask++) {
    const subsetIndices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        subsetIndices.push(i);
      }
    }

    // 检查子集大小限制
    if (maxModels && subsetIndices.length > maxModels) {
      continue;
    }

    // 计算子集的综合得分
    const subsetResult = evaluateSubset(
      subsetIndices,
      modelScores,
      modelCorrelations,
      weights,
    );

    results.push(subsetResult);
  }

  // 按综合得分排序
  results.sort((a, b) => b.compositeScore - a.compositeScore);

  return results;
}

/**
 * 评估单个子集
 */
export function evaluateSubset(
  modelIndices: number[],
  modelScores: MetricsResult[],
  modelCorrelations: number[][],
  weights: EvaluationWeights,
): SubsetResult {
  const n = modelIndices.length;
  if (n === 0) {
    return {
      modelIndices: [],
      weight: 0,
      compositeScore: 0,
      metrics: createEmptyMetrics(),
    };
  }

  // 计算子集的平均性能指标
  let hitRateSum = 0;
  let mrrSum = 0;
  let logLossSum = 0;
  let brierSum = 0;

  for (const idx of modelIndices) {
    const score = modelScores[idx];
    hitRateSum += score.hitRate;
    mrrSum += score.mrr;
    logLossSum += score.logLoss;
    brierSum += score.brierScore;
  }

  const metrics: MetricsResult = {
    hitRate: hitRateSum / n,
    hitRateByK: computeAverageHitRateByK(modelIndices, modelScores),
    mrr: mrrSum / n,
    logLoss: logLossSum / n,
    brierScore: brierSum / n,
    compositeScore: 0,
  };

  // 计算多样性（1 - 平均相关性）
  const avgCorrelation = computeSubsetCorrelation(modelIndices, modelCorrelations);
  const diversity = 1 - avgCorrelation;

  // 计算相关性惩罚
  const correlationPenalty = avgCorrelation;

  // 综合评分
  metrics.compositeScore = computeCompositeScore(metrics, {
    ...weights,
    diversity,
    correlationPenalty,
  });

  return {
    modelIndices,
    weight: 1 / n, // 等权重
    compositeScore: metrics.compositeScore,
    metrics,
  };
}

/**
 * 计算子集的平均相关性
 */
export function computeSubsetCorrelation(
  modelIndices: number[],
  modelCorrelations: number[][],
): number {
  const n = modelIndices.length;
  if (n <= 1) return 0;

  let sumCorrelation = 0;
  let count = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const idx1 = modelIndices[i];
      const idx2 = modelIndices[j];
      if (modelCorrelations[idx1] && modelCorrelations[idx1][idx2] !== undefined) {
        sumCorrelation += Math.abs(modelCorrelations[idx1][idx2]);
        count++;
      }
    }
  }

  return count > 0 ? sumCorrelation / count : 0;
}

/**
 * 计算平均 HitRate by K
 */
function computeAverageHitRateByK(
  modelIndices: number[],
  modelScores: MetricsResult[],
): Record<number, number> {
  const result: Record<number, number> = {};
  const kValues = new Set<number>();

  // 收集所有K值
  for (const idx of modelIndices) {
    for (const k of Object.keys(modelScores[idx].hitRateByK)) {
      kValues.add(parseInt(k));
    }
  }

  // 计算每个K值的平均命中率
  for (const k of kValues) {
    let sum = 0;
    let count = 0;
    for (const idx of modelIndices) {
      if (modelScores[idx].hitRateByK[k] !== undefined) {
        sum += modelScores[idx].hitRateByK[k];
        count++;
      }
    }
    result[k] = count > 0 ? sum / count : 0;
  }

  return result;
}

/**
 * 剪枝搜索（用于模型数量较多时）
 */
export function prunedSubsetSearch(
  modelScores: MetricsResult[],
  modelCorrelations: number[][],
  weights: EvaluationWeights,
  maxModels: number,
  beamWidth: number = 100,
): SubsetResult[] {
  const n = modelScores.length;
  if (n === 0) return [];

  // 按单模型性能排序
  const sortedIndices = modelScores
    .map((score, idx) => ({ idx, score: score.compositeScore }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.idx);

  // Beam Search
  let currentBeam: SubsetResult[] = [];

  // 从单模型开始
  for (const idx of sortedIndices.slice(0, beamWidth)) {
    const result = evaluateSubset([idx], modelScores, modelCorrelations, weights);
    currentBeam.push(result);
  }

  // 逐步扩展子集
  for (let size = 2; size <= Math.min(maxModels, n); size++) {
    const nextBeam: SubsetResult[] = [];

    for (const current of currentBeam) {
      // 尝试添加每个未选中的模型
      for (const idx of sortedIndices) {
        if (current.modelIndices.includes(idx)) continue;

        const newIndices = [...current.modelIndices, idx];
        const result = evaluateSubset(newIndices, modelScores, modelCorrelations, weights);
        nextBeam.push(result);
      }
    }

    // 保留得分最高的beamWidth个
    nextBeam.sort((a, b) => b.compositeScore - a.compositeScore);
    currentBeam = nextBeam.slice(0, beamWidth);
  }

  return currentBeam.sort((a, b) => b.compositeScore - a.compositeScore);
}

/**
 * 创建空的指标对象
 */
function createEmptyMetrics(): MetricsResult {
  return {
    hitRate: 0,
    hitRateByK: {},
    mrr: 0,
    logLoss: Infinity,
    brierScore: 1,
    compositeScore: 0,
  };
}

/**
 * 格式化子集结果
 */
export function formatSubsetResult(
  result: SubsetResult,
  modelIds: string[],
): string {
  const modelNames = result.modelIndices.map(idx => modelIds[idx] || `Model ${idx}`);
  return [
    `Models: ${modelNames.join(', ')}`,
    `Composite Score: ${result.compositeScore.toFixed(3)}`,
    `HitRate: ${(result.metrics.hitRate * 100).toFixed(1)}%`,
    `MRR: ${result.metrics.mrr.toFixed(3)}`,
  ].join(' | ');
}
