/**
 * V2.0 自动调权
 *
 * - Bayesian 后验均值替代频率
 * - 权重平滑防止剧烈变化
 * - 仅使用 OOS 结果
 * - 最小样本量控制
 */

import { DrawRecord } from '../../data/types';
import { PredictionTypeConfig } from '../../models/dynamic/types';
import { ALGO_FACTORIES, getTypeMapper } from '../../models/dynamic';

export interface AutoWeightConfig {
  enabled: boolean;
  minSamples: number;
  updateInterval: number;
  learningRate: number;
  smoothingFactor: number;
  maxWeight: number;
  minWeight: number;
}

export interface WeightUpdateResult {
  algorithmId: string;
  oldWeight: number;
  newWeight: number;
  posteriorMean: number;
  hitRate: number;
  sampleSize: number;
}

export interface AutoWeightResult {
  updated: boolean;
  updates: WeightUpdateResult[];
  totalSamples: number;
  reason?: string;
}

export const DEFAULT_AUTO_WEIGHT_CONFIG: AutoWeightConfig = {
  enabled: true,
  minSamples: 20,
  updateInterval: 5,
  learningRate: 0.2,
  smoothingFactor: 0.8,
  maxWeight: 0.5,
  minWeight: 0.03,
};

/**
 * Bayesian 后验均值
 * Beta(1,1) prior -> posterior = (hits+1) / (total+2)
 */
export function bayesianPosteriorMean(
  hits: number,
  total: number,
  priorAlpha: number = 1,
  priorBeta: number = 1,
): number {
  const posteriorAlpha = priorAlpha + hits;
  const posteriorBeta = priorBeta + (total - hits);
  return posteriorAlpha / (posteriorAlpha + posteriorBeta);
}

/**
 * 权重平滑: new = old * (1-a) + est * a
 */
export function smoothWeight(
  oldWeight: number,
  estimatedWeight: number,
  alpha: number,
): number {
  return oldWeight * (1 - alpha) + estimatedWeight * alpha;
}

/**
 * OOS 评估单个算法
 */
export function evaluateAlgorithmOOS(
  data: DrawRecord[],
  type: PredictionTypeConfig,
  algoId: string,
  lookback: number = 30,
): { hitRate: number; sampleSize: number } {
  const getCat = getTypeMapper(type);
  const categories = type.categories;
  const factory = ALGO_FACTORIES[algoId];

  if (!factory || data.length < lookback + 5) {
    return { hitRate: 0, sampleSize: 0 };
  }

  let hits = 0;
  let total = 0;

  for (let i = data.length - lookback; i < data.length; i++) {
    const trainData = data.slice(0, i);
    if (trainData.length < 5) continue;

    const seed = (trainData[trainData.length - 1]?.issue || '0')
      .split('')
      .reduce((a, c) => a * 31 + c.charCodeAt(0), 0) & 0x7fffffff;

    const probs = factory(categories, getCat)(trainData, seed);
    const sorted = categories
      .map(c => ({ category: c, probability: probs[c] || 0 }))
      .sort((a, b) => b.probability - a.probability);

    const predicted = sorted.slice(0, type.resultCount).map(s => s.category);
    const actual = getCat(data[i]);

    if (predicted.includes(actual)) {
      hits++;
    }
    total++;
  }

  return {
    hitRate: total > 0 ? hits / total : 0,
    sampleSize: total,
  };
}

/**
 * V2.0 自动调权主函数
 */
export function autoTuneWeightsV2(
  types: PredictionTypeConfig[],
  data: DrawRecord[],
  config: AutoWeightConfig = DEFAULT_AUTO_WEIGHT_CONFIG,
): { types: PredictionTypeConfig[]; result: AutoWeightResult } {
  if (!config.enabled || data.length < config.minSamples) {
    return {
      types,
      result: {
        updated: false,
        updates: [],
        totalSamples: data.length,
        reason: data.length < config.minSamples
          ? `样本不足: ${data.length}/${config.minSamples}`
          : '自动调权已禁用',
      },
    };
  }

  const updates: WeightUpdateResult[] = [];

  const updatedTypes = types.map(type => {
    if (!type.enabled || !type.autoWeight) return type;

    const enabledAlgos = type.selectedAlgorithms.filter(sa =>
      ALGO_FACTORIES[sa.id],
    );

    if (enabledAlgos.length === 0) return type;

    // OOS 评估每个算法
    const evaluations = enabledAlgos.map(sa => {
      const evalResult = evaluateAlgorithmOOS(data, type, sa.id, 30);
      return {
        algoId: sa.id,
        oldWeight: sa.weight,
        hitRate: evalResult.hitRate,
        sampleSize: evalResult.sampleSize,
        posteriorMean: bayesianPosteriorMean(
          Math.round(evalResult.hitRate * evalResult.sampleSize),
          evalResult.sampleSize,
        ),
      };
    });

    // 计算新的权重
    const totalPosterior = evaluations.reduce((s, e) => s + e.posteriorMean, 0) || 1;

    const newAlgos = evaluations.map(e => {
      const estimatedWeight = e.posteriorMean / totalPosterior;
      const smoothedWeight = smoothWeight(
        e.oldWeight,
        estimatedWeight,
        config.smoothingFactor,
      );
      const clampedWeight = Math.max(
        config.minWeight,
        Math.min(config.maxWeight, smoothedWeight),
      );

      updates.push({
        algorithmId: e.algoId,
        oldWeight: e.oldWeight,
        newWeight: clampedWeight,
        posteriorMean: e.posteriorMean,
        hitRate: e.hitRate,
        sampleSize: e.sampleSize,
      });

      return {
        id: e.algoId,
        weight: parseFloat(clampedWeight.toFixed(2)),
      };
    });

    // 归一化
    const totalW = newAlgos.reduce((s, a) => s + a.weight, 0);
    const normalized = totalW > 0
      ? newAlgos.map(a => ({ ...a, weight: parseFloat((a.weight / totalW).toFixed(2)) }))
      : newAlgos;

    return { ...type, selectedAlgorithms: normalized };
  });

  return {
    types: updatedTypes,
    result: {
      updated: updates.length > 0,
      updates,
      totalSamples: data.length,
    },
  };
}
