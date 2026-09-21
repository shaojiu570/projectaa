/**
 * V2.0 Walk-Forward 主引擎
 * 
 * 整合所有模块，实现完整的 Walk-Forward 回测：
 * 1. 数据验证
 * 2. 创建 Walk-Forward 窗口
 * 3. 每个窗口：训练 → 验证 → 测试
 * 4. 汇总所有 OOS 结果
 * 5. 稳定性分析
 * 6. 过拟合检测
 * 7. 与 Baseline 比较
 */

import { DrawRecord } from '../../data/types';
import { PredictionTypeConfig } from '../../models/dynamic/types';
import { AlgorithmConfig } from '../../models/dynamic/types';
import {
  BacktestConfig,
  BacktestResultV2,
  WalkForwardResult,
  MetricsResult,
} from '../types';
import {
  ALGO_FACTORIES,
  getTypeMapper,
} from '../../models/dynamic';
import { createWalkForwardWindows, getTrainData, getValidationData, getTestData } from './window';
import { computeMetrics } from './metrics';
import { computeAllBaselines } from './baseline';
import { computeCorrelationMatrix } from './correlation';
import { computeOverfitMetrics } from './overfit';
import { computeStabilityMetrics } from './stability';
import { exhaustiveSubsetSearch, prunedSubsetSearch, SubsetResult } from './subsetSearch';
import { gridSearchWeights, hybridSearchWeights, sparsifyWeights } from './weightOptimizer';
import { validateBacktestConfig } from './leakage';

export interface WalkForwardBacktestOptions {
  onProgress?: (phase: number, current: number, total: number) => void;
}

/**
 * V2.0 Walk-Forward 回测主函数
 */
