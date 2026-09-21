/**
 * V2.0 模型相关性分析
 * 
 * 计算模型之间的相关性：
 * - 排名相关性
 * - 概率分布相关性
 * - 相关性惩罚
 * - 多样性评分
 */

import { CorrelationMatrix } from '../types';

/**
 * 计算两个模型排名的 Spearman 相关系数
 */
export function spearmanCorrelation(
  ranks1: number[],
  ranks2: number[],
): number {
  const n = Math.min(ranks1.length, ranks2.length);
  if (n === 0) return 0;

  let sumD2 = 0;
  for (let i = 0; i < n; i++) {
    const d = ranks1[i] - ranks2[i];
    sumD2 += d * d;
  }

  // Spearman 相关系数公式
  const rho = 1 - (6 * sumD2) / (n * (n * n - 1));
  return Math.max(-1, Math.min(1, rho)); // 限制在 [-1, 1] 范围
}

/**
 * 计算两个概率分布的相关性
 */
export function probabilityCorrelation(
  probs1: Record<string, number>[],
  probs2: Record<string, number>[],
  categories: string[],
): number {
  const n = Math.min(probs1.length, probs2.length);
  if (n === 0 || categories.length === 0) return 0;

  // 将概率分布转换为向量
  const vec1: number[] = [];
  const vec2: number[] = [];

  for (let i = 0; i < n; i++) {
    for (const cat of categories) {
      vec1.push(probs1[i][cat] || 0);
      vec2.push(probs2[i][cat] || 0);
    }
  }

  // 计算 Pearson 相关系数
  return pearsonCorrelation(vec1, vec2);
}

/**
 * 计算 Pearson 相关系数
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denominator = Math.sqrt(sumX2 * sumY2);
  if (denominator === 0) return 0;

  return sumXY / denominator;
}

/**
 * 计算模型相关性矩阵
 */
export function computeCorrelationMatrix(
  modelPredictions: Record<string, number[][]>,
  modelIds: string[],
  categories: string[],
): CorrelationMatrix {
  const n = modelIds.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  // 计算每对模型的相关性
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else if (j < i) {
        matrix[i][j] = matrix[j][i]; // 对称矩阵
      } else {
        const preds1 = modelPredictions[modelIds[i]];
        const preds2 = modelPredictions[modelIds[j]];
        
        if (preds1 && preds2) {
          // 计算排名相关性
          const ranks1 = getRanksFromProbabilities(preds1, categories);
          const ranks2 = getRanksFromProbabilities(preds2, categories);
          matrix[i][j] = spearmanCorrelation(ranks1, ranks2);
        } else {
          matrix[i][j] = 0;
        }
      }
    }
  }

  // 计算平均相关性（排除对角线）
  let sumCorrelation = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      sumCorrelation += Math.abs(matrix[i][j]);
      count++;
    }
  }

  const averageCorrelation = count > 0 ? sumCorrelation / count : 0;

  return {
    modelIds,
    matrix,
    averageCorrelation,
  };
}

/**
 * 从概率分布获取排名
 */
function getRanksFromProbabilities(
  probArrays: number[][],
  categories: string[],
): number[] {
  if (probArrays.length === 0) return [];

  // 计算每个目标期的平均排名
  const avgRanks: number[] = [];
  
  for (const probs of probArrays) {
    // 创建 (概率, 索引) 对并按概率排序
    const indexed = probs.map((p, i) => ({ prob: p, index: i }));
    indexed.sort((a, b) => b.prob - a.prob);
    
    // 创建排名数组
    const ranks = new Array(probs.length);
    for (let rank = 0; rank < indexed.length; rank++) {
      ranks[indexed[rank].index] = rank + 1;
    }
    
    // 使用第一个类别的排名作为代表
    avgRanks.push(ranks[0] || categories.length);
  }

  return avgRanks;
}

/**
 * 计算组合的相关性惩罚
 */
export function computeCorrelationPenalty(
  correlationMatrix: CorrelationMatrix,
  selectedModelIndices: number[],
): number {
  if (selectedModelIndices.length <= 1) return 0;

  let sumCorrelation = 0;
  let count = 0;

  for (let i = 0; i < selectedModelIndices.length; i++) {
    for (let j = i + 1; j < selectedModelIndices.length; j++) {
      const idx1 = selectedModelIndices[i];
      const idx2 = selectedModelIndices[j];
      sumCorrelation += Math.abs(correlationMatrix.matrix[idx1][idx2]);
      count++;
    }
  }

  return count > 0 ? sumCorrelation / count : 0;
}

/**
 * 计算组合的多样性评分
 */
export function computeDiversityScore(
  correlationMatrix: CorrelationMatrix,
  selectedModelIndices: number[],
): number {
  const avgCorrelation = computeCorrelationPenalty(correlationMatrix, selectedModelIndices);
  return 1 - avgCorrelation; // 多样性 = 1 - 平均相关性
}

/**
 * 选择具有最低相关性的模型子集
 */
export function selectDiverseModels(
  correlationMatrix: CorrelationMatrix,
  modelScores: number[],
  maxModels: number,
): number[] {
  const n = correlationMatrix.modelIds.length;
  if (n === 0 || maxModels <= 0) return [];

  // 按分数排序
  const indexed = modelScores.map((score, i) => ({ score, index: i }));
  indexed.sort((a, b) => b.score - a.score);

  const selected: number[] = [];
  const candidateIndices = indexed.map(item => item.index);

  // 贪心选择：每次选择与已选模型相关性最低的高分模型
  for (const candidateIdx of candidateIndices) {
    if (selected.length >= maxModels) break;

    let minAvgCorrelation = Infinity;
    let bestIdx = candidateIdx;

    // 检查候选模型与已选模型的平均相关性
    if (selected.length === 0) {
      bestIdx = candidateIdx;
    } else {
      let sumCorrelation = 0;
      for (const selectedIdx of selected) {
        sumCorrelation += Math.abs(
          correlationMatrix.matrix[candidateIdx][selectedIdx]
        );
      }
      const avgCorrelation = sumCorrelation / selected.length;
      
      if (avgCorrelation < minAvgCorrelation) {
        minAvgCorrelation = avgCorrelation;
        bestIdx = candidateIdx;
      }
    }

    if (!selected.includes(bestIdx)) {
      selected.push(bestIdx);
    }
  }

  return selected;
}
