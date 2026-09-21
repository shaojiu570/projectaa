/**
 * V2.0 过拟合检测
 * 
 * 检测模型过拟合风险：
 * - IS/OOS Gap
 * - 过拟合比率
 * - 风险等级评估
 */

import { OverfitMetrics, MetricsResult } from '../types';

/**
 * 计算过拟合指标
 */
export function computeOverfitMetrics(
  inSampleScore: number,
  validationScore: number,
  outOfSampleScore: number,
): OverfitMetrics {
  // IS/OOS Gap
  const isToOosGap = inSampleScore - outOfSampleScore;
  const validationToOosGap = validationScore - outOfSampleScore;

  // 过拟合比率：IS/OOS，越大越可能过拟合
  const overfitRatio = outOfSampleScore > 0 
    ? inSampleScore / outOfSampleScore 
    : inSampleScore > 0 ? Infinity : 1;

  // 风险等级评估
  const riskLevel = assessRiskLevel(isToOosGap, overfitRatio);

  return {
    inSampleScore,
    validationScore,
    outOfSampleScore,
    isToOosGap,
    validationToOosGap,
    overfitRatio,
    riskLevel,
  };
}

/**
 * 评估过拟合风险等级
 */
function assessRiskLevel(
  gap: number,
  ratio: number,
): 'low' | 'medium' | 'high' {
  // 基于 Gap 和 Ratio 的综合判断
  if (gap > 0.15 || ratio > 2.0) {
    return 'high';
  } else if (gap > 0.08 || ratio > 1.5) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * 检测单个模型的过拟合风险
 */
export function detectModelOverfit(
  modelMetrics: MetricsResult[],
): {
  isOverfit: boolean;
  confidence: number;
  reason: string;
} {
  if (modelMetrics.length < 3) {
    return {
      isOverfit: false,
      confidence: 0,
      reason: '样本不足，无法判断',
    };
  }

  // 计算样本内和样本外表现
  const isScores = modelMetrics.slice(0, Math.floor(modelMetrics.length / 2));
  const oosScores = modelMetrics.slice(Math.floor(modelMetrics.length / 2));

  const avgIS = isScores.reduce((a, m) => a + m.hitRate, 0) / isScores.length;
  const avgOOS = oosScores.reduce((a, m) => a + m.hitRate, 0) / oosScores.length;

  const gap = avgIS - avgOOS;
  const ratio = avgOOS > 0 ? avgIS / avgOOS : avgIS > 0 ? Infinity : 1;

  // 判断是否过拟合
  if (gap > 0.1 && ratio > 1.8) {
    return {
      isOverfit: true,
      confidence: Math.min(0.9, gap * 5),
      reason: `IS/OOS Gap=${gap.toFixed(3)}, Ratio=${ratio.toFixed(2)}`,
    };
  }

  return {
    isOverfit: false,
    confidence: 0.5,
    reason: `IS/OOS Gap=${gap.toFixed(3)}, Ratio=${ratio.toFixed(2)}`,
  };
}

/**
 * 检测组合的过拟合风险
 */
export function detectEnsembleOverfit(
  ensembleMetrics: MetricsResult[],
  baselineMetrics: MetricsResult,
): {
  overfitRisk: 'low' | 'medium' | 'high';
  details: string[];
} {
  const details: string[] = [];
  let riskScore = 0;

  // 检查组合是否显著优于基准
  if (ensembleMetrics.length > 0) {
    const avgEnsemble = ensembleMetrics.reduce((a, m) => a + m.hitRate, 0) / ensembleMetrics.length;
    const baseline = baselineMetrics.hitRate;
    
    if (avgEnsemble > baseline * 1.5) {
      details.push(`组合表现显著优于基准 (${(avgEnsemble * 100).toFixed(1)}% vs ${(baseline * 100).toFixed(1)}%)`);
      riskScore += 2;
    }
  }

  // 检查表现稳定性
  if (ensembleMetrics.length > 1) {
    const hitRates = ensembleMetrics.map(m => m.hitRate);
    const mean = hitRates.reduce((a, b) => a + b, 0) / hitRates.length;
    const variance = hitRates.reduce((a, b) => a + (b - mean) ** 2, 0) / hitRates.length;
    const std = Math.sqrt(variance);
    
    if (std > 0.05) {
      details.push(`表现波动较大 (std=${std.toFixed(3)})`);
      riskScore += 1;
    }
  }

  // 评估风险等级
  let overfitRisk: 'low' | 'medium' | 'high';
  if (riskScore >= 3) {
    overfitRisk = 'high';
  } else if (riskScore >= 2) {
    overfitRisk = 'medium';
  } else {
    overfitRisk = 'low';
  }

  return { overfitRisk, details };
}

/**
 * 过拟合检测结果格式化
 */
export function formatOverfitResult(metrics: OverfitMetrics): string {
  return [
    `IS Score: ${metrics.inSampleScore.toFixed(3)}`,
    `Validation Score: ${metrics.validationScore.toFixed(3)}`,
    `OOS Score: ${metrics.outOfSampleScore.toFixed(3)}`,
    `IS-OOS Gap: ${metrics.isToOosGap.toFixed(3)}`,
    `Overfit Ratio: ${metrics.overfitRatio.toFixed(2)}`,
    `Risk Level: ${metrics.riskLevel}`,
  ].join(', ');
}

/**
 * 生成过拟合警告信息
 */
export function generateOverfitWarning(metrics: OverfitMetrics): string | null {
  if (metrics.riskLevel === 'high') {
    return `⚠️ 高过拟合风险：IS/OOS Gap=${metrics.isToOosGap.toFixed(3)}, Ratio=${metrics.overfitRatio.toFixed(2)}。该指标仅用于衡量模型在历史回测中的拟合差异，不代表未来开奖结果。`;
  } else if (metrics.riskLevel === 'medium') {
    return `⚡ 中等过拟合风险：IS/OOS Gap=${metrics.isToOosGap.toFixed(3)}, Ratio=${metrics.overfitRatio.toFixed(2)}。该指标仅用于衡量模型在历史回测中的拟合差异，不代表未来开奖结果。`;
  }
  return null;
}
