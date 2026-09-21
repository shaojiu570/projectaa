/**
 * V2.0 预测结果类型
 */

export interface RankedCategory {
  category: string;
  probability: number;
  rank: number;
}

export interface ModelPrediction {
  modelId: string;
  typeId: string;
  targetDate: string;
  probabilities: Record<string, number>;
  ranked: RankedCategory[];
  metadata?: {
    sampleSize?: number;
    windowSize?: number;
    trainedUntil?: string;
  };
}

export interface TypeProbability {
  typeId: string;
  categories: Array<{
    id: string;
    probability: number;
  }>;
}

export interface PredictionConfidence {
  probability: number;
  calibratedProbability?: number;
  rank: number;
  ensembleAgreement: number;
  modelCount: number;
  stability: number;
}

export interface PredictionSnapshot {
  id: string;
  targetDate: string;
  engineVersion: string;
  typeResults: TypePredictionResult[];
  modelWeights: Record<string, number>;
  selectedModels: string[];
  backtestId?: string;
  createdAt: string;
}

export interface TypePredictionResult {
  typeId: string;
  typeName: string;
  categories: RankedCategory[];
  confidence: PredictionConfidence;
}
