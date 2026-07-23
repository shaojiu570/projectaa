import { DrawRecord } from '../../data/types';

export type PredictFn = (data: DrawRecord[], seed: number) => number[];
export type CategoryPredictFn = (data: DrawRecord[], seed: number) => Record<string, number>;

export interface RegisteredModel {
  id: string;
  name: string;
  desc: string;
  outputType: 'number_array' | 'category_map';
  predict: PredictFn | CategoryPredictFn;
  categories?: string[];
  defaultWeight: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  desc: string;
  enabled: boolean;
  weight: number;
}
