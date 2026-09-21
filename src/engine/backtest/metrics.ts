/**
 * V2.0 评价指标体系
 * 
 * 支持多种指标：
 * 1. HitRate@K - 命中率
 * 2. MRR - 平均倒数排名
 * 3. LogLoss - 对数损失
 * 4. Brier Score - 布里尔分数
 * 5. Composite Score - 综合评分
 */

import { MetricsResult, EvaluationWeights } from '../types';

/**
 * 计算 HitRate@K
 */
export function computeHitRate(
  predictions: string[][],
  actuals: string[],
  k: number,
): number {
  let hits = 0;
  const n = Math.min(predictions.length, actuals.length);
  
  for (let i = 0; i < n; i++) {
    const predicted = predictions[i].slice(0, k);
    if (predicted.includes(actuals[i])) {
      hits++;
    }
  }
  
  return n > 0 ? hits / n : 0;
}

/**
 * 计算 MRR (Mean Reciprocal Rank)
 * 记录实际结果在预测排名中的位置：RR = 1 / rank
 */
export function computeMRR(
  rankedPredictions: string[][],
  actuals: string[],
): number {
  let rrSum = 0;
  const n = Math.min(rankedPredictions.length, actuals.length);
  
  for (let i = 0; i < n; i++) {
    const rank = rankedPredictions[i].indexOf(actuals[i]) + 1;
    if (rank > 0) {
      rrSum += 1 / rank;
    }
  }
  
  return n > 0 ? rrSum / n : 0;
}

/**
 * 计算 LogLoss
 * 对于概率模型：LogLoss = -log(P(actual))
 */
export function computeLogLoss(
  probabilities: Record<string, number>[],
  actuals: string[],
): number {
  let logLossSum = 0;
  const n = Math.min(probabilities.length, actuals.length);
  const epsilon = 1e-15; // 防止log(0)
  
  for (let i = 0; i < n; i++) {
    const prob = probabilities[i][actuals[i]] || epsilon;
    logLossSum += -Math.log(Math.max(prob, epsilon));
  }
  
  return n > 0 ? logLossSum / n : Infinity;
}

/**
 * 计算 Brier Score
 * 用于评价概率预测：BS = mean((p - o)^2)
 */
export function computeBrierScore(
  probabilities: Record<string, number>[],
  actuals: string[],
  allCategories: string[],
): number {
  let brierSum = 0;
  const n = Math.min(probabilities.length, actuals.length);
  
  for (let i = 0; i < n; i++) {
    let sampleBrier = 0;
    for (const cat of allCategories) {
      const p = probabilities[i][cat] || 0;
      const o = cat === actuals[i] ? 1 : 0;
      sampleBrier += (p - o) ** 2;
    }
    brierSum += sampleBrier;
  }
  
  return n > 0 ? brierSum / n : 1;
}

/**
 * 计算综合评分
 */
export function computeCompositeScore(
  metrics: MetricsResult,
  weights: EvaluationWeights,
): number {
  return (
    weights.hitRate * metrics.hitRate +
    weights.mrr * metrics.mrr +
    weights.probability * (1 - metrics.brierScore) + // 转换为正向指标
    weights.stability * (metrics.stability || 0) -
    weights.correlationPenalty * (metrics.correlationPenalty || 0) -
    weights.overfitPenalty * (metrics.overfitPenalty || 0)
  );
}

/**
 * 计算完整的指标集
 */
export function computeMetrics(
  predictions: string[][],
  probabilities: Record<string, number>[],
  actuals: string[],
  allCategories: string[],
  topKValues: number[],
  weights?: EvaluationWeights,
): MetricsResult {
  // HitRate by K
  const hitRateByK: Record<number, number> = {};
  for (const k of topKValues) {
    hitRateByK[k] = computeHitRate(predictions, actuals, k);
  }

  const hitRate = hitRateByK[1] || (topKValues.length > 0 ? hitRateByK[topKValues[0]] : 0) || 0;
  const mrr = computeMRR(predictions, actuals);
  const logLoss = computeLogLoss(probabilities, actuals);
  const brierScore = computeBrierScore(probabilities, actuals, allCategories);

  const result: MetricsResult = {
    hitRate,
    hitRateByK,
    mrr,
    logLoss,
    brierScore,
    compositeScore: 0,
  };

  // 计算综合评分
  const defaultWeights: EvaluationWeights = {
    hitRate: 0.30,
    mrr: 0.20,
    probability: 0.15,
    stability: 0.15,
    diversity: 0.10,
    correlationPenalty: 0.05,
    overfitPenalty: 0.05,
  };

  result.compositeScore = computeCompositeScore(result, weights || defaultWeights);

  return result;
}

/**
 * 比较两个指标，判断是否显著改善
 */
export function isSignificantImprovement(
  baseline: MetricsResult,
  candidate: MetricsResult,
  metric: keyof MetricsResult = 'compositeScore',
  threshold: number = 0.01,
): boolean {
  const baseVal = baseline[metric] as number;
  const candVal = candidate[metric] as number;
  return candVal - baseVal > threshold;
}

/**
 * 格式化指标用于显示
 */
export function formatMetrics(metrics: MetricsResult): string {
  return [
    `HitRate: ${(metrics.hitRate * 100).toFixed(1)}%`,
    `MRR: ${metrics.mrr.toFixed(3)}`,
    `LogLoss: ${metrics.logLoss.toFixed(3)}`,
    `Brier: ${metrics.brierScore.toFixed(3)}`,
    `Composite: ${metrics.compositeScore.toFixed(3)}`,
  ].join(', ');
}
