/**
 * V2.0 稳定性评分
 * 
 * 评估模型在多个时间窗口中的稳定性：
 * - 平均表现
 * - 标准差
 * - 最小/最大表现
 * - 稳定性综合评分
 */

import { StabilityMetrics } from '../types';

/**
 * 计算稳定性指标
 */
export function computeStabilityMetrics(
  windowScores: number[],
  riskPenaltyLambda: number = 0.5,
): StabilityMetrics {
  if (windowScores.length === 0) {
    return {
      meanScore: 0,
      stdScore: 0,
      minScore: 0,
      maxScore: 0,
      stabilityScore: 0,
      windowScores: [],
      riskPenaltyLambda,
    };
  }

  // 计算基本统计量
  const meanScore = windowScores.reduce((a, b) => a + b, 0) / windowScores.length;
  const variance = windowScores.reduce((a, b) => a + (b - meanScore) ** 2, 0) / windowScores.length;
  const stdScore = Math.sqrt(variance);
  const minScore = Math.min(...windowScores);
  const maxScore = Math.max(...windowScores);

  // 稳定性评分 = MeanScore - λ × StdScore
  const stabilityScore = meanScore - riskPenaltyLambda * stdScore;

  return {
    meanScore,
    stdScore,
    minScore,
    maxScore,
    stabilityScore,
    windowScores,
    riskPenaltyLambda,
  };
}

/**
 * 比较两个模型的稳定性
 */
export function compareStability(
  stability1: StabilityMetrics,
  stability2: StabilityMetrics,
): {
  moreStable: 1 | 2;
  difference: number;
  reason: string;
} {
  const diff = stability1.stabilityScore - stability2.stabilityScore;

  if (Math.abs(diff) < 0.01) {
    return {
      moreStable: diff >= 0 ? 1 : 2,
      difference: Math.abs(diff),
      reason: '稳定性相近',
    };
  }

  const moreStable = stability1.stabilityScore > stability2.stabilityScore ? 1 : 2;
  const reason = moreStable === 1
    ? `模型1更稳定 (${stability1.stabilityScore.toFixed(3)} vs ${stability2.stabilityScore.toFixed(3)})`
    : `模型2更稳定 (${stability2.stabilityScore.toFixed(3)} vs ${stability1.stabilityScore.toFixed(3)})`;

  return { moreStable, difference: Math.abs(diff), reason };
}

/**
 * 检测稳定性风险
 */
export function detectStabilityRisk(
  stability: StabilityMetrics,
): {
  riskLevel: 'low' | 'medium' | 'high';
  details: string[];
} {
  const details: string[] = [];
  let riskScore = 0;

  // 检查标准差
  if (stability.stdScore > 0.1) {
    details.push(`标准差较大 (${stability.stdScore.toFixed(3)})`);
    riskScore += 2;
  } else if (stability.stdScore > 0.05) {
    details.push(`标准差中等 (${stability.stdScore.toFixed(3)})`);
    riskScore += 1;
  }

  // 检查变异系数 (CV)
  const cv = stability.meanScore > 0 ? stability.stdScore / stability.meanScore : 0;
  if (cv > 0.5) {
    details.push(`变异系数较大 (${cv.toFixed(2)})`);
    riskScore += 2;
  } else if (cv > 0.3) {
    details.push(`变异系数中等 (${cv.toFixed(2)})`);
    riskScore += 1;
  }

  // 检查极差
  const range = stability.maxScore - stability.minScore;
  if (range > 0.2) {
    details.push(`极差较大 (${range.toFixed(3)})`);
    riskScore += 1;
  }

  // 评估风险等级
  let riskLevel: 'low' | 'medium' | 'high';
  if (riskScore >= 3) {
    riskLevel = 'high';
  } else if (riskScore >= 2) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return { riskLevel, details };
}

/**
 * 选择稳定模型
 */
export function selectStableModels(
  modelStabilities: StabilityMetrics[],
  modelScores: number[],
  maxModels: number,
  minStabilityScore: number = 0,
): number[] {
  const n = modelStabilities.length;
  if (n === 0 || maxModels <= 0) return [];

  // 计算综合评分：性能 × 稳定性
  const combined = modelStabilities.map((s, i) => ({
    index: i,
    combinedScore: modelScores[i] * (0.5 + 0.5 * s.stabilityScore),
    stability: s.stabilityScore,
    performance: modelScores[i],
  }));

  // 过滤稳定性低于阈值的模型
  const filtered = combined.filter(c => c.stability >= minStabilityScore);

  // 按综合评分排序
  filtered.sort((a, b) => b.combinedScore - a.combinedScore);

  // 选择前N个
  return filtered.slice(0, maxModels).map(c => c.index);
}

/**
 * 计算跨窗口的稳定性统计
 */
export function computeCrossWindowStability(
  windowResults: Array<{ modelId: string; score: number }[]>,
): Map<string, StabilityMetrics> {
  const modelScoresMap = new Map<string, number[]>();

  // 收集每个模型在各窗口的得分
  for (const windowResult of windowResults) {
    for (const { modelId, score } of windowResult) {
      if (!modelScoresMap.has(modelId)) {
        modelScoresMap.set(modelId, []);
      }
      modelScoresMap.get(modelId)!.push(score);
    }
  }

  // 计算每个模型的稳定性
  const result = new Map<string, StabilityMetrics>();
  for (const [modelId, scores] of modelScoresMap) {
    result.set(modelId, computeStabilityMetrics(scores));
  }

  return result;
}

/**
 * 稳定性指标格式化
 */
export function formatStabilityMetrics(stability: StabilityMetrics): string {
  return [
    `Mean: ${stability.meanScore.toFixed(3)}`,
    `Std: ${stability.stdScore.toFixed(3)}`,
    `Min: ${stability.minScore.toFixed(3)}`,
    `Max: ${stability.maxScore.toFixed(3)}`,
    `Stability: ${stability.stabilityScore.toFixed(3)}`,
  ].join(', ');
}

/**
 * 生成稳定性报告
 */
export function generateStabilityReport(
  stability: StabilityMetrics,
  windowCount: number,
): string {
  const risk = detectStabilityRisk(stability);
  
  const lines = [
    `稳定性分析 (${windowCount} 个窗口)`,
    `  平均得分: ${stability.meanScore.toFixed(3)}`,
    `  标准差: ${stability.stdScore.toFixed(3)}`,
    `  得分范围: [${stability.minScore.toFixed(3)}, ${stability.maxScore.toFixed(3)}]`,
    `  稳定性评分: ${stability.stabilityScore.toFixed(3)}`,
    `  风险等级: ${risk.riskLevel}`,
  ];

  if (risk.details.length > 0) {
    lines.push(`  详情: ${risk.details.join('; ')}`);
  }

  return lines.join('\n');
}
