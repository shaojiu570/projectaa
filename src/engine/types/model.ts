/**
 * V2.0 模型定义类型
 */

export type ModelFamily =
  | 'frequency'
  | 'timeseries'
  | 'probability'
  | 'association'
  | 'machine_learning'
  | 'sequence'
  | 'optimization'
  | 'decision'
  | 'baseline';

export type ComplexityLevel = 'low' | 'medium' | 'high';

export interface ModelDefinition {
  id: string;
  name: string;
  family: ModelFamily;
  enabled: boolean;
  supportsTypes: string[];
  defaultWeight: number;
  complexity: ComplexityLevel;
  requiresTraining: boolean;
  description?: string;
}

export interface ModelEvaluation {
  modelId: string;
  modelFamily: ModelFamily;
  hitRate: number;
  hitRateByK: Record<number, number>;
  mrr: number;
  logLoss: number;
  brierScore: number;
  stability: number;
  windowScores: number[];
  isScore: number;
  oosScore: number;
  overfitGap: number;
  enabled: boolean;
}

export interface SelectedModel {
  modelId: string;
  weight: number;
  contribution: number;
  stability: number;
}
