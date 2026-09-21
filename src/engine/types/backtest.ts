/**
 * V2.0 回测类型定义
 */

export interface DateRange {
  start: number;
  end: number;
  startDate?: string;
  endDate?: string;
}

export interface BacktestConfig {
  typeId: string;
  trainSize: number;
  validationSize: number;
  testSize: number;
  purgeGap: number;
  stepSize: number;
  candidateWindows: number[];
  topKValues: number[];
  maxModels?: number;
  subsetSearch: 'exhaustive' | 'pruned';
  weightOptimization: 'grid' | 'random' | 'hybrid';
  metrics: EvaluationWeights;
  minSamplesForSelection: number;
  randomSeed: number;
}

export interface EvaluationWeights {
  hitRate: number;
  mrr: number;
  probability: number;
  stability: number;
  diversity: number;
  correlationPenalty: number;
  overfitPenalty: number;
}

export interface WalkForwardWindow {
  windowId: string;
  trainRange: DateRange;
  validationRange: DateRange;
  purgeRange?: DateRange;
  testRange: DateRange;
}

export interface WalkForwardResult {
  windowId: string;
  trainRange: DateRange;
  validationRange: DateRange;
  purgeRange?: DateRange;
  testRange: DateRange;
  selectedModels: string[];
  weights: Record<string, number>;
  validationMetrics: MetricsResult;
  testMetrics: MetricsResult;
  subsetsEvaluated: number;
  bestSubsetScore: number;
}

export interface MetricsResult {
  hitRate: number;
  hitRateByK: Record<number, number>;
  mrr: number;
  logLoss: number;
  brierScore: number;
  compositeScore: number;
  stability?: number;
  correlationPenalty?: number;
  overfitPenalty?: number;
}

export interface CorrelationMatrix {
  modelIds: string[];
  matrix: number[][];
  averageCorrelation: number;
}

export interface OverfitMetrics {
  inSampleScore: number;
  validationScore: number;
  outOfSampleScore: number;
  isToOosGap: number;
  validationToOosGap: number;
  overfitRatio: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface StabilityMetrics {
  meanScore: number;
  stdScore: number;
  minScore: number;
  maxScore: number;
  stabilityScore: number;
  windowScores: number[];
  riskPenaltyLambda: number;
}

export interface BaselineResult {
  baselineType: 'random' | 'uniform' | 'historical_frequency' | 'recent_frequency';
  metrics: MetricsResult;
  windowScores: number[];
}

export interface EnsembleEvaluation {
  ensembleType: 'best' | 'stable';
  modelIds: string[];
  weights: Record<string, number>;
  metrics: MetricsResult;
  stability: StabilityMetrics;
  overfit: OverfitMetrics;
}

export interface BacktestResultV2 {
  typeId: string;
  config: BacktestConfig;
  totalWindows: number;
  baselineResults: BaselineResult[];
  modelResults: ModelEvaluation[];
  ensembleResults: EnsembleEvaluation[];
  walkForwardResults: WalkForwardResult[];
  correlationMatrix: CorrelationMatrix;
  selectedModels: SelectedModel[];
  selectedWeights: Record<string, number>;
  metrics: MetricsResult;
  overfit: OverfitMetrics;
  stability: StabilityMetrics;
  randomSeed: number;
  createdAt: string;
  engineVersion: string;
}

export interface SelectedModel {
  modelId: string;
  weight: number;
  contribution: number;
  stability: number;
}

export interface ModelEvaluation {
  modelId: string;
  family: string;
  overallMetrics: MetricsResult;
  windowMetrics: MetricsResult[];
  stability: StabilityMetrics;
  isScore: number;
  oosScore: number;
}
