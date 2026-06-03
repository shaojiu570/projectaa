import { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';
import { loadFromStorage, saveToStorage } from '../utils/storage';

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

const MODELS_STORAGE_KEY = 'lottery_models_config';

interface ModelCtx {
  models: ModelConfig[];
  setModels: React.Dispatch<React.SetStateAction<ModelConfig[]>>;
  toggleModel: (id: string) => void;
  setModelWeight: (id: string, w: number) => void;
  resetModels: () => void;
}

const Ctx = createContext<ModelCtx | null>(null);

export function ModelProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<ModelConfig[]>(() => {
    const saved = loadFromStorage<ModelConfig[]>(MODELS_STORAGE_KEY);
    return saved ?? INITIAL_MODELS.map(m => ({ ...m }));
  });

  useEffect(() => {
    saveToStorage(models, MODELS_STORAGE_KEY);
  }, [models]);

  const toggleModel = useCallback((id: string) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
  }, []);

  const setModelWeight = useCallback((id: string, w: number) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, weight: w } : m));
  }, []);

  const resetModels = useCallback(() => {
    setModels(INITIAL_MODELS.map(m => ({ ...m })));
  }, []);

  const value = useMemo<ModelCtx>(() => ({
    models, setModels, toggleModel, setModelWeight, resetModels,
  }), [models, toggleModel, setModelWeight, resetModels]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useModel(): ModelCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useModel must be inside ModelProvider');
  return c;
}
