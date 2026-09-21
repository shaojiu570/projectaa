/**
 * V2.0 权重优化器
 * 
 * 优化模型权重：
 * - 网格搜索
 * - 随机搜索
 * - 混合搜索
 * - 权重约束
 * - 权重稀疏化
 */

import { MetricsResult, EvaluationWeights } from '../types';
import { computeCompositeScore } from './metrics';

export interface WeightOptimizationResult {
  weights: number[];
  compositeScore: number;
  metrics: MetricsResult;
  iterations: number;
}

/**
 * 网格搜索权重优化
 */
export function gridSearchWeights(
  modelScores: MetricsResult[],
  modelCorrelations: number[][],
  weights: EvaluationWeights,
  maxWeight: number = 0.5,
  steps: number = 7,
): WeightOptimizationResult {
  const n = modelScores.length;
  if (n === 0) {
    return { weights: [], compositeScore: 0, metrics: createEmptyMetrics(), iterations: 0 };
  }

  if (n === 1) {
    return {
      weights: [1],
      compositeScore: modelScores[0].compositeScore,
      metrics: modelScores[0],
      iterations: 1,
    };
  }

  // 生成权重组合
  const stepSize = 1 / steps;
  const weightOptions = Array.from({ length: steps + 1 }, (_, i) => i * stepSize);
  
  let bestWeights: number[] = new Array(n).fill(1 / n);
  let bestScore = -Infinity;
  let iterations = 0;

  // 递归生成所有可能的权重组合
  function generateCombinations(remaining: number, currentWeights: number[]) {
    if (currentWeights.length === n - 1) {
      // 最后一个权重 = remaining
      if (remaining >= 0 && remaining <= maxWeight) {
        const allWeights = [...currentWeights, remaining];
        
        // 检查所有权重是否在限制范围内
        if (allWeights.every(w => w <= maxWeight)) {
          iterations++;
          const score = evaluateWeightCombination(
            allWeights,
            modelScores,
            modelCorrelations,
            weights,
          );
          
          if (score > bestScore) {
            bestScore = score;
            bestWeights = [...allWeights];
          }
        }
      }
      return;
    }

    for (const w of weightOptions) {
      if (w <= remaining && w <= maxWeight) {
        generateCombinations(remaining - w, [...currentWeights, w]);
      }
    }
  }

  generateCombinations(1, []);

  // 计算最佳权重对应的指标
  const bestMetrics = computeWeightedMetrics(bestWeights, modelScores);

  return {
    weights: bestWeights,
    compositeScore: bestScore,
    metrics: bestMetrics,
    iterations,
  };
}

/**
 * 随机搜索权重优化
 */
export function randomSearchWeights(
  modelScores: MetricsResult[],
  modelCorrelations: number[][],
  weights: EvaluationWeights,
  maxWeight: number = 0.5,
  iterations: number = 1000,
  randomSeed: number = 42,
): WeightOptimizationResult {
  const n = modelScores.length;
  if (n === 0) {
    return { weights: [], compositeScore: 0, metrics: createEmptyMetrics(), iterations: 0 };
  }

  if (n === 1) {
    return {
      weights: [1],
      compositeScore: modelScores[0].compositeScore,
      metrics: modelScores[0],
      iterations: 1,
    };
  }

  const rng = seededRandom(randomSeed);
  let bestWeights: number[] = new Array(n).fill(1 / n);
  let bestScore = -Infinity;
  let actualIterations = 0;

  for (let iter = 0; iter < iterations; iter++) {
    // 生成随机权重
    const rawWeights = Array.from({ length: n }, () => rng());
    const sum = rawWeights.reduce((a, b) => a + b, 0);
    const normalizedWeights = rawWeights.map(w => w / sum);

    // 检查权重限制
    if (normalizedWeights.every(w => w <= maxWeight)) {
      actualIterations++;
      const score = evaluateWeightCombination(
        normalizedWeights,
        modelScores,
        modelCorrelations,
        weights,
      );

      if (score > bestScore) {
        bestScore = score;
        bestWeights = [...normalizedWeights];
      }
    }
  }

  const bestMetrics = computeWeightedMetrics(bestWeights, modelScores);

  return {
    weights: bestWeights,
    compositeScore: bestScore,
    metrics: bestMetrics,
    iterations: actualIterations,
  };
}

/**
 * 混合搜索：先网格搜索，再随机精调
 */
