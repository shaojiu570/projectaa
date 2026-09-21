/**
 * V2.0 Walk-Forward 窗口创建
 * 
 * 创建滚动验证窗口：
 * - Train: 用于算法计算和参数训练
 * - Validation: 用于算法选择和权重优化
 * - Test: 只用于最终评价
 * - Purge: 防止数据泄漏的间隔
 */

import { WalkForwardWindow, DateRange, BacktestConfig } from '../types';
import { validateWalkForwardSetup, validateWindow } from './leakage';

/**
 * 创建 Walk-Forward 窗口序列
 */
export function createWalkForwardWindows(
  totalRecords: number,
  config: BacktestConfig,
): WalkForwardWindow[] {
  const { trainSize, validationSize, testSize, purgeGap, stepSize } = config;

  // 验证配置
  const { windowCount } = validateWalkForwardSetup(
    totalRecords,
    trainSize,
    validationSize,
    testSize,
    purgeGap,
    stepSize,
  );

  const windows: WalkForwardWindow[] = [];

  for (let i = 0; i < windowCount; i++) {
    const offset = i * stepSize;

    // 计算各区间
    const trainStart = offset;
    const trainEnd = offset + trainSize - 1;

    const purgeStart1 = trainEnd + 1;
    const purgeEnd1 = purgeStart1 + purgeGap - 1;

    const validationStart = purgeEnd1 + 1;
    const validationEnd = validationStart + validationSize - 1;

    const purgeStart2 = validationEnd + 1;
    const purgeEnd2 = purgeStart2 + purgeGap - 1;

    const testStart = purgeEnd2 + 1;
    const testEnd = testStart + testSize - 1;

    const trainRange: DateRange = { start: trainStart, end: trainEnd };
    const validationRange: DateRange = { start: validationStart, end: validationEnd };
    const testRange: DateRange = { start: testStart, end: testEnd };
    const purgeRange: DateRange | undefined = purgeGap > 0 
      ? { start: purgeStart1, end: purgeEnd2 }
      : undefined;

    // 验证窗口有效性
    validateWindow(trainRange, validationRange, testRange, purgeGap);

    windows.push({
      windowId: `WF-${String(i + 1).padStart(2, '0')}`,
      trainRange,
      validationRange,
      purgeRange,
      testRange,
    });
  }

  return windows;
}

/**
 * 获取窗口的训练数据
 */
export function getTrainData<T>(
  data: T[],
  window: WalkForwardWindow,
): T[] {
  return data.slice(window.trainRange.start, window.trainRange.end + 1);
}

/**
 * 获取窗口的验证数据
 */
export function getValidationData<T>(
  data: T[],
  window: WalkForwardWindow,
): T[] {
  return data.slice(window.validationRange.start, window.validationRange.end + 1);
}

/**
 * 获取窗口的测试数据
 */
export function getTestData<T>(
  data: T[],
  window: WalkForwardWindow,
): T[] {
  return data.slice(window.testRange.start, window.testRange.end + 1);
}

/**
 * 获取窗口的所有非测试数据（训练+验证）
 */
export function getTrainValidationData<T>(
  data: T[],
  window: WalkForwardWindow,
): T[] {
  return data.slice(
    window.trainRange.start,
    window.validationRange.end + 1,
  );
}

/**
 * 计算窗口统计信息
 */
export function getWindowStats(
  windows: WalkForwardWindow[],
): {
  totalWindows: number;
  trainRange: { min: number; max: number };
  validationRange: { min: number; max: number };
  testRange: { min: number; max: number };
  totalTrainPeriods: number;
  totalValidationPeriods: number;
  totalTestPeriods: number;
} {
  if (windows.length === 0) {
    return {
      totalWindows: 0,
      trainRange: { min: 0, max: 0 },
      validationRange: { min: 0, max: 0 },
      testRange: { min: 0, max: 0 },
      totalTrainPeriods: 0,
      totalValidationPeriods: 0,
      totalTestPeriods: 0,
    };
  }

  const trainSizes = windows.map(w => w.trainRange.end - w.trainRange.start + 1);
  const validationSizes = windows.map(w => w.validationRange.end - w.validationRange.start + 1);
  const testSizes = windows.map(w => w.testRange.end - w.testRange.start + 1);

  return {
    totalWindows: windows.length,
    trainRange: {
      min: Math.min(...trainSizes),
      max: Math.max(...trainSizes),
    },
    validationRange: {
      min: Math.min(...validationSizes),
      max: Math.max(...validationSizes),
    },
    testRange: {
      min: Math.min(...testSizes),
      max: Math.max(...testSizes),
    },
    totalTrainPeriods: trainSizes.reduce((a, b) => a + b, 0),
    totalValidationPeriods: validationSizes.reduce((a, b) => a + b, 0),
    totalTestPeriods: testSizes.reduce((a, b) => a + b, 0),
  };
}

/**
 * 格式化窗口信息用于显示
 */
export function formatWindowInfo(window: WalkForwardWindow): string {
  return [
    `Window: ${window.windowId}`,
    `Train: ${window.trainRange.start}-${window.trainRange.end}`,
    `Validation: ${window.validationRange.start}-${window.validationRange.end}`,
    `Test: ${window.testRange.start}-${window.testRange.end}`,
    window.purgeRange 
      ? `Purge: ${window.purgeRange.start}-${window.purgeRange.end}`
      : 'No purge',
  ].join(' | ');
}
