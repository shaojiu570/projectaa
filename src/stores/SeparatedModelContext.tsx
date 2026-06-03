import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { ModelConfig } from './AppContext';
import { DEFAULT_NUMBER_MODELS } from '../models/number';
import { DEFAULT_ZODIAC_MODELS } from '../models/zodiac';
import { saveToStorage, loadFromStorage } from '../utils/storage';

const NUMBER_MODELS_KEY = 'separated_number_models';
const ZODIAC_MODELS_KEY = 'separated_zodiac_models';
const AUTO_WEIGHT_KEY = 'separated_auto_weight';
const ZODIAC_MODEL_VERSION = 'v2';
const ZODIAC_VERSION_KEY = 'separated_zodiac_version';

export interface SeparatedModelContextType {
  numberModels: ModelConfig[];
  zodiacModels: ModelConfig[];
  autoWeightOptimization: boolean;
  toggleNumberModel: (id: string) => void;
  toggleZodiacModel: (id: string) => void;
  setNumberModelWeight: (id: string, weight: number) => void;
  setZodiacModelWeight: (id: string, weight: number) => void;
  setAutoWeightOptimization: (enabled: boolean) => void;
  resetSeparatedModels: () => void;
  applyNumberWeights: (weights: { id: string; weight: number }[]) => void;
  applyZodiacWeights: (weights: { id: string; weight: number }[]) => void;
}

const Ctx = createContext<SeparatedModelContextType | null>(null);

export function SeparatedModelProvider({ children }: { children: ReactNode }) {
  const [numberModels, setNumberModels] = useState<ModelConfig[]>(() => {
    const saved = loadFromStorage<ModelConfig[]>(NUMBER_MODELS_KEY);
    return saved || DEFAULT_NUMBER_MODELS;
  });
  const [zodiacModels, setZodiacModels] = useState<ModelConfig[]>(() => {
    const savedVersion = loadFromStorage<string>(ZODIAC_VERSION_KEY);
    if (savedVersion !== ZODIAC_MODEL_VERSION) return DEFAULT_ZODIAC_MODELS;
    const saved = loadFromStorage<ModelConfig[]>(ZODIAC_MODELS_KEY);
    if (saved) {
      const merged = DEFAULT_ZODIAC_MODELS.map(def => {
        const existing = saved.find(s => s.id === def.id);
        return existing ? { ...def, enabled: existing.enabled, weight: existing.weight } : def;
      });
      return merged;
    }
    return DEFAULT_ZODIAC_MODELS;
  });
  const [autoWeightOptimization, setAutoWeightEnabled] = useState<boolean>(() => {
    const saved = loadFromStorage<boolean>(AUTO_WEIGHT_KEY);
    return saved ?? true;
  });

  useEffect(() => {
    saveToStorage(numberModels, NUMBER_MODELS_KEY);
  }, [numberModels]);

  useEffect(() => {
    saveToStorage(zodiacModels, ZODIAC_MODELS_KEY);
    saveToStorage(ZODIAC_MODEL_VERSION, ZODIAC_VERSION_KEY);
  }, [zodiacModels]);

  useEffect(() => {
    saveToStorage(autoWeightOptimization, AUTO_WEIGHT_KEY);
  }, [autoWeightOptimization]);

  const toggleNumberModel = useCallback((id: string) => {
    setNumberModels(prev => prev.map(m =>
      m.id === id ? { ...m, enabled: !m.enabled } : m
    ));
  }, []);

  const toggleZodiacModel = useCallback((id: string) => {
    setZodiacModels(prev => prev.map(m =>
      m.id === id ? { ...m, enabled: !m.enabled } : m
    ));
  }, []);

  const setNumberModelWeight = useCallback((id: string, weight: number) => {
    setNumberModels(prev => prev.map(m =>
      m.id === id ? { ...m, weight } : m
    ));
  }, []);

  const setZodiacModelWeight = useCallback((id: string, weight: number) => {
    setZodiacModels(prev => prev.map(m =>
      m.id === id ? { ...m, weight } : m
    ));
  }, []);

  const setAutoWeightOptimization = useCallback((enabled: boolean) => {
    setAutoWeightEnabled(enabled);
  }, []);

  const resetSeparatedModels = useCallback(() => {
    setNumberModels(DEFAULT_NUMBER_MODELS);
    setZodiacModels(DEFAULT_ZODIAC_MODELS);
  }, []);

  const applyNumberWeights = useCallback((weights: { id: string; weight: number }[]) => {
    setNumberModels(prev => prev.map(m => {
      const found = weights.find(w => w.id === m.id);
      return found ? { ...m, weight: found.weight } : m;
    }));
  }, []);

  const applyZodiacWeights = useCallback((weights: { id: string; weight: number }[]) => {
    setZodiacModels(prev => prev.map(m => {
      const found = weights.find(w => w.id === m.id);
      return found ? { ...m, weight: found.weight } : m;
    }));
  }, []);

  const value: SeparatedModelContextType = {
    numberModels,
    zodiacModels,
    autoWeightOptimization,
    toggleNumberModel,
    toggleZodiacModel,
    setNumberModelWeight,
    setZodiacModelWeight,
    setAutoWeightOptimization,
    resetSeparatedModels,
    applyNumberWeights,
    applyZodiacWeights,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSeparatedModel(): SeparatedModelContextType {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSeparatedModel must be inside SeparatedModelProvider');
  return c;
}
