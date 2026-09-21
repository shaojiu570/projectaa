/**
 * V2.0 Baseline 基准模型
 * 
 * 提供四种基准模型用于对比：
 * 1. Random - 随机选择
 * 2. Uniform - 等概率分布
 * 3. Historical Frequency - 历史频率
 * 4. Recent Frequency - 近期频率
 */

import { DrawRecord } from '../../data/types';
import { BaselineResult, MetricsResult } from '../types';

/**
 * Random Baseline: 随机选择类别
 * 用途：判断复杂算法是否明显偏离随机结果
 */
export function randomBaseline(
  categories: string[],
  testRecords: DrawRecord[],
  getCat: (d: DrawRecord) => string,
  topKValues: number[],
  seed: number,
): BaselineResult {
  const rng = seededRandom(seed);
  const windowScores: number[] = [];
  const allHitsByK: Record<number, number[]> = {};
  topKValues.forEach(k => allHitsByK[k] = []);

  for (const record of testRecords) {
    const actual = getCat(record);
    const shuffled = [...categories].sort(() => rng() - 0.5);
    
    for (const k of topKValues) {
      const predicted = shuffled.slice(0, k);
      const hit = predicted.includes(actual) ? 1 : 0;
      allHitsByK[k].push(hit);
    }
  }

  const metrics = computeMetricsFromHits(allHitsByK, testRecords.length);
  windowScores.push(metrics.hitRate);

  return {
    baselineType: 'random',
    metrics,
    windowScores,
  };
}

/**
 * Uniform Baseline: 所有类别等概率
 * 例如49个号码：P(number) = 1/49
 */
export function uniformBaseline(
  categories: string[],
  testRecords: DrawRecord[],
  getCat: (d: DrawRecord) => string,
  topKValues: number[],
): BaselineResult {
  const windowScores: number[] = [];
  const allHitsByK: Record<number, number[]> = {};
  topKValues.forEach(k => allHitsByK[k] = []);

  // Uniform: 按字母/数字排序，取前K个
  const sorted = [...categories].sort();
  
  for (const record of testRecords) {
    const actual = getCat(record);
    
    for (const k of topKValues) {
      const predicted = sorted.slice(0, k);
      const hit = predicted.includes(actual) ? 1 : 0;
      allHitsByK[k].push(hit);
    }
  }

  const metrics = computeMetricsFromHits(allHitsByK, testRecords.length);
  windowScores.push(metrics.hitRate);

  return {
    baselineType: 'uniform',
    metrics,
    windowScores,
  };
}

/**
 * Historical Frequency Baseline: 按历史频率预测
 * 支持不同窗口：ALL, 30, 60, 120, 300
 */
export function historicalFrequencyBaseline(
  categories: string[],
  trainRecords: DrawRecord[],
  testRecords: DrawRecord[],
  getCat: (d: DrawRecord) => string,
  topKValues: number[],
  window?: number,
): BaselineResult {
  const windowScores: number[] = [];
  const allHitsByK: Record<number, number[]> = {};
  topKValues.forEach(k => allHitsByK[k] = []);

  // 计算历史频率
  const sourceRecords = window ? trainRecords.slice(-window) : trainRecords;
  const freq: Record<string, number> = {};
  categories.forEach(c => freq[c] = 0);
  
  for (const record of sourceRecords) {
    const cat = getCat(record);
    if (freq[cat] !== undefined) {
      freq[cat]++;
    }
  }

  // 按频率排序
  const sorted = [...categories].sort((a, b) => (freq[b] || 0) - (freq[a] || 0));

  for (const record of testRecords) {
    const actual = getCat(record);
    
    for (const k of topKValues) {
      const predicted = sorted.slice(0, k);
      const hit = predicted.includes(actual) ? 1 : 0;
      allHitsByK[k].push(hit);
    }
  }

  const metrics = computeMetricsFromHits(allHitsByK, testRecords.length);
  windowScores.push(metrics.hitRate);

  return {
    baselineType: 'historical_frequency',
    metrics,
    windowScores,
  };
}

/**
 * Recent Frequency Baseline: 只使用最近N期
 * 用于判断复杂模型是否真正超过简单近期统计
 */
export function recentFrequencyBaseline(
  categories: string[],
  trainRecords: DrawRecord[],
  testRecords: DrawRecord[],
  getCat: (d: DrawRecord) => string,
  topKValues: number[],
  recentWindow: number = 30,
): BaselineResult {
  return historicalFrequencyBaseline(
    categories,
    trainRecords,
    testRecords,
    getCat,
    topKValues,
    recentWindow,
  );
}

/**
 * 计算所有基准模型
 */
export function computeAllBaselines(
  categories: string[],
  trainRecords: DrawRecord[],
  testRecords: DrawRecord[],
  getCat: (d: DrawRecord) => string,
  topKValues: number[],
  randomSeed: number,
): BaselineResult[] {
  return [
    randomBaseline(categories, testRecords, getCat, topKValues, randomSeed),
    uniformBaseline(categories, testRecords, getCat, topKValues),
    historicalFrequencyBaseline(categories, trainRecords, testRecords, getCat, topKValues),
    recentFrequencyBaseline(categories, trainRecords, testRecords, getCat, topKValues, 30),
  ];
}

/**
 * 从命中统计计算指标
 */
function computeMetricsFromHits(
  hitsByK: Record<number, number[]>,
  totalTests: number,
): MetricsResult {
  const hitRateByK: Record<number, number> = {};
  
  for (const [k, hits] of Object.entries(hitsByK)) {
    const kNum = parseInt(k);
    const sum = hits.reduce((a, b) => a + b, 0);
    hitRateByK[kNum] = totalTests > 0 ? sum / totalTests : 0;
  }

  // 对于baseline，简化计算其他指标
  const hitRate = hitRateByK[1] || 0;
  
  return {
    hitRate,
    hitRateByK,
    mrr: hitRate, // 简化：对于baseline，MRR约等于hitRate
    logLoss: Math.log(1 / Math.max(hitRate, 0.001)),
    brierScore: 1 - hitRate,
    compositeScore: hitRate,
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