export async function runWalkForwardBacktest(
  data: DrawRecord[],
  type: PredictionTypeConfig,
  globalAlgos: AlgorithmConfig[],
  config: BacktestConfig,
  options?: WalkForwardBacktestOptions,
): Promise<BacktestResultV2> {
  const { onProgress } = options || {};

  // 1. 数据验证
  onProgress?.(0, 0, 1);
  validateBacktestConfig(config, data.length);

  // 2. 获取类型映射函数
  const getCat = getTypeMapper(type);
  const categories = type.categories;

  // 3. 获取启用的算法
  const enabledAlgos = globalAlgos.filter(
    ga => ga.enabled && ALGO_FACTORIES[ga.id]
  );
  const algoIds = enabledAlgos.map(ga => ga.id);

  // 4. 创建 Walk-Forward 窗口
  const windows = createWalkForwardWindows(data.length, config);
  onProgress?.(0, 1, 1);

  // 5. 逐窗口执行
  const walkForwardResults: WalkForwardResult[] = [];
  let finalModelIndices: number[] = [];
  let sparseWeights: number[] = [];

  for (let w = 0; w < windows.length; w++) {
    const window = windows[w];
    
    // 获取各区间数据
    const trainData = getTrainData(data, window);
    const validationData = getValidationData(data, window);
    const testData = getTestData(data, window);

    // 预计算：每个算法在训练集上的表现
    onProgress?.(1, w, windows.length);
    
    // 6. 计算每个算法的指标
    const modelScores: MetricsResult[] = [];
    
    for (const algoId of algoIds) {
      const factory = ALGO_FACTORIES[algoId];
      if (!factory) continue;

      // 在验证集上评估
      const predictions: string[][] = [];
      const probabilities: Record<string, number>[] = [];
      const actuals: string[] = [];

      for (let i = 0; i < validationData.length; i++) {
        const trainSlice = data.slice(0, window.trainRange.start + trainData.length + i);
        const seed = (trainSlice[trainSlice.length - 1]?.issue || '0')
          .split('')
          .reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;

        const probs = factory(categories, getCat)(trainSlice, seed);
        const sorted = categories
          .map(c => ({ category: c, probability: probs[c] || 0 }))
          .sort((a, b) => b.probability - a.probability);

        predictions.push(sorted.map(s => s.category));
        probabilities.push(probs);
        actuals.push(getCat(validationData[i]));
      }

      const metrics = computeMetrics(
        predictions,
        probabilities,
        actuals,
        categories,
        config.topKValues,
        config.metrics,
      );

      modelScores.push(metrics);
    }

    // 7. 计算模型相关性
    const modelPredictions: Record<string, number[][]> = {};
    for (let algoIdx = 0; algoIdx < algoIds.length; algoIdx++) {
      const algoId = algoIds[algoIdx];
      const factory = ALGO_FACTORIES[algoId];
      if (!factory) continue;

      const preds: number[][] = [];
      for (let i = 0; i < validationData.length; i++) {
        const trainSlice = data.slice(0, window.trainRange.start + trainData.length + i);
        const seed = (trainSlice[trainSlice.length - 1]?.issue || '0')
          .split('')
          .reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;

        const probs = factory(categories, getCat)(trainSlice, seed);
        preds.push(categories.map(c => probs[c] || 0));
      }
      modelPredictions[algoId] = preds;
    }

    const correlationMatrix = computeCorrelationMatrix(modelPredictions, algoIds, categories);

    // 8. 子集搜索
    onProgress?.(2, w, windows.length);
    
    let subsetResults: SubsetResult[];
    if (algoIds.length <= 10) {
      subsetResults = exhaustiveSubsetSearch(
        modelScores,
        correlationMatrix.matrix,
        config.metrics,
        config.maxModels,
      );
    } else {
      subsetResults = prunedSubsetSearch(
        modelScores,
        correlationMatrix.matrix,
        config.metrics,
        config.maxModels || 8,
      );
    }

    // 9. 选择最佳子集
    const bestSubset = subsetResults[0];
    if (!bestSubset) {
      throw new Error('未找到有效的模型子集');
    }

    // 10. 权重精调
    onProgress?.(3, w, windows.length);
    
    const selectedModelScores = bestSubset.modelIndices.map(idx => modelScores[idx]);
    const selectedCorrelations = bestSubset.modelIndices.map(idx =>
      bestSubset.modelIndices.map(jdx => correlationMatrix.matrix[idx]?.[jdx] || 0)
    );

    let weightResult;
    if (algoIds.length <= 5) {
      weightResult = gridSearchWeights(
        selectedModelScores,
        selectedCorrelations,
        config.metrics,
      );
    } else {
      weightResult = hybridSearchWeights(
        selectedModelScores,
        selectedCorrelations,
        config.metrics,
      );
    }

    // 权重稀疏化
    const { weights: currentSparseWeights, removedIndices } = sparsifyWeights(weightResult.weights);
    sparseWeights = currentSparseWeights;
    finalModelIndices = bestSubset.modelIndices.filter(
      (_, i) => !removedIndices.includes(i)
    );

    // 11. 在测试集上评估
    const testPredictions: string[][] = [];
    const testProbabilities: Record<string, number>[] = [];
    const testActuals: string[] = [];

    for (let i = 0; i < testData.length; i++) {
      const trainSlice = data.slice(0, window.testRange.start + i);
      const seed = (trainSlice[trainSlice.length - 1]?.issue || '0')
        .split('')
        .reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;

      // 融合多个模型的预测
      const fusedProbs: Record<string, number> = {};
      categories.forEach(c => fusedProbs[c] = 0);

      for (let modelIdx = 0; modelIdx < finalModelIndices.length; modelIdx++) {
        const algoId = algoIds[finalModelIndices[modelIdx]];
        const factory = ALGO_FACTORIES[algoId];
        if (!factory) continue;

        const probs = factory(categories, getCat)(trainSlice, seed);
        const weight = sparseWeights[modelIdx] || 0;

        categories.forEach(c => {
          fusedProbs[c] += (probs[c] || 0) * weight;
        });
      }

      // 归一化
      const sum = Object.values(fusedProbs).reduce((a, b) => a + b, 0) || 1;
      categories.forEach(c => fusedProbs[c] /= sum);

      const sorted = categories
        .map(c => ({ category: c, probability: fusedProbs[c] }))
        .sort((a, b) => b.probability - a.probability);

      testPredictions.push(sorted.map(s => s.category));
      testProbabilities.push(fusedProbs);
      testActuals.push(getCat(testData[i]));
    }

    const testMetrics = computeMetrics(
      testPredictions,
      testProbabilities,
      testActuals,
      categories,
      config.topKValues,
      config.metrics,
    );

    // 保存窗口结果
    walkForwardResults.push({
      windowId: window.windowId,
      trainRange: window.trainRange,
      validationRange: window.validationRange,
      purgeRange: window.purgeRange,
      testRange: window.testRange,
      selectedModels: finalModelIndices.map(idx => algoIds[idx]),
      weights: Object.fromEntries(finalModelIndices.map((idx, i) => [algoIds[idx], sparseWeights[i] || 0])),
      validationMetrics: bestSubset.metrics,
      testMetrics,
      subsetsEvaluated: subsetResults.length,
      bestSubsetScore: bestSubset.compositeScore,
    });
  }

  // 12. 汇总所有 OOS 结果
  onProgress?.(4, 1, 1);

  // 计算总体指标
  const allTestMetrics = walkForwardResults.map(r => r.testMetrics);
  const overallMetrics = aggregateMetrics(allTestMetrics);

  // 计算稳定性
  const windowScores = walkForwardResults.map(r => r.testMetrics.compositeScore);
  const stability = computeStabilityMetrics(windowScores);

  // 计算过拟合指标
  const isScores = walkForwardResults.map(r => r.validationMetrics.compositeScore);
  const avgIS = isScores.reduce((a, b) => a + b, 0) / isScores.length;
  const oosScores = walkForwardResults.map(r => r.testMetrics.compositeScore);
  const avgOOS = oosScores.reduce((a, b) => a + b, 0) / oosScores.length;
  const overfit = computeOverfitMetrics(avgIS, avgIS, avgOOS);

  // 13. 计算 Baseline
  const baselineResults = computeAllBaselines(
    categories,
    data.slice(0, data.length - config.testSize),
    data.slice(data.length - config.testSize),
    getCat,
    config.topKValues,
    config.randomSeed,
  );

  // 14. 选择最佳和稳定模型
  // 15. 构建结果
  const result: BacktestResultV2 = {
    typeId: type.id,
    config,
    totalWindows: windows.length,
    baselineResults,
    modelResults: [], // TODO: 填充单模型评估
    ensembleResults: [], // TODO: 填充组合评估
    walkForwardResults,
    correlationMatrix: computeCorrelationMatrix({}, algoIds, categories),
    selectedModels: finalModelIndices.map((idx, i) => ({
      modelId: algoIds[idx],
      weight: sparseWeights[i] || 0,
      contribution: 0,
      stability: stability.stabilityScore,
    })),
    selectedWeights: Object.fromEntries(
      finalModelIndices.map((idx, i) => [algoIds[idx], sparseWeights[i] || 0])
    ),
    metrics: overallMetrics,
    overfit,
    stability,
    randomSeed: config.randomSeed,
    createdAt: new Date().toISOString(),
    engineVersion: '2.0.0',
  };

  return result;
}

