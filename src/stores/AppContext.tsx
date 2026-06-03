import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { DrawRecord } from '../data/types';
import { generateHistoricalData } from '../data/historicalData';
import {
  ZODIAC_NUMBERS as DEFAULT_ZODIAC_NUMBERS,
  COLOR_NUMBERS as DEFAULT_COLOR_NUMBERS,
  YEAR_ELEMENTS,
} from '../constants';

export interface ModelConfig {
  id: string;
  name: string;
  desc: string;
  enabled: boolean;
  weight: number;
}

export const INITIAL_MODELS: ModelConfig[] = [
  { id: 'resnet', name: 'ResNet', desc: '1D残差网络，多任务输出头', enabled: true, weight: 0.25 },
  { id: 'lstm', name: 'LSTM', desc: '长短时记忆网络，序列建模', enabled: true, weight: 0.20 },
  { id: 'xgboost', name: 'XGBoost', desc: '梯度提升树，表格特征处理', enabled: true, weight: 0.15 },
  { id: 'gru', name: 'GRU', desc: '门控循环单元，轻量序列', enabled: false, weight: 0.10 },
  { id: 'transformer', name: 'Transformer', desc: '自注意力机制，全局依赖建模', enabled: false, weight: 0.10 },
  { id: 'random_forest', name: 'RandomForest', desc: '随机森林，集成学习基线', enabled: false, weight: 0.05 },
  { id: 'lightgbm', name: 'LightGBM', desc: '轻量梯度提升，高效训练', enabled: false, weight: 0.10 },
  { id: 'markov', name: '马尔可夫链', desc: '状态转移概率模型', enabled: true, weight: 0.15 },
];

export interface FunnelConfig {
  level1KeepRatio: number;
  zodiacTopK: number;
  level2KeepCount: number;
  level3OutputCount: number;
  useMarkovForZodiac: boolean;
  zodiacFusionAlpha: number;
}

export const DEFAULT_FUNNEL: FunnelConfig = {
  level1KeepRatio: 0.6,
  zodiacTopK: 3,
  level2KeepCount: 15,
  level3OutputCount: 10,
  useMarkovForZodiac: true,
  zodiacFusionAlpha: 0.5,
};

interface AppCtx {
  data: DrawRecord[];
  setData: React.Dispatch<React.SetStateAction<DrawRecord[]>>;
  addRecord: (r: DrawRecord) => void;
  removeRecord: (issue: string) => void;
  resetData: () => void;

  zodiacNumbers: Record<string, number[]>;
  setZodiacNumbers: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;
  colorNumbers: Record<string, number[]>;
  setColorNumbers: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;
  resetMappings: () => void;

  models: ModelConfig[];
  setModels: React.Dispatch<React.SetStateAction<ModelConfig[]>>;
  toggleModel: (id: string) => void;
  setModelWeight: (id: string, w: number) => void;

  funnelConfig: FunnelConfig;
  setFunnelConfig: React.Dispatch<React.SetStateAction<FunnelConfig>>;

  getZodiac: (n: number) => string;
  getColor: (n: number) => string;
  getElement: (n: number) => string;
}

const Ctx = createContext<AppCtx | null>(null);

function deepCloneMap(m: Record<string, number[]>): Record<string, number[]> {
  const r: Record<string, number[]> = {};
  for (const k of Object.keys(m)) r[k] = [...m[k]];
  return r;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DrawRecord[]>(() => generateHistoricalData());
  const [zodiacNumbers, setZodiacNumbers] = useState(() => deepCloneMap(DEFAULT_ZODIAC_NUMBERS));
  const [colorNumbers, setColorNumbers] = useState(() => deepCloneMap(DEFAULT_COLOR_NUMBERS));
  const [models, setModels] = useState<ModelConfig[]>(() => INITIAL_MODELS.map(m => ({ ...m })));
  const [funnelConfig, setFunnelConfig] = useState<FunnelConfig>({ ...DEFAULT_FUNNEL });

  const addRecord = useCallback((r: DrawRecord) => {
    setData(prev => {
      if (prev.some(d => d.issue === r.issue)) return prev;
      return [...prev, r].sort((a, b) => a.issue.localeCompare(b.issue));
    });
  }, []);

  const removeRecord = useCallback((issue: string) => {
    setData(prev => prev.filter(d => d.issue !== issue));
  }, []);

  const resetData = useCallback(() => setData(generateHistoricalData()), []);

  const resetMappings = useCallback(() => {
    setZodiacNumbers(deepCloneMap(DEFAULT_ZODIAC_NUMBERS));
    setColorNumbers(deepCloneMap(DEFAULT_COLOR_NUMBERS));
  }, []);

  const toggleModel = useCallback((id: string) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
  }, []);

  const setModelWeight = useCallback((id: string, w: number) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, weight: w } : m));
  }, []);

  const getZodiac = useCallback((num: number): string => {
    for (const [z, nums] of Object.entries(zodiacNumbers)) {
      if (nums.includes(num)) return z;
    }
    return '未知';
  }, [zodiacNumbers]);

  const getColor = useCallback((num: number): string => {
    for (const [c, nums] of Object.entries(colorNumbers)) {
      if (nums.includes(num)) return c;
    }
    return '未知';
  }, [colorNumbers]);

  const getElement = useCallback((num: number): string => {
    const year = new Date().getFullYear();
    const yearData = YEAR_ELEMENTS[year];
    if (!yearData) return '未知';
    for (const [element, nums] of Object.entries(yearData)) {
      if (nums.includes(num)) return element;
    }
    return '未知';
  }, []);

  const value = useMemo<AppCtx>(() => ({
    data, setData, addRecord, removeRecord, resetData,
    zodiacNumbers, setZodiacNumbers,
    colorNumbers, setColorNumbers,
    resetMappings,
    models, setModels, toggleModel, setModelWeight,
    funnelConfig, setFunnelConfig,
    getZodiac, getColor, getElement,
  }), [
    data, zodiacNumbers, colorNumbers, models, funnelConfig,
    addRecord, removeRecord, resetData, resetMappings, toggleModel, setModelWeight,
    getZodiac, getColor, getElement,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp must be inside AppProvider');
  return c;
}