export function hybridSearchWeights(
  modelScores: MetricsResult[],
  modelCorrelations: number[][],
  weights: EvaluationWeights,
  maxWeight: number = 0.5,
): WeightOptimizationResult {
  const n = modelScores.length;
  
  // 对于小规模问题，使用网格搜索
  if (n <= 5) {
    return gridSearchWeights(modelScores, modelCorrelations, weights, maxWeight);
  }
  
  // 对于大规模问题，先随机搜索，再局部精调
  const randomResult = randomSearchWeights(
    modelScores,
    modelCorrelations,
    weights,
    maxWeight,
    500,
  );

  // 在随机搜索结果附近进行局部精调
  const refinedResult = localRefinement(
    randomResult.weights,
    modelScores,
    modelCorrelations,
    weights,
    maxWeight,
  );

  return refinedResult.compositeScore > randomResult.compositeScore
    ? refinedResult
    : randomResult;
}

/**
 * 局部精调
 */
function localRefinement(
  initialWeights: number[],
  modelScores: MetricsResult[],
  modelCorrelations: number[][],
  weights: EvaluationWeights,
  maxWeight: number,
  iterations: number = 100,
): WeightOptimizationResult {
  const n = initialWeights.length;
  let bestWeights = [...initialWeights];
  let bestScore = evaluateWeightCombination(bestWeights, modelScores, modelCorrelations, weights);

  for (let iter = 0; iter < iterations; iter++) {
    // 随机选择两个权重进行调整
    const i = Math.floor(Math.random() * n);
    const j = Math.floor(Math.random() * n);
    if (i === j) continue;

    // 随机调整量
    const delta = (Math.random() - 0.5) * 0.1;
    
    const newWeights = [...bestWeights];
    newWeights[i] += delta;
    newWeights[j] -= delta;

    // 检查约束
    if (newWeights.every(w => w >= 0 && w <= maxWeight)) {
      const score = evaluateWeightCombination(newWeights, modelScores, modelCorrelations, weights);
      if (score > bestScore) {
        bestScore = score;
        bestWeights = newWeights;
      }
    }
  }

  const bestMetrics = computeWeightedMetrics(bestWeights, modelScores);

  return {
    weights: bestWeights,
    compositeScore: bestScore,
    metrics: bestMetrics,
    iterations,
  };
}

/**
 * 评估权重组合
 */
function evaluateWeightCombination(
  weights: number[],
  modelScores: MetricsResult[],
  modelCorrelations: number[][],
  evalWeights: EvaluationWeights,
): number {
  const n = weights.length;
  if (n === 0) return 0;

  // 计算加权指标
  let hitRateSum = 0;
  let mrrSum = 0;
  let logLossSum = 0;
  let brierSum = 0;

  for (let i = 0; i < n; i++) {
    hitRateSum += weights[i] * modelScores[i].hitRate;
    mrrSum += weights[i] * modelScores[i].mrr;
    logLossSum += weights[i] * modelScores[i].logLoss;
    brierSum += weights[i] * modelScores[i].brierScore;
  }

  const metrics: MetricsResult = {
    hitRate: hitRateSum,
    hitRateByK: {},
    mrr: mrrSum,
    logLoss: logLossSum,
    brierScore: brierSum,
    compositeScore: 0,
  };

  // 计算多样性（1 - 加权平均相关性）
  let weightedCorrelation = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      weightedCorrelation += weights[i] * weights[j] * Math.abs(modelCorrelations[i]?.[j] || 0);
    }
  }
  const diversity = 1 - weightedCorrelation;

  // 综合评分
  return computeCompositeScore(metrics, {
    ...evalWeights,
    diversity,
    correlationPenalty: weightedCorrelation,
  });
}

/**
 * 计算加权指标
 */
function computeWeightedMetrics(
  weights: number[],
  modelScores: MetricsResult[],
): MetricsResult {
  const n = weights.length;
  if (n === 0) return createEmptyMetrics();

  let hitRateSum = 0;
  let mrrSum = 0;
  let logLossSum = 0;
  let brierSum = 0;

  for (let i = 0; i < n; i++) {
    hitRateSum += weights[i] * modelScores[i].hitRate;
    mrrSum += weights[i] * modelScores[i].mrr;
    logLossSum += weights[i] * modelScores[i].logLoss;
    brierSum += weights[i] * modelScores[i].brierScore;
  }

  return {
    hitRate: hitRateSum,
    hitRateByK: {},
    mrr: mrrSum,
    logLoss: logLossSum,
    brierScore: brierSum,
    compositeScore: 0,
  };
}

/**
 * 权重稀疏化：剔除接近零的权重
 */
export function sparsifyWeights(
  weights: number[],
  threshold: number = 0.03,
): { weights: number[]; removedIndices: number[] } {
  const removedIndices: number[] = [];
  const sparseWeights = weights.map((w, i) => {
    if (w < threshold) {
      removedIndices.push(i);
      return 0;
    }
    return w;
  });

  // 重新归一化
  const sum = sparseWeights.reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (let i = 0; i < sparseWeights.length; i++) {
      sparseWeights[i] /= sum;
    }
  }

  return { weights: sparseWeights, removedIndices };
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
 * 简单的种子随机数生成器
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