/**
 * 汇总多个窗口的指标
 */
function aggregateMetrics(windowMetrics: MetricsResult[]): MetricsResult {
  if (windowMetrics.length === 0) {
    return {
      hitRate: 0,
      hitRateByK: {},
      mrr: 0,
      logLoss: Infinity,
      brierScore: 1,
      compositeScore: 0,
    };
  }

  const n = windowMetrics.length;
  const aggregated: MetricsResult = {
    hitRate: windowMetrics.reduce((a, m) => a + m.hitRate, 0) / n,
    hitRateByK: {},
    mrr: windowMetrics.reduce((a, m) => a + m.mrr, 0) / n,
    logLoss: windowMetrics.reduce((a, m) => a + m.logLoss, 0) / n,
    brierScore: windowMetrics.reduce((a, m) => a + m.brierScore, 0) / n,
    compositeScore: windowMetrics.reduce((a, m) => a + m.compositeScore, 0) / n,
  };

  // 汇总 hitRateByK
  const allK = new Set<number>();
  for (const m of windowMetrics) {
    for (const k of Object.keys(m.hitRateByK)) {
      allK.add(parseInt(k));
    }
  }
  for (const k of allK) {
    aggregated.hitRateByK[k] = windowMetrics.reduce((a, m) => a + (m.hitRateByK[k] || 0), 0) / n;
  }

  return aggregated;
}

/**
 * 默认的回测配置
 */
export function getDefaultBacktestConfig(typeId: string): BacktestConfig {
  return {
    typeId,
    trainSize: 200,
    validationSize: 30,
    testSize: 30,
    purgeGap: 5,
    stepSize: 30,
    candidateWindows: [30, 50, 80, 120, 200],
    topKValues: [1, 3, 5, 10],
    maxModels: 8,
    subsetSearch: 'exhaustive',
    weightOptimization: 'hybrid',
    metrics: {
      hitRate: 0.30,
      mrr: 0.20,
      probability: 0.15,
      stability: 0.15,
      diversity: 0.10,
      correlationPenalty: 0.05,
      overfitPenalty: 0.05,
    },
    minSamplesForSelection: 20,
    randomSeed: 42,
  };
}
