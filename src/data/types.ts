export interface DrawRecord {
  issue: string;
  date: string;
  normals: number[];
  special: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  desc: string;
  enabled: boolean;
  weight: number;
}

export interface NumberPrediction {
  number: number;
  probability: number;
  rank: number;
}

export interface ZodiacPrediction {
  zodiac: string;
  probability: number;
  rank: number;
}

export interface ColorPrediction {
  color: string;
  probability: number;
  rank: number;
}

export interface SizePrediction {
  size: '大' | '小';
  probability: number;
  rank: number;
}

export interface ParityPrediction {
  parity: '单' | '双';
  probability: number;
  rank: number;
}

export interface ElementPrediction {
  element: string;
  probability: number;
  rank: number;
}

export interface SeparatedPredictionResult {
  numberPredictions: {
    level1: NumberPrediction[];
    level2: NumberPrediction[];
    level3: NumberPrediction[];
  };
  zodiacPredictions: {
    level1: ZodiacPrediction[];
    level2: ZodiacPrediction[];
    level3: ZodiacPrediction[];
  };
  colorPredictions: {
    level1: ColorPrediction[];
    level2: ColorPrediction[];
  };
  sizePredictions: {
    level1: SizePrediction[];
    level2: SizePrediction[];
  };
  parityPredictions: {
    level1: ParityPrediction[];
    level2: ParityPrediction[];
  };
  combinedRecommendations: {
    combos: { zodiac: string; number: number; probability: number }[];
    colors: string[];
    size: '大' | '小' | null;
    parity: '单' | '双' | null;
  };
  timestamp: string;
  activeModelCount: number;
  usedNumberWeights: { id: string; weight: number }[];
  usedZodiacWeights: { id: string; weight: number }[];
}
