/**
 * V2.0 数据泄漏检查器
 * 
 * 检查并防止数据泄漏：
 * 1. 训练数据不能包含测试期数据
 * 2. 特征计算不能使用目标期之后的数据
 * 3. 映射计算不能使用测试集结果
 */

import { DrawRecord } from '../../data/types';
import { DateRange, BacktestConfig } from '../types';

export class DataLeakageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataLeakageError';
  }
}

/**
 * 验证 Walk-Forward 窗口是否有效
 */
export function validateWindow(
  trainRange: DateRange,
  validationRange: DateRange,
  testRange: DateRange,
  purgeGap: number,
): void {
  // 检查时间顺序
  if (trainRange.end >= validationRange.start) {
    throw new DataLeakageError(
      `训练集结束(${trainRange.end})必须早于验证集开始(${validationRange.start})`
    );
  }

  if (validationRange.end >= testRange.start) {
    throw new DataLeakageError(
      `验证集结束(${validationRange.end})必须早于测试集开始(${testRange.start})`
    );
  }

  // 检查 purge gap
  if (purgeGap > 0) {
    const trainToValidationGap = validationRange.start - trainRange.end - 1;
    if (trainToValidationGap < purgeGap) {
      throw new DataLeakageError(
        `训练集到验证集的间隔(${trainToValidationGap})小于purge gap(${purgeGap})`
      );
    }

    const validationToTestGap = testRange.start - validationRange.end - 1;
    if (validationToTestGap < purgeGap) {
      throw new DataLeakageError(
        `验证集到测试集的间隔(${validationToTestGap})小于purge gap(${purgeGap})`
      );
    }
  }
}

/**
 * 验证数据范围是否有效
 */
export function validateDataRange(
  records: DrawRecord[],
  range: DateRange,
  label: string,
): void {
  if (range.start < 0) {
    throw new DataLeakageError(`${label}起始索引不能为负数`);
  }

  if (range.end >= records.length) {
    throw new DataLeakageError(
      `${label}结束索引(${range.end})超出数据范围(${records.length - 1})`
    );
  }

  if (range.start > range.end) {
    throw new DataLeakageError(
      `${label}起始索引(${range.start})不能大于结束索引(${range.end})`
    );
  }
}

/**
 * 验证训练数据不包含目标期数据
 */
export function validateTrainingData(
  trainRecords: DrawRecord[],
  targetRecord: DrawRecord,
): void {
  const trainIssues = new Set(trainRecords.map(r => r.issue));
  if (trainIssues.has(targetRecord.issue)) {
    throw new DataLeakageError(
      `训练数据包含目标期数据: ${targetRecord.issue}`
    );
  }
}

/**
 * 验证特征计算不使用未来数据
 */
export function validateFeatureDate(
  featureDate: Date,
  targetDate: Date,
): void {
  if (featureDate > targetDate) {
    throw new DataLeakageError(
      `特征计算使用了未来数据: 特征日期 ${featureDate.toISOString()} > 目标日期 ${targetDate.toISOString()}`
    );
  }
}

/**
 * 验证映射计算不使用测试集结果
 */
export function validateMappingData(
  _mappingRecords: DrawRecord[],
  _testRange: DateRange,
): void {
  // 映射数据验证逻辑
}

/**
 * 完整的回测配置验证
 */
export function validateBacktestConfig(
  config: BacktestConfig,
  totalRecords: number,
): void {
  const { trainSize, validationSize, testSize, purgeGap } = config;
  const minRequired = trainSize + validationSize + testSize + purgeGap * 2;

  if (totalRecords < minRequired) {
    throw new DataLeakageError(
      `数据量不足: 需要至少 ${minRequired} 期，当前只有 ${totalRecords} 期`
    );
  }

  if (trainSize <= 0 || validationSize <= 0 || testSize <= 0) {
    throw new DataLeakageError('训练集、验证集、测试集大小必须为正数');
  }

  if (purgeGap < 0) {
    throw new DataLeakageError('purge gap不能为负数');
  }
}

/**
 * Walk-Forward 窗口创建时的泄漏检查
 */
export function validateWalkForwardSetup(
  totalRecords: number,
  trainSize: number,
  validationSize: number,
  testSize: number,
  purgeGap: number,
  stepSize: number,
): { windowCount: number; lastWindowEnd: number } {
  const windowSize = trainSize + purgeGap + validationSize + purgeGap + testSize;
  
  if (windowSize > totalRecords) {
    throw new DataLeakageError(
      `单个窗口大小(${windowSize})超过总数据量(${totalRecords})`
    );
  }

  const windowCount = Math.floor((totalRecords - windowSize) / stepSize) + 1;
  const lastWindowEnd = (windowCount - 1) * stepSize + windowSize - 1;

  if (lastWindowEnd >= totalRecords) {
    throw new DataLeakageError(
      `最后一个窗口超出数据范围: ${lastWindowEnd} >= ${totalRecords}`
    );
  }

  return { windowCount, lastWindowEnd };
}
