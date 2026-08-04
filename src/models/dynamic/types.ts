export interface AlgorithmConfig {
  id: string;
  name: string;
  enabled: boolean;
  weight: number;
}

export interface TypeAlgorithm {
  id: string;
  weight: number;
  hitRate?: number;
  hitCount?: number;
  totalCount?: number;
}

export interface PredictionTypeConfig {
  id: string;
  name: string;
  enabled: boolean;
  resultCount: number;
  selectedAlgorithms: TypeAlgorithm[];
  categories: string[];
  numberRanges: number[][];
  isBuiltin: boolean;
  autoWeight: boolean;
  topN?: number;
}

export interface DynamicPredictionRecord {
  id: string;
  timestamp: string;
  issue: string;
  date: string;
  typeResults: { typeId: string; typeName: string; categories: { category: string; probability: number }[] }[];
  finalNumbers: { number: number; probability: number }[];
  typeHits?: { typeId: string; actualCategory: string; algorithmResults: { algoId: string; rank: number }[] }[];
}
